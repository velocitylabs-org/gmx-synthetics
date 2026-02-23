import { ethers } from "hardhat";
import { fetchRealtimeFeedReport } from "./realtimeFeed";
import { dataStreamIdKey } from "./keys";

export async function fetchChainlinkPriceForToken(tokenAddress: string): Promise<{
  min: any;
  max: any;
  blob: string;
  dataStreamId: string;
}> {
  const clientId = process.env.CHAINLINK_CLIENT_ID;
  const clientSecret = process.env.CHAINLINK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("CHAINLINK_CLIENT_ID and CHAINLINK_CLIENT_SECRET environment variables are required.");
  }

  const dataStore = await ethers.getContract("DataStore");
  const dataStreamIdBytes32 = await dataStore.getBytes32(dataStreamIdKey(tokenAddress));

  if (dataStreamIdBytes32 === ethers.constants.HashZero) {
    throw new Error(
      `No Data Stream ID configured for token ${tokenAddress}. Check config/tokens.ts (dataStreamFeedId)`
    );
  }

  const dataStreamId = ethers.utils.hexlify(dataStreamIdBytes32);

  const report = await fetchRealtimeFeedReport({
    feedId: dataStreamId,
    clientId,
    clientSecret,
  });

  return {
    min: report.minPrice,
    max: report.maxPrice,
    blob: report.blob,
    dataStreamId,
  };
}

export async function fetchSignedPricesBaseSepolia(tokens: string[]): Promise<{
  [tokenAddress: string]: {
    min: any;
    max: any;
    blob: string;
    oracleType: string;
    address: string;
  };
}> {
  const prices: any = {};

  for (const token of tokens) {
    try {
      const priceData = await fetchChainlinkPriceForToken(token);

      prices[token.toLowerCase()] = {
        min: priceData.min,
        max: priceData.max,
        blob: priceData.blob,
        oracleType: "chainlinkDataStream",
        address: token,
      };
    } catch (error) {
      console.error(`Failed to fetch price for ${token}:`, error);
      throw error;
    }
  }

  return prices;
}
