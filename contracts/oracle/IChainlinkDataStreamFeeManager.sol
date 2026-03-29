// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

struct FeeAsset {
    address asset;
    uint256 amount;
}

interface IChainlinkDataStreamFeeManager {
    function getFeeAndReward(
        address subscriber,
        bytes memory unverifiedReport,
        address quoteAddress
    ) external returns (FeeAsset memory fee, FeeAsset memory reward, uint256 totalDiscount);

    function i_rewardManager() external view returns (address);

    function i_linkAddress() external view returns (address);
}
