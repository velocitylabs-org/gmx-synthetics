import crypto from "crypto";
import urlLib from "url";

import got from "got";
import { BigNumber, ethers } from "ethers";
import hre from "hardhat";

const coder = ethers.utils.defaultAbiCoder;

export type RealtimeFeedReport = {
  feedId: string;
  observationTimestamp: number;
  medianPrice: BigNumber;
  minPrice: BigNumber;
  maxPrice: BigNumber;
  blob: string;
};

type ReportLatestResponse = {
  report: {
    feedID: string;
    validFromTimestamp: number;
    observationsTimestamp: number;
    fullReport: string;
  };
};

function getBaseUrl() {
  if (hre.network.name === "arbitrum") {
    return "https://dataengine.chain.link";
  } else if (hre.network.name === "baseSepolia" || hre.network.name === "arbitrumSepolia") {
    return "https://api.testnet-dataengine.chain.link";
  }
  throw new Error("Unsupported network");
}

function generateHmacString(url: string, body: string, timestamp: number, clientId: string) {
  const method = "GET";
  const parsedUrl = urlLib.parse(url);
  const bodyDigest = crypto.createHash("sha256").update(body).digest("hex");
  return `${method} ${parsedUrl.path} ${bodyDigest} ${clientId} ${timestamp}`;
}

function computeHmacSignature(message: string, clientSecret: string) {
  return crypto.createHmac("sha256", clientSecret).update(message).digest("hex");
}

function signRequest(url: string, clientId: string, clientSecret: string) {
  if (!clientId || !clientSecret) {
    throw new Error("clientId and clientSecret are required");
  }

  const timestamp = Date.now();
  const signatureString = generateHmacString(url, "", timestamp, clientId);
  const signature = computeHmacSignature(signatureString, clientSecret);

  return { timestamp, signature };
}

/**
 * Decode a Chainlink Data Streams signed report blob.
 * Supports both v1/v2 (block-based) and v3+ (fee-based) report schemas,
 * detected automatically from the feedId 2-byte prefix.
 */
export function decodeBlob(blob: string): {
  reportContext: string[];
  report: RealtimeFeedReport;
  rs: string[];
  ss: string[];
  rawVs: string;
} {
  const [reportContext, reportData, rs, ss, rawVs] = coder.decode(
    ["bytes32[3]", "bytes", "bytes32[]", "bytes32[]", "bytes32"],
    blob
  );

  const feedId = coder.decode(["bytes32"], reportData)[0] as string;
  const versionPrefix = parseInt(feedId.slice(2, 6), 16);

  if (versionPrefix <= 2) {
    const [_feedId, observationTimestamp, medianPrice, bid, ask] = coder.decode(
      ["bytes32", "uint32", "int192", "int192", "int192", "uint64", "bytes32", "uint64", "uint64"],
      reportData
    );

    return {
      reportContext,
      report: { feedId: _feedId, observationTimestamp, medianPrice, minPrice: bid, maxPrice: ask, blob },
      rs,
      ss,
      rawVs,
    };
  }

  // v0x0008 (RWA Standard): has lastUpdateTimestamp, midPrice, marketStatus (no bid/ask)
  if (versionPrefix === 8) {
    const decoded = coder.decode(
      ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "uint64", "int192", "uint32"],
      reportData
    );

    const _feedId = decoded[0];
    const observationsTimestamp = decoded[2];
    const midPrice = decoded[7];

    // RWA feeds only have midPrice, use it for both bid and ask
    return {
      reportContext,
      report: {
        feedId: _feedId,
        observationTimestamp: observationsTimestamp,
        medianPrice: midPrice,
        minPrice: midPrice,
        maxPrice: midPrice,
        blob,
      },
      rs,
      ss,
      rawVs,
    };
  }

  // v3+ schema (0x0003, etc.): fee fields with bid/ask
  const decoded = coder.decode(
    ["bytes32", "uint32", "uint32", "uint192", "uint192", "uint32", "int192", "int192", "int192"],
    reportData
  );

  const _feedId = decoded[0];
  const observationsTimestamp = decoded[2];
  const benchmarkPrice = decoded[6];
  const bid = decoded[7];
  const ask = decoded[8];

  return {
    reportContext,
    report: {
      feedId: _feedId,
      observationTimestamp: observationsTimestamp,
      medianPrice: benchmarkPrice,
      minPrice: bid,
      maxPrice: ask,
      blob,
    },
    rs,
    ss,
    rawVs,
  };
}

export async function fetchRealtimeFeedReport({ feedId, clientId, clientSecret }) {
  const baseUrl = getBaseUrl();
  const feedIDParam = feedId.startsWith("0x") ? feedId : `0x${feedId}`;
  const url = `${baseUrl}/api/v1/reports/latest?feedID=${feedIDParam}`;
  const { timestamp, signature } = signRequest(url, clientId, clientSecret);

  const res = await got(url, {
    headers: {
      Authorization: clientId,
      "X-Authorization-Timestamp": String(timestamp),
      "X-Authorization-Signature-SHA256": signature,
    },
    timeout: 30000,
  }).json();

  const data = res as ReportLatestResponse;
  const blob = data.report?.fullReport;
  if (!blob) {
    throw new Error("No fullReport in Data Streams API response");
  }

  return decodeBlob(blob).report;
}
