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

    // V3 Crypto feeds (feedId prefix 0x0003) bid/ask spread
    // https://docs.chain.link/data-streams/reference/report-schema-v3
    struct ReportV3 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 price;
        int192 bid;
        int192 ask;
    }

    // V8 RWA/forex feeds (feedId prefix 0x0008) single midPrice, no bid/ask
    // https://docs.chain.link/data-streams/reference/report-schema-v8
    struct ReportV8 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        uint64 lastUpdateTimestamp;
        int192 midPrice;
        uint32 marketStatus;
    }

    bytes2 private constant VERSION_V8 = 0x0008;
    uint256 private constant MAX_PRICE_STALE_THRESHOLD = 30 seconds;

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

        // Detect report schema from feedId version prefix (first 2 bytes)
        bytes2 version = bytes2(feedId);

        if (version == VERSION_V8) {
            return _processV8Report(token, feedId, verifierResponse);
        }

        // Default V3 schema
        return _processV3Report(token, feedId, verifierResponse);
    }

    function _processV3Report(
        address token,
        bytes32 feedId,
        bytes memory verifierResponse
    ) internal view returns (OracleUtils.ValidatedPrice memory) {
        ReportV3 memory report = abi.decode(verifierResponse, (ReportV3));

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

    function _processV8Report(
        address token,
        bytes32 feedId,
        bytes memory verifierResponse
    ) internal view returns (OracleUtils.ValidatedPrice memory) {
        ReportV8 memory report = abi.decode(verifierResponse, (ReportV8));

        if (feedId != report.feedId) {
            revert Errors.InvalidDataStreamFeedId(token, report.feedId, feedId);
        }

        if (report.midPrice <= 0) {
            revert Errors.InvalidDataStreamPrices(token, report.midPrice, report.midPrice);
        }

        _validateForexMarketState(report, token);

        uint256 precision = _getDataStreamMultiplier(token);
        uint256 adjustedPrice = Precision.mulDiv(
            uint256(uint192(report.midPrice)),
            precision,
            Precision.FLOAT_PRECISION
        );

        // V8 has no bid/ask spread midPrice used for both min and max
        return
            OracleUtils.ValidatedPrice({
                token: token,
                min: adjustedPrice,
                max: adjustedPrice,
                timestamp: report.observationsTimestamp,
                provider: address(this)
            });
    }

    function _validateForexMarketState(ReportV8 memory report, address token) internal view {
        // Timestamp of the closing price of the last session.
        uint256 lastReportUpdate = uint256(report.lastUpdateTimestamp);

        // RWA markets operate during specific hours, with breaks for holidays
        // Market status:
        // - unknown: 0
        // - closed: 1
        // - open: 2
        if (report.marketStatus != 2) {
            if (report.marketStatus == 1) {
                revert Errors.ForexMarketClosed(token, report.feedId, report.marketStatus);
            } else {
                revert Errors.ForexMarketStatusUnknown(token, report.feedId, report.marketStatus);
            }
        }

        // Handles stale price & market gaps:
        // Periods where the last available price may not reflect current market conditions.
        if (block.timestamp > lastReportUpdate + MAX_PRICE_STALE_THRESHOLD) {
            revert Errors.StaleForexPrice(token, report.lastUpdateTimestamp, block.timestamp);
        }
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
