# Keeper & Oracle Reference

Nivo runs `nivo-keeper` as the off-chain execution bot. It fetches prices from `nivo-api`, which sources from Chainlink Data Streams. The active on-chain oracle provider is `ChainlinkDataStreamProvider.sol`.

---

## How It Works

Users create requests (orders, deposits, withdrawals) — the keeper detects them, fetches current prices, and submits signed prices to execute them on-chain.

```
User → ExchangeRouter.createOrder()
         → Order stored in DataStore, event emitted
             → nivo-keeper detects event
                 → fetches price from nivo-api (Chainlink Data Streams)
                     → OrderHandler.executeOrder(key, oracleParams)
                         → Oracle validates signature + timestamp
                             → Order executes, keeper receives fee
```

The keeper provides the actual execution price. `ChainlinkDataStreamProvider` is just a signed-price validator — not a separate price source.

---

## Keeper Roles

Defined in [Role.sol](../contracts/role/Role.sol):

| Role | Handler | What it executes |
|------|---------|-----------------|
| `ORDER_KEEPER` | [OrderHandler](../contracts/exchange/OrderHandler.sol#L249), [DepositHandler](../contracts/exchange/DepositHandler.sol#L105), [WithdrawalHandler](../contracts/exchange/WithdrawalHandler.sol#L106) | Orders, deposits, withdrawals, shifts |
| `LIQUIDATION_KEEPER` | [LiquidationHandler](../contracts/exchange/LiquidationHandler.sol#L55) | Underwater positions |
| `ADL_KEEPER` | [AdlHandler](../contracts/exchange/AdlHandler.sol#L64) | Auto-deleveraging when pool PnL exceeds threshold |
| `FROZEN_ORDER_KEEPER` | [OrderHandler](../contracts/exchange/OrderHandler.sol#L427) | Orders that failed and need retry |
| `FEE_KEEPER` | [FeeHandler](../contracts/fee/FeeHandler.sol) | Fee claims |

---

## Events Keepers Listen To

All events via [EventEmitter](../contracts/event/EventEmitter.sol):

| Event | Action |
|-------|--------|
| `DepositCreated` | Execute deposit |
| `WithdrawalCreated` | Execute withdrawal |
| `OrderCreated` | Execute order |
| `OrderFrozen` | Execute with `FROZEN_ORDER_KEEPER` role |
| `ShiftCreated` | Execute shift |
| `GlvDepositCreated` | Execute GLV deposit |
| `GlvWithdrawalCreated` | Execute GLV withdrawal |

---

## Oracle Price Flow

`nivo-keeper` does **not** fetch from Chainlink directly — it calls `nivo-api`, which handles the Chainlink Data Stream integration and returns formatted prices.

```
nivo-api (Chainlink Data Streams integration)
    → nivo-keeper signs OracleUtils.SetPricesParams
        → Oracle.setPrices() validates:
            1. Signer is authorized (OracleStore)
            2. Timestamp is fresh (< MAX_ORACLE_PRICE_AGE)
            3. Sanity check against reference (not configured for Nivo — skipped)
        → Prices stored for execution duration
        → Oracle.clearAllPrices() after execution
```

`SetPricesParams` structure ([OracleUtils.sol](../contracts/oracle/OracleUtils.sol)):
```solidity
struct SetPricesParams {
    address[] tokens;      // tokens to price
    address[] providers;   // ChainlinkDataStreamProvider for all Nivo tokens
    bytes[] data;          // encoded price data with signatures
}
```

### Active Oracle Provider

**[ChainlinkDataStreamProvider.sol](../contracts/oracle/ChainlinkDataStreamProvider.sol)** — the only provider deployed and used by Nivo.

### Out of Scope — Do Not Use

| Contract | Reason |
|----------|--------|
| `ChainlinkPriceFeedProvider.sol` | Legacy Chainlink price feeds — not used by Nivo |
| `EdgeDataStreamProvider.sol` | Chaos Labs integration — not deployed on Nivo |
| `GmOracleProvider.sol` | Hardhat local testing only — status uncertain for production |

### Price Inversion (BRL, MXN, COP)

Chainlink Data Streams for some EMFX pairs publish prices in **USD/FX convention** (e.g., USD/BRL ≈ 5.7) rather than FX/USD (BRL/USD ≈ 0.175). `ChainlinkDataStreamProvider._processV8Report()` handles inversion automatically via the `DATA_STREAM_INVERSION_SCALE` key (`10^24`):

- Tokens configured with `DATA_STREAM_INVERSION_SCALE` in `DataStore` have their feed price inverted before use.
- The keeper and `nivo-api` receive already-corrected FX/USD prices — no inversion needed outside the contract.

---

## Sanity Check Behavior for Synthetic Tokens

Not configured for any Nivo synthetic token (BRL, MXN, COP, IDR, PHP, PEN, NGN, KES, ZAR, THB, GBP). The check is **automatically skipped** — `hasRefPrice` is always `false` because no `priceFeed` is set in `config/tokens.ts` for these tokens, so nothing is written to `DataStore`:

```solidity
// Oracle.sol
(bool hasRefPrice, uint256 refPrice) =
    ChainlinkPriceFeedUtils.getPriceFeedPrice(dataStore, token);

if (hasRefPrice) {  // false for all Nivo synthetic tokens → skipped
    _validateRefPrice(...);
}
```

| Token config | Sanity check |
|-------------|-------------|
| Has `priceFeed` property | Enabled |
| No `priceFeed` (all Nivo synthetics) | Skipped — `hasRefPrice = false` |

**Localhost behavior:** `GmOracleProvider` validates signatures from test signers; sanity check skipped for the same reason (no feeds configured).

---

## Execution Fee System

Users include `executionFee` when creating requests. Keepers are reimbursed from this fee; the remainder is refunded to the user.

```solidity
// contracts/gas/GasUtils.sol:146
uint256 gasUsed = startingGas - gasleft();
uint256 executionFeeForKeeper = adjustGasUsage(dataStore, gasUsed) * tx.gasprice;
```

Relevant functions in [GasUtils.sol](../contracts/gas/GasUtils.sol):
- `validateExecutionGas` — ensures sufficient gas was provided
- `payExecutionFee` — pays keeper, refunds user
- `estimateExecuteOrderGasLimit` / `estimateExecuteDepositGasLimit` — gas estimation helpers

Key DataStore keys ([Keys.sol](../contracts/data/Keys.sol)):

| Key | Purpose |
|-----|---------|
| `EXECUTION_GAS_FEE_BASE_AMOUNT_V2_1` | Base gas for fee calculation |
| `EXECUTION_GAS_FEE_PER_ORACLE_PRICE` | Additional gas per oracle price |
| `MAX_ORACLE_PRICE_AGE` | Maximum price timestamp age |
| `MAX_ORACLE_REF_PRICE_DEVIATION_FACTOR` | Max deviation from reference |
| `REQUEST_EXPIRATION_TIME` | Time before request can be cancelled (default: 300s) |
