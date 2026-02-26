/**
 * Verifies that all preconditions for executing a Nivo market deposit are met.
 * Corresponds to the "First deposit execution – what must be confirmed" checklist.
 *
 * Usage:
 *   DEPOSIT_KEY=0x... npx hardhat run scripts/verifyDepositExecutionReadiness.ts --network baseSepolia
 *   (omit DEPOSIT_KEY to use the first available deposit)
 */
import hre from "hardhat";
import { getDepositKeys } from "../utils/deposit";
import { fetchSignedPricesBaseSepolia } from "../utils/pricesBaseSepolia";
import { hashString } from "../utils/hash";
import {
  dataStreamIdKey,
  dataStreamMultiplierKey,
  minMarketTokensForFirstDeposit,
  REQUEST_EXPIRATION_TIME,
  isMarketDisabledKey,
} from "../utils/keys";
import { FLOAT_PRECISION } from "../utils/math";

const RECEIVER_FOR_FIRST_DEPOSIT = "0x0000000000000000000000000000000000000001";
const { ethers } = hre;

function toContractPrice(rawMin: any, rawMax: any, multiplier: any) {
  const min = ethers.BigNumber.from(rawMin.toString());
  const max = ethers.BigNumber.from(rawMax.toString());
  const mult = ethers.BigNumber.from(multiplier.toString());
  return {
    min: min.mul(mult).div(FLOAT_PRECISION),
    max: max.mul(mult).div(FLOAT_PRECISION),
  };
}

/** Deposit.Addresses: account=0, receiver=1, callbackContract=2, uiFeeReceiver=3, market=4, ... */
function addr(deposit: any, key: "account" | "receiver" | "uiFeeReceiver" | "market", index: number): string {
  const a = deposit?.addresses;
  if (!a) return ethers.constants.AddressZero;
  const v = a[key] ?? (typeof a[index] !== "undefined" ? a[index] : undefined);
  return v && ethers.utils.isAddress(v) ? v : ethers.constants.AddressZero;
}
/** Deposit.Numbers: initialLongTokenAmount=0, initialShortTokenAmount=1, minMarketTokens=2, updatedAtTime=3, ... */
function num(deposit: any, key: string, index: number): any {
  const n = deposit?.numbers;
  if (!n) return undefined;
  return n[key] ?? n[index];
}

type CheckResult = { ok: boolean; message: string };

