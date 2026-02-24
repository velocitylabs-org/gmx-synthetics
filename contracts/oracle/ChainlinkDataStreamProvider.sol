// SPDX-License-Identifier: BUSL-1.1

pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { DataStore } from "../data/DataStore.sol";
import { Keys } from "../data/Keys.sol";
import { Errors } from "../error/Errors.sol";
import { OracleUtils } from "./OracleUtils.sol";
import { IOracleProvider } from "./IOracleProvider.sol";
import { IChainlinkDataStreamVerifier } from "./IChainlinkDataStreamVerifier.sol";
import { IChainlinkDataStreamFeeManager, FeeAsset } from "./IChainlinkDataStreamFeeManager.sol";
import { Precision } from "../utils/Precision.sol";
import { Chain } from "../chain/Chain.sol";

contract ChainlinkDataStreamProvider is IOracleProvider {
    DataStore public immutable dataStore;
    address public immutable oracle;
    IChainlinkDataStreamVerifier public immutable verifier;

    // bid: min price, highest buy price
    // ask: max price, lowest sell price
    struct Report {
        bytes32 feedId; // The feed ID the report has data for
        uint32 validFromTimestamp; // Earliest timestamp for which price is applicable
        uint32 observationsTimestamp; // Latest timestamp for which price is applicable
        uint192 nativeFee; // Base cost to validate a transaction using the report, denominated in the chain’s native token (WETH/ETH)
        uint192 linkFee; // Base cost to validate a transaction using the report, denominated in LINK
        uint32 expiresAt; // Latest timestamp where the report can be verified onchain
        int192 price; // DON consensus median price, carried to 8 decimal places
        int192 bid; // Simulated price impact of a buy order up to the X% depth of liquidity utilisation
        int192 ask; // Simulated price impact of a sell order up to the X% depth of liquidity utilisation
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) {
            revert Errors.Unauthorized(msg.sender, "Oracle");
        }
        _;
    }

    constructor(DataStore _dataStore, address _oracle, IChainlinkDataStreamVerifier _verifier) {
        dataStore = _dataStore;
        oracle = _oracle;
        verifier = _verifier;
    }

    function shouldAdjustTimestamp() external pure returns (bool) {
        return true;
    }

    function isChainlinkOnChainProvider() external pure returns (bool) {
        return false;
    }

    function getOraclePrice(
        address token,
        bytes memory data
    ) external onlyOracle returns (OracleUtils.ValidatedPrice memory) {
        bytes32 feedId = dataStore.getBytes32(Keys.dataStreamIdKey(token));
        if (feedId == bytes32(0)) {
            revert Errors.EmptyDataStreamFeedId(token);
        }
        _ensureAllowance();
        bytes memory payloadParameter = _getPayloadParameter();
        bytes memory verifierResponse = verifier.verify(data, payloadParameter);

        Report memory report = abi.decode(verifierResponse, (Report));

        if (feedId != report.feedId) {
            revert Errors.InvalidDataStreamFeedId(token, report.feedId, feedId);
        }

        if (report.bid <= 0 || report.ask <= 0) {
            revert Errors.InvalidDataStreamPrices(token, report.bid, report.ask);
        }

        if (report.bid > report.ask) {
            revert Errors.InvalidDataStreamBidAsk(token, report.bid, report.ask);
        }

        uint256 precision = _getDataStreamMultiplier(token);
        uint256 adjustedBidPrice = Precision.mulDiv(uint256(uint192(report.bid)), precision, Precision.FLOAT_PRECISION);
        uint256 adjustedAskPrice = Precision.mulDiv(uint256(uint192(report.ask)), precision, Precision.FLOAT_PRECISION);

        uint256 spreadReductionFactor = _getDataStreamSpreadReductionFactor(token);
        if (spreadReductionFactor != 0) {
            // small optimization for full reduction
            if (spreadReductionFactor == Precision.FLOAT_PRECISION) {
                adjustedBidPrice = (adjustedAskPrice + adjustedBidPrice) / 2;
                adjustedAskPrice = adjustedBidPrice;
            } else {
                uint256 halfSpread = (adjustedAskPrice - adjustedBidPrice) / 2;
                adjustedBidPrice = adjustedBidPrice + Precision.applyFactor(halfSpread, spreadReductionFactor);
                adjustedAskPrice = adjustedAskPrice - Precision.applyFactor(halfSpread, spreadReductionFactor);
            }
        }

        return
            OracleUtils.ValidatedPrice({
                token: token,
                min: adjustedBidPrice,
                max: adjustedAskPrice,
                timestamp: report.observationsTimestamp,
                provider: address(this)
            });
    }

    function _getDataStreamSpreadReductionFactor(address token) internal view returns (uint256) {
        uint256 spreadReductionFactor = dataStore.getUint(Keys.dataStreamSpreadReductionFactorKey(token));
        if (spreadReductionFactor > Precision.FLOAT_PRECISION) {
            revert Errors.InvalidDataStreamSpreadReductionFactor(token, spreadReductionFactor);
        }

        return spreadReductionFactor;
    }

    function _getDataStreamMultiplier(address token) internal view returns (uint256) {
        uint256 multiplier = dataStore.getUint(Keys.dataStreamMultiplierKey(token));

        if (multiplier == 0) {
            revert Errors.EmptyDataStreamMultiplier(token);
        }

        return multiplier;
    }

    function _getPayloadParameter() internal view returns (bytes memory) {
        // LINK token address
        address feeToken = dataStore.getAddress(Keys.CHAINLINK_PAYMENT_TOKEN);

        if (feeToken == address(0)) {
            return new bytes(0);
        }

        return abi.encode(feeToken);
    }

    /**
     * @notice Ensures allowance for the verifier's RewardManager before verify().
     * @dev When s_feeManager() is non-zero, validates CHAINLINK_PAYMENT_TOKEN matches the
     *      FeeManager's LINK address and approves allowance to the RewardManager proxy.
     */
    function _ensureAllowance() internal {
        address feeToken = dataStore.getAddress(Keys.CHAINLINK_PAYMENT_TOKEN);
        if (feeToken == address(0)) {
            return;
        }

        address feeManagerAddr = verifier.s_feeManager();
        if (feeManagerAddr == address(0)) {
            return;
        }

        IChainlinkDataStreamFeeManager feeManager = IChainlinkDataStreamFeeManager(feeManagerAddr);
        if (feeToken != feeManager.i_linkAddress()) {
            revert Errors.InvalidChainlinkFeeToken(feeToken, feeManager.i_linkAddress());
        }

        address rewardManager = feeManager.i_rewardManager();

        uint256 threshold = dataStore.getUint(Keys.CHAINLINK_PAYMENT_ALLOWANCE_THRESHOLD);
        if (threshold == 0) {
            threshold = 100 * 10 ** 18; // default 100 LINK
        }
        uint256 currentAllowance = IERC20(feeToken).allowance(address(this), rewardManager);
        if (currentAllowance < threshold) {
            IERC20(feeToken).approve(rewardManager, threshold);
        }
    }
}
