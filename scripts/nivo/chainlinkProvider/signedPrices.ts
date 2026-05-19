import { ethers, gmx } from "hardhat";
import { DataStreamsClient } from "@chainlink/data-streams-sdk";
import { dataStreamIdKey } from "../../../utils/keys";
import { fetchDataStreamReport } from "./chainlinkReportFetcher";
import { getDataStreamsClient } from "./client";
import { TokensConfig } from "../../../config/tokens";

export interface PriceData {
  min: bigint;
  max: bigint;
  report: string;
}

export interface SignedPrices {
  [tokenAddress: string]: PriceData;
}

export async function fetchChainlinkPriceForToken(client: DataStreamsClient, tokensConfig: TokensConfig, tokenAddress: string): Promise<PriceData> {
  const dataStore = await ethers.getContract("DataStore");
  const dataStreamIdBytes32 = await dataStore.getBytes32(dataStreamIdKey(tokenAddress));

  if (dataStreamIdBytes32 === ethers.constants.HashZero) {
    throw new Error(`No Data Stream ID configured for token ${tokenAddress}.`);
  }

  const dataStreamId = ethers.utils.hexlify(dataStreamIdBytes32);
  const tokenConfig = Object.values(tokensConfig).find(t => t.dataStreamFeedId === dataStreamId);
  if (!tokenConfig) {
    throw new Error(`No token config found for token ${tokenAddress}.`);
  }
  return await fetchDataStreamReport(client, dataStreamId, tokenAddress, tokenConfig.decimals);
}

export async function fetchOracleSignedPrices(tokens: string[]): Promise<SignedPrices> {
  const prices: SignedPrices = {};
  const client = getDataStreamsClient();
  const tokensConfig = await gmx.getTokens();

  for (const token of tokens) {
    try {
      const priceData = await fetchChainlinkPriceForToken(client, tokensConfig, token);
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
