# Deploying Nivo protocol on Base Sepolia

## Prerequisites

- Node.js + npm installed
- Repo dependencies installed
```typescript
npm install
```
- Verify the protocol compiles & tests succeed
- Set the `.env` same as the `.env.example`
```typescript
# Deployment
HARDHAT_NETWORK
SKIP_AUTO_HANDLER_REDEPLOYMENT

# Wallets
BASE_SEPOLIA_DEPLOYER_ADDRESS
BASE_SEPOLIA_DEPLOYER_PRIVATE_KEY
NIVO_KEEPER_ADDRESS
NIVO_KEEPER_PRIVATE_KEY

# API Keys
BASESCAN_API_KEY
```
- Fund the deployer EOA (BASE_SEPOLIA_DEPLOYER_ADDRESS) with Base Sepolia ETH (for gas) - 1 ETH is enough

## ⛓️ Run the Deployment

Deployment should cost ~0.0020 ETH total to deploy the entire protocol and take ~30 minutes end-to-end.

⚠️ See footnote*, before running this script.

```typescript
pnpm hardhat deploy --network baseSepolia
```

## Run the oracle config verification script:
```typescript
pnpm hardhat run scripts/updateOracleConfig.ts --network baseSepolia
```

This should it prints the oracle configuration & all parameters should be up to date (no diffs required).

If the printed config indicates mismatches, re-run with WRITE=true to apply updates on-chain:

```typescript
WRITE=true pnpm hardhat run scripts/updateOracleConfig.ts --network baseSepolia
```
## Print Protocol State (Sanity Checks)

After deployment, print a few protocol items to confirm everything is wired correctly:

```typescript
pnpm hardhat run scripts/printMarkets.ts --network baseSepolia
pnpm hardhat run scripts/printTokens.ts --network baseSepolia
pnpm hardhat run scripts/printGeneralConfig.ts --network baseSepolia
pnpm hardhat run scripts/printRoles.ts --network baseSepolia
```

Purpose:
- markets exist and addresses look correct
- token config is correct (decimals, addresses, etc.)
- general config keys are set as expected
- roles are assigned to the right actors (keepers / config / etc.)


## Verify Contracts on BaseScan

After deployment, verify contracts on BaseScan (~30 minutes):
```typescript
pnpm hardhat etherscan-verify --network baseSepolia
```

## Fund the Chainlink Oracle Provider contract with Links

Look for the contract address & ABI in `deployments/baseSepolia/ChainlinkDataStreamProvider.json`

Get Links here: https://faucets.chain.link/base-sepolia

### Notes*

The deployment required a couple of code updates to succeed:

`validateMarketConfigsUtils.ts` failed to deploy:
- It required an update to `config/markets` to satisfy this check:
``` typescript
  if (longTokenSymbol === shortTokenSymbol) {
    if (!marketConfig.negativeSwapImpactFactor.eq(0)) {
      throw new Error("negativeSwapImpactFactor should be zero");
    }

    if (!marketConfig.positiveSwapImpactFactor.eq(0)) {
      throw new Error("negativeSwapImpactFactor should be zero");
    }

    return;
  }
 ```

- It also required to add BaseSepolia entry to the validateMarketConfigsUtils.ts

See -> [Github](https://github.com/velocitylabs-org/gmx-synthetics/commit/f8ceef9b9f2401548c17c0bb1260b1b7948207d4)
