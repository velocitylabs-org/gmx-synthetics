import { DataStreamsClient, decodeReport } from "@chainlink/data-streams-sdk";

export interface PriceData {
  min: bigint; // min price in 30-decimal precision
  max: bigint; // max price in 30-decimal precision
  report: string; // fullReport hex for on-chain verification
}

export async function fetchDataStreamReport(
  client: DataStreamsClient,
  dataStreamId: string,
  tokenAddress: string,
  tokenDecimals: number
): Promise<PriceData> {
  try {
    const report = await client.getLatestReport(dataStreamId);
    const decoded = decodeReport(report.fullReport, report.feedID);

    let minPrice: bigint;
    let maxPrice: bigint;

    if ("bid" in decoded && "ask" in decoded) {
      // V3 report with bid/ask
      const bid = Number(decoded.bid) / 10 ** 18; // Data Streams uses 18 decimals
      const ask = Number(decoded.ask) / 10 ** 18;
      minPrice = toProtocolPrice(bid, tokenDecimals);
      maxPrice = toProtocolPrice(ask, tokenDecimals);
    } else if ("midPrice" in decoded) {
      // V8 report with midPrice - use the same price for min/max (no spread)
      const mid = Number(decoded.midPrice) / 10 ** 18;
      minPrice = toProtocolPrice(mid, tokenDecimals);
      maxPrice = toProtocolPrice(mid, tokenDecimals);
    } else {
      throw new Error(`Unsupported report format`);
    }

    return {
      min: minPrice,
      max: maxPrice,
      report: report.fullReport,
    };
  } catch (error) {
    console.error(`Failed to fetch ${tokenAddress} Oracle report:`, error);
    throw error;
  }
}

function toProtocolPrice(usdPrice: number, tokenDecimals: number): bigint {
  const precision = 30 - tokenDecimals;
  return BigInt(Math.floor(usdPrice * 10 ** precision));
}