async function main() {
  const results: { name: string; result: CheckResult }[] = [];

  // Resolve deposit key
  const dataStore = await ethers.getContract("DataStore");
  const reader = await ethers.getContract("Reader");

  let depositKey: string;
  const depositKeyFromEnv = process.env.DEPOSIT_KEY;
  if (depositKeyFromEnv) {
    depositKey = depositKeyFromEnv;
  } else {
    const depositKeys = await getDepositKeys(dataStore, 0, 1);
    if (depositKeys.length === 0) {
      console.error("No deposits found. Create a deposit first or set DEPOSIT_KEY.");
      process.exit(1);
    }
    depositKey = depositKeys[0];
  }

  const deposit = await reader.getDeposit(dataStore.address, depositKey);

  const marketTokenAddress = addr(deposit, "market", 4);
  const market = await reader.getMarket(dataStore.address, marketTokenAddress);
  const indexToken = market.indexToken;
  const longToken = market.longToken;
  const shortToken = market.shortToken;
  const uniqueTokens = Array.from(new Set([indexToken, longToken, shortToken].map((a) => a.toLowerCase()))).map((a) =>
    ethers.utils.getAddress(a)
  );

  // --- Check 1: Keeper role ---
  const keeperPrivateKey = process.env.NIVO_KEEPER_PRIVATE_KEY;
  if (!keeperPrivateKey) {
    results.push({
      name: "1. Keeper role",
      result: { ok: false, message: "NIVO_KEEPER_PRIVATE_KEY is not set." },
    });
  } else {
    const roleStore = await ethers.getContract("RoleStore");
    const keeperWallet = new ethers.Wallet(keeperPrivateKey, ethers.provider);
    const ORDER_KEEPER = hashString("ORDER_KEEPER");
    const hasRole = await roleStore.hasRole(keeperWallet.address, ORDER_KEEPER);
    results.push({
      name: "1. Keeper role",
      result: hasRole
        ? { ok: true, message: `Wallet ${keeperWallet.address} has ORDER_KEEPER.` }
        : { ok: false, message: `Wallet ${keeperWallet.address} does not have ORDER_KEEPER.` },
    });
  }

  // --- Check 2: DataStore oracle config for all tokens ---
  const missingTokens: string[] = [];
  for (const token of uniqueTokens) {
    const feedId = await dataStore.getBytes32(dataStreamIdKey(token));
    const multiplier = await dataStore.getUint(dataStreamMultiplierKey(token));
    if (feedId === ethers.constants.HashZero || multiplier.isZero()) {
      missingTokens.push(token);
    }
  }
  if (missingTokens.length > 0) {
    results.push({
      name: "2. DataStore oracle config",
      result: {
        ok: false,
        message: `Missing dataStreamId or dataStreamMultiplier for: ${missingTokens.join(", ")}`,
      },
    });
  } else {
    results.push({
      name: "2. DataStore oracle config",
      result: {
        ok: true,
        message: `dataStreamId and dataStreamMultiplier set for all tokens (${uniqueTokens.length} unique).`,
      },
    });
  }

  // --- Check 3: Chainlink env and ability to fetch prices ---
  const hasClientId = !!process.env.CHAINLINK_CLIENT_ID;
  const hasClientSecret = !!process.env.CHAINLINK_CLIENT_SECRET;
  if (!hasClientId || !hasClientSecret) {
    results.push({
      name: "3. Chainlink credentials and price fetch",
      result: {
        ok: false,
        message: "CHAINLINK_CLIENT_ID and/or CHAINLINK_CLIENT_SECRET not set.",
      },
    });
  } else {
    try {
      const tokensForPrices = [indexToken, longToken, shortToken];
      await fetchSignedPricesBaseSepolia(tokensForPrices);
      results.push({
        name: "3. Chainlink credentials and price fetch",
        result: { ok: true, message: "Credentials set; signed prices fetched for index, long, short tokens." },
      });
    } catch (e: any) {
      results.push({
        name: "3. Chainlink credentials and price fetch",
        result: { ok: false, message: `Failed to fetch signed prices: ${e?.message ?? e}` },
      });
    }
  }

  // --- Check 4: First-deposit rules ---
  const marketTokenContract = await ethers.getContractAt("MarketToken", marketTokenAddress);
  const supply = await marketTokenContract.totalSupply();
  const requiredMinFirstDeposit = await dataStore.getUint(minMarketTokensForFirstDeposit(marketTokenAddress));

  if (supply.isZero() && requiredMinFirstDeposit.gt(0)) {
    const receiverOk = addr(deposit, "receiver", 1).toLowerCase() === RECEIVER_FOR_FIRST_DEPOSIT.toLowerCase();
    const minOk = (num(deposit, "minMarketTokens", 2) ?? ethers.BigNumber.from(0)).gte(requiredMinFirstDeposit);
    if (!receiverOk || !minOk) {
      results.push({
        name: "4. First-deposit rules",
        result: {
          ok: false,
          message: `First deposit (supply=0) with minMarketTokensForFirstDeposit=${requiredMinFirstDeposit.toString()}: receiver=${
            receiverOk ? "ok" : "must be 0x00...01"
          }, minMarketTokens=${minOk ? "ok" : "must be >= " + requiredMinFirstDeposit.toString()}.`,
        },
      });
    } else {
      results.push({
        name: "4. First-deposit rules",
        result: { ok: true, message: "First deposit: receiver=0x00...01 and minMarketTokens >= required." },
      });
    }
  } else {
    results.push({
      name: "4. First-deposit rules",
      result: {
        ok: true,
        message: supply.gt(0)
          ? "Not first deposit (supply > 0)."
          : "minMarketTokensForFirstDeposit is 0; no first-deposit check.",
      },
    });
  }

  // --- Check 5: Oracle timestamp window ---
  const requestExpirationTime = await dataStore.getUint(REQUEST_EXPIRATION_TIME);
  const updatedAtTime = num(deposit, "updatedAtTime", 3) ?? ethers.BigNumber.from(0);
  const expiryTime = updatedAtTime.add(requestExpirationTime);
  const now = ethers.BigNumber.from(Math.floor(Date.now() / 1000));
  const withinWindow = now.lte(expiryTime);
  results.push({
    name: "5. Oracle timestamp window",
    result: withinWindow
      ? {
          ok: true,
          message: `Deposit valid until ${expiryTime.toString()} (requestExpirationTime=${requestExpirationTime.toString()}s).`,
        }
      : { ok: false, message: `Deposit expired at ${expiryTime.toString()}; now=${now.toString()}.` },
  });

  // --- Check 6: minMarketTokens achievable (optional: estimate via Reader if we have prices) ---
  let check6Message: string;
  let check6Ok = true;
  if (process.env.CHAINLINK_CLIENT_ID && process.env.CHAINLINK_CLIENT_SECRET) {
    try {
      const signedPrices = await fetchSignedPricesBaseSepolia([indexToken, longToken, shortToken]);
      const indexMult = await dataStore.getUint(dataStreamMultiplierKey(indexToken));
      const longMult = await dataStore.getUint(dataStreamMultiplierKey(longToken));
      const shortMult = await dataStore.getUint(dataStreamMultiplierKey(shortToken));
      const marketPrices = {
        indexTokenPrice: toContractPrice(
          signedPrices[indexToken.toLowerCase()].min,
          signedPrices[indexToken.toLowerCase()].max,
          indexMult
        ),
        longTokenPrice: toContractPrice(
          signedPrices[longToken.toLowerCase()].min,
          signedPrices[longToken.toLowerCase()].max,
          longMult
        ),
        shortTokenPrice: toContractPrice(
          signedPrices[shortToken.toLowerCase()].min,
          signedPrices[shortToken.toLowerCase()].max,
          shortMult
        ),
      };
      const initialLong = num(deposit, "initialLongTokenAmount", 0) ?? ethers.BigNumber.from(0);
      const initialShort = num(deposit, "initialShortTokenAmount", 1) ?? ethers.BigNumber.from(0);
      const estimatedMarketTokens = await reader.getDepositAmountOut(
        dataStore.address,
        market, // Market.Props struct (marketToken, indexToken, longToken, shortToken)
        marketPrices,
        initialLong,
        initialShort,
        addr(deposit, "uiFeeReceiver", 3),
        3, // SwapPricingType.Deposit
        true
      );
      const minRequired = num(deposit, "minMarketTokens", 2) ?? ethers.BigNumber.from(0);
      if (estimatedMarketTokens.lt(minRequired)) {
        check6Ok = false;
        check6Message = `Estimated market tokens ${estimatedMarketTokens.toString()} < deposit.minMarketTokens ${minRequired.toString()}. Increase deposit size or lower minMarketTokens.`;
      } else {
        check6Message = `Estimated market tokens ${estimatedMarketTokens.toString()} >= minMarketTokens ${minRequired.toString()}.`;
      }
    } catch (e: any) {
      check6Message = `Could not estimate (e.g. missing prices): ${
        e?.message ?? e
      }. Run execute script dry-run to confirm.`;
    }
  } else {
    check6Message = "Skipped (set CHAINLINK_CLIENT_ID/SECRET to estimate receivedMarketTokens vs minMarketTokens).";
  }
  results.push({
    name: "6. minMarketTokens achievable",
    result: { ok: check6Ok, message: check6Message },
  });

  // --- Check 7: Market enabled ---
  const isDisabled = await dataStore.getBool(isMarketDisabledKey(marketTokenAddress));
  results.push({
    name: "7. Market enabled",
    result: !isDisabled
      ? { ok: true, message: "Market is enabled." }
      : { ok: false, message: "Market is disabled in DataStore." },
  });

  // --- Check 8: Deposit key and state ---
  const depositAccount = addr(deposit, "account", 0);
  if (depositAccount === ethers.constants.AddressZero) {
    results.push({
      name: "8. Deposit key and state",
      result: { ok: false, message: "Deposit not found or already executed (account is zero)." },
    });
  } else {
    results.push({
      name: "8. Deposit key and state",
      result: { ok: true, message: `Deposit exists; account=${depositAccount}` },
    });
  }

  // --- Print summary ---
  console.log("\n=== Deposit execution readiness ===\n");
  console.log("Deposit key:", depositKey);
  console.log("Market (market token):", marketTokenAddress);
  console.log("");

  for (const { name, result } of results) {
    const status = result.ok ? "PASS" : "FAIL";
    console.log(`[${status}] ${name}`);
    console.log(`     ${result.message}`);
  }

  const allPass = results.every((r) => r.result.ok);
  console.log("");
  if (allPass) {
    console.log("All checks passed. You can run executeDepositNivoMarket.ts (with same DEPOSIT_KEY if used).");
  } else {
    console.log("Some checks failed. Address the failures above before executing the deposit.");
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((ex) => {
    console.error(ex);
    process.exit(1);
  });
