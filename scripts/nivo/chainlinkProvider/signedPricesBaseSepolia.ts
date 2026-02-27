import { ethers } from "hardhat";
import { DataStreamsClient } from "@chainlink/data-streams-sdk";
import { dataStreamIdKey } from "../../../utils/keys";
import { fetchDataStreamReport } from "./chainlinkReportFetcher";
import { getDataStreamsClient } from "./client";

export interface PriceData {
  min: bigint;
  max: bigint;
  report: string;
}

export interface SignedPrices {
  [tokenAddress: string]: PriceData;
}

export async function fetchChainlinkPriceForToken(tokenAddress: string, client: DataStreamsClient): Promise<PriceData> {
  const dataStore = await ethers.getContract("DataStore");
  const dataStreamIdBytes32 = await dataStore.getBytes32(dataStreamIdKey(tokenAddress));

  if (dataStreamIdBytes32 === ethers.constants.HashZero) {
    throw new Error(`No Data Stream ID configured for token ${tokenAddress}.`);
  }

  const dataStreamId = ethers.utils.hexlify(dataStreamIdBytes32);
  return await fetchDataStreamReport(client, dataStreamId, tokenAddress);
}

export async function fetchSignedPricesBaseSepolia(tokens: string[]): Promise<SignedPrices> {
  const prices: SignedPrices = {};
  const client = getDataStreamsClient();

  for (const token of tokens) {
    try {
      const priceData = await fetchChainlinkPriceForToken(token, client);
      prices[token.toLowerCase()] = {
        min: priceData.min,
        max: priceData.max,
        report: priceData.report,
      };
    } catch (error) {
      console.error(`Failed to fetch price for ${token}:`, error);
      throw error;
    }
  }

  return prices;
}
