import { createClient } from "@chainlink/data-streams-sdk";

export const DATA_STREAM_CONFIG = {
  endpoint: process.env.CHAINLINK_DATA_STREAM_ENDPOINT,
  wsEndpoint: process.env.CHAINLINK_DATA_STREAM_WS_ENDPOINT,
  provider: process.env.CHAINLINK_DATA_STREAM_PROVIDER_ADDRESS,
};

type DataStreamsClient = ReturnType<typeof createClient>;

let client: DataStreamsClient | null = null;

export function getDataStreamsClient(): DataStreamsClient {
  if (client) return client;

  const apiKey = process.env.CHAINLINK_CLIENT_ID;
  const userSecret = process.env.CHAINLINK_CLIENT_SECRET;

  if (!apiKey || !userSecret) {
    throw new Error("Missing CHAINLINK_CLIENT_ID or CHAINLINK_CLIENT_SECRET");
  }

  if (!DATA_STREAM_CONFIG.endpoint) {
    throw new Error("CHAINLINK_DATA_STREAM_ENDPOINT is not configured");
  }

  client = createClient({
    apiKey,
    userSecret,
    endpoint: DATA_STREAM_CONFIG.endpoint,
    wsEndpoint: DATA_STREAM_CONFIG.wsEndpoint!,
    retryAttempts: 2,
  });

  return client;
}
