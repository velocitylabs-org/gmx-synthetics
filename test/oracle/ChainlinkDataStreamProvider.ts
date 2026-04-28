import { expect } from "chai";
import { deployFixture } from "../../utils/fixture";

import { encodeData } from "../../utils/hash";
import { expandDecimals, percentageToFloat } from "../../utils/math";
import * as keys from "../../utils/keys";
import { ethers } from "hardhat";
import { BigNumberish } from "ethers";
import { decodeValidatedPrice } from "../../utils/oracle-provider";

// V3 report: feedId prefix 0x0003 — bid/ask spread, no market status
// struct: feedId, validFromTs, observationsTs, nativeFee, linkFee, expiresAt, price, bid, ask
function encodeV3Report(feedId: string, bid: BigNumberish, ask: BigNumberish) {
  return encodeData(
    ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192"],
    [feedId, 1, 1732209862, 1732209872, 4, 5, 6, bid, ask]
  );
}

// V8 report: feedId prefix 0x0008 — single midPrice, marketStatus, staleness check
// struct: feedId, validFromTs, observationsTs, nativeFee, linkFee, expiresAt, lastUpdateTs, midPrice, marketStatus
async function encodeV8Report(feedId: string, midPrice: BigNumberish) {
  const { timestamp } = await ethers.provider.getBlock("latest");
  return encodeData(
    ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
    [feedId, 1, 1732209862, 4, 5, 4294967295, timestamp, midPrice, 2]
  );
}

describe("ChainlinkDataStreamProvider", () => {
  let fixture;
  let dataStore, chainlinkDataStreamProvider, wnt, brl, oracle;

  beforeEach(async () => {
    fixture = await deployFixture();
    ({ dataStore, chainlinkDataStreamProvider, wnt, brl, oracle } = fixture.contracts);
  });

  async function callGetOraclePrice(tokenAddress: string, reportData: string) {
    const callData = chainlinkDataStreamProvider.interface.encodeFunctionData("getOraclePrice", [
      tokenAddress,
      reportData,
    ]);
    const result = await ethers.provider.call({
      to: chainlinkDataStreamProvider.address,
      data: callData,
      from: oracle.address,
    });
    return decodeValidatedPrice(result);
  }

  describe("V8 (forex/RWA) inversion", () => {
    // feedId prefix 0x0008 routes to _processV8Report
    const V8_FEED_ID = "0x0008000000000000000000000000000000000000000000000000000000000001";

    beforeEach(async () => {
      await dataStore.setBytes32(keys.dataStreamIdKey(brl.address), V8_FEED_ID);
      // 18-decimal token, 18-decimal feed → multiplier = 10^(60-18-18) = 10^24
      await dataStore.setUint(keys.dataStreamMultiplierKey(brl.address), expandDecimals(1, 24));
    });

    it("inverts USD/FX feed price correctly (USD/BRL = 4200)", async () => {
      // inversionScale = 10^(2*(30-18)) = 10^24
      await dataStore.setUint(keys.dataStreamInversionScaleKey(brl.address), expandDecimals(1, 24));

      // rawMidPrice = 4200 * 10^18
      // adjustedPrice = 4200e18 * 1e24 / 1e30 = 4200 * 10^12
      // invertedPrice = 1e24 / (4200 * 1e12) = 238,095,238
      const price = await callGetOraclePrice(brl.address, await encodeV8Report(V8_FEED_ID, expandDecimals(4200, 18)));

      expect(price.min).eq(238095238);
      expect(price.max).eq(238095238);
    });

    it("reverts InvalidInvertedPrice when inversion result is zero", async () => {
      await dataStore.setUint(keys.dataStreamInversionScaleKey(brl.address), expandDecimals(1, 24));

      // rawMidPrice = 2 * 10^30 → adjustedPrice = 2e30 * 1e24 / 1e30 = 2e24
      // 1e24 / 2e24 = 0 → revert InvalidInvertedPrice
      await expect(callGetOraclePrice(brl.address, await encodeV8Report(V8_FEED_ID, expandDecimals(2, 30)))).to.be
        .rejected;
    });
  });

  describe("V3 bid/ask inversion", () => {
    // feedId prefix 0x0003 routes to _processV3Report (default)
    const V3_FEED_ID = "0x0003000000000000000000000000000000000000000000000000000000000001";

    beforeEach(async () => {
      await dataStore.setBytes32(keys.dataStreamIdKey(wnt.address), V3_FEED_ID);
      // multiplier = 1e30 → adjustedBid/Ask = raw values directly
      await dataStore.setUint(keys.dataStreamMultiplierKey(wnt.address), expandDecimals(1, 30));
      // inversionScale = 1e24
      await dataStore.setUint(keys.dataStreamInversionScaleKey(wnt.address), expandDecimals(1, 24));
    });

    it("flips bid/ask after inversion and preserves min <= max", async () => {
      // bid = 1e12, ask = 2e12
      // adjustedBid = 1e12, adjustedAsk = 2e12
      // invertedMin = 1e24 / 2e12 = 5e11
      // invertedMax = 1e24 / 1e12 = 1e12
      const price = await callGetOraclePrice(
        wnt.address,
        encodeV3Report(V3_FEED_ID, expandDecimals(1, 12), expandDecimals(2, 12))
      );

      expect(price.min).eq(expandDecimals(5, 11));
      expect(price.max).eq(expandDecimals(1, 12));
      expect(price.min.lte(price.max)).to.be.true;
    });
  });

  it("data stream spread", async () => {
    const feedId = "0x0000000000000000000000000000000000000000000000000000000000000001";
    await dataStore.setBytes32(keys.dataStreamIdKey(wnt.address), feedId);
    await dataStore.setUint(keys.dataStreamMultiplierKey(wnt.address), expandDecimals(1, 30));

    await dataStore.setUint(keys.dataStreamSpreadReductionFactorKey(wnt.address), 0);
    const oraclePriceA = await callGetOraclePrice(wnt.address, encodeV3Report(feedId, 99999990, 100000010));
    expect(oraclePriceA.min).eq(99999990);
    expect(oraclePriceA.max).eq(100000010);

    await dataStore.setUint(keys.dataStreamSpreadReductionFactorKey(wnt.address), percentageToFloat("90%"));
    const oraclePriceB = await callGetOraclePrice(wnt.address, encodeV3Report(feedId, 99999990, 100000010));
    expect(oraclePriceB.min).eq(99999999);
    expect(oraclePriceB.max).eq(100000001);

    await dataStore.setUint(keys.dataStreamSpreadReductionFactorKey(wnt.address), percentageToFloat("100%"));
    const oraclePriceC = await callGetOraclePrice(wnt.address, encodeV3Report(feedId, 99999990, 100000010));
    expect(oraclePriceC.min).eq(100000000);
    expect(oraclePriceC.max).eq(100000000);

    await dataStore.setUint(keys.dataStreamSpreadReductionFactorKey(wnt.address), percentageToFloat("300%"));
    await expect(callGetOraclePrice(wnt.address, encodeV3Report(feedId, 99999990, 100000010))).to.be.rejected;
  });
});
