# Adding Liquidity to a Nivo FX Market

Liquidity deposits use a two-step process: you create a deposit request on-chain, then the keeper executes it (sets the oracle price and mints GM tokens). In normal operation the keeper runs automatically both on Base Mainnet & Base Sepolia. You only need step 3 if the keeper is stopped, down or you're debugging.

---

## Prerequisites

**Wallet:** The wallet derived from `LP_WALLET_PRIVATE_KEY` must hold sufficient USDC on the target network.
⚠️ Verify `LP_WALLET_PRIVATE_KEY` in Doppler via the dashboard (doppler.com) for stg (testnet) and prd (mainnet) configs before running this script.

**Environment variables (injected by Doppler):**
| Variable | Purpose |
|---|---|
| `LP_WALLET_PRIVATE_KEY` | Private key of the wallet that creates the deposit — address is derived automatically |
| `RPC_URL` | RPC endpoint injected into Hardhat network config (Alchemy/Infura) — not read directly by the script |

**Script variables (passed on the command line):**
| Variable | Default | Purpose |
|---|---|---|
| `FX_CURRENCY` | required | Market to deposit into (e.g. `BRL`, `MXN`, `COP`) |
| `LG_TOKEN_AMOUNT` | `10` | Long token amount in USDC |
| `ST_TOKEN_AMOUNT` | `10` | Short token amount in USDC |
| `NETWORK` | required | `baseSepolia` or `base` |
| `DOPPLER_CONFIG` | required | `stg` for testnet, `prd` for mainnet |

Note: Both LG_TOKEN_AMOUNT & ST_TOKEN_AMOUNT are required as we fund the pool equally. 

---

## 1. Create the deposit

Example for a 1000 USD deposit into Base Sepolia BRL/USD pool. Replace with the desired values. 

```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia FX_CURRENCY=BRL LG_TOKEN_AMOUNT=500 ST_TOKEN_AMOUNT=500 pnpm run deposit:liquidity
```

The script logs the deposit key on success. The deposit request is now stored on-chain in the DataStore, waiting to be executed by the keeper.

## 2. Wait for keeper execution (normal path)

The Nivo keeper monitors pending deposits and executes them automatically. 
Once executed, the deposit disappears from the `printDeposits` list and GM tokens are minted to your wallet.

Run `printDeposits.ts` again to confirm it's gone.

### If the deposit is pending, you can verify it here:

```bash
doppler run -p nivo -c stg -- pnpm hardhat run scripts/printDeposits.ts --network baseSepolia

doppler run -p nivo -c prd -- pnpm hardhat run scripts/printDeposits.ts --network base
```

If the deposit is still pending it should appear in the list with its key and amounts.
Most of the time the keeper execution is fast enough so you don't see it.

---

## 3. Manual execution (debug only — keeper not running)

If the keeper is down or you're testing locally without a running keeper:

**Execute the first pending deposit automatically:**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia pnpm run deposit:execute
```

**Execute a specific deposit by key:**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia DEPOSIT_KEY=<key from step 1> pnpm run deposit:execute
```

If no `DEPOSIT_KEY` is provided, the script automatically picks the first pending deposit from the DataStore. This uses `NIVO_KEEPER_PRIVATE_KEY`  from Doppler — only use this if the keeper is not running.

---

## Trouble shooting

### Cancel a stale deposit

If a deposit is stale/stuck (keeper is down, execution failed, or you want to abort), you can cancel it to get your USDC back.

**Cancel all pending deposits for your wallet:**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia pnpm run deposit:cancel
```

**Cancel a specific deposit by key:**
```bash
DOPPLER_CONFIG=stg NETWORK=baseSepolia DEPOSIT_KEY=<key> pnpm run deposit:cancel
```

If no `DEPOSIT_KEY` is provided, all pending deposits for the wallet derived from `LP_WALLET_PRIVATE_KEY` are cancelled. Only the account that created the deposit can cancel it.

### Active markets

Only deposits into active markets will be executed. Inactive markets are disabled on-chain:

| Status | Markets |
|---|---|
| Active | BRL, MXN, COP, GBP |
| Inactive (no oracle feed) | IDR, PHP, PEN, NGN, KES, ZAR, THB |
