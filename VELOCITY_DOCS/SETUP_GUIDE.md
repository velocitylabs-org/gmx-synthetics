# Nivo Protocol Setup Guide

How to run the Nivo protocol locally (Hardhat), on testnet (Base Sepolia), and on mainnet (Base).

---

## Prerequisites

- **Node.js 24 LTS** (I recommend using [mise](https://mise.jdx.dev/) for runtime management)
- **An Ethereum wallet** (MetaMask or any browser wallet)
- **Git**

## Clone the Repositories

All repos must be siblings in the same parent directory:

```bash
mkdir nivo && cd nivo

git clone https://github.com/velocitylabs-org/gmx-synthetics.git
git clone https://github.com/velocitylabs-org/nivo-api.git
git clone https://github.com/velocitylabs-org/nivo-keeper.git
git clone https://github.com/velocitylabs-org/nivo-dashboard.git
```

Install dependencies in each repo:

```bash
cd gmx-synthetics && npm install && cd ..
cd nivo-api && npm install && cd ..
cd nivo-keeper && npm install && cd ..
cd nivo-dashboard && npm install && cd ..
```

---

## 1. Localhost (Hardhat)

### Environment Files

You need `.env.localhost` for the API, keeper, and dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

- `nivo-api/.env.localhost`
- `nivo-keeper/.env.localhost`
- `nivo-dashboard/.env.localhost`

### Start the Local Blockchain

Open a terminal in `gmx-synthetics/`:

```bash
npx hardhat node
```

Wait ~3 minutes for the deployment to finish. You'll see contract addresses being logged.

Then, in a **new terminal** (still in `gmx-synthetics/`):

```bash
SKIP_AUTO_HANDLER_REDEPLOYMENT=true npx hardhat deploy --network localhost
```

Wait for this to complete before moving on.

### Start the API

Open a terminal in `nivo-api/`:

```bash
npm run dev
```

This runs `sync-env` first (populates contract addresses from the Hardhat deployment into `.env.localhost`) and then starts the API on **http://localhost:3002**.

> **Note:** The API must be running before the keeper. The keeper fetches all prices from the API — without it, the keeper can't execute any operations.

### Start the Keeper

Open a terminal in `nivo-keeper/`:

```bash
npm run dev
```

> **Note:** `npm run dev` runs `setup-localhost` which syncs contract addresses, grants keeper roles, and cleans up stale requests. You need to re-run it every time you restart `hardhat node` (new instance = new contract addresses).

### Start the Dashboard

Open a terminal in `nivo-dashboard/`:

```bash
npm run dev
```

Open **http://localhost:5173/** in your browser. Connect any Ethereum wallet, you'll automatically receive test USDC and ETH on the Hardhat network so you can add liquidity and create positions.

### Summary (5 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `gmx-synthetics/` | `npx hardhat node` |
| 2 | `gmx-synthetics/` | `SKIP_AUTO_HANDLER_REDEPLOYMENT=true npx hardhat deploy --network localhost` |
| 3 | `nivo-api/` | `npm run dev` |
| 4 | `nivo-keeper/` | `npm run dev` |
| 5 | `nivo-dashboard/` | `npm run dev` |

---

## 2. Testnet (Base Sepolia)

### Environment Files

You need `.env.testnet` for the API, keeper, and dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

- `nivo-api/.env.testnet`
- `nivo-keeper/.env.testnet`
- `nivo-dashboard/.env.testnet`

### Start the API

The protocol is already deployed on Base Sepolia, no need to run anything in `gmx-synthetics/`.

Open a terminal in `nivo-api/`:

```bash
npm run dev-testnet
```

This syncs contract addresses from the Base Sepolia deployment and starts the API on **http://localhost:3002**.

### Start the Keeper

Open a terminal in `nivo-keeper/`:

```bash
npm run dev-testnet
```

### Start the Dashboard

Open a terminal in `nivo-dashboard/`:

```bash
npm run dev-testnet
```

Open **http://localhost:5173/** — the dashboard is now pointing to the protocol running on Base Sepolia testnet.

### Testnet Wallet Setup

To create liquidity and positions on testnet you need a wallet with **ETH and USDC on Base Sepolia**. Ask **@victor** on Slack for access to the right wallets.

### Summary (3 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `nivo-api/` | `npm run dev-testnet` |
| 2 | `nivo-keeper/` | `npm run dev-testnet` |
| 3 | `nivo-dashboard/` | `npm run dev-testnet` |

## 3. Mainnet (Base)

### Environment Files

You need `.env.mainnet` for the API, keeper, and dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

- `nivo-api/.env.mainnet`
- `nivo-keeper/.env.mainnet`
- `nivo-dashboard/.env.mainnet`

### Start the API

The protocol must already be deployed on Base. No need to run anything in `gmx-synthetics/`.

Open a terminal in `nivo-api/`:

```bash
npm run dev-mainnet
```

### Start the Keeper

Open a terminal in `nivo-keeper/`:

```bash
npm run dev-mainnet
```

### Start the Dashboard

Open a terminal in `nivo-dashboard/`:

```bash
npm run dev-mainnet
```

Open **http://localhost:5173/** — the dashboard is now pointing to the protocol running on Base mainnet.

### Mainnet Wallet Setup

To create liquidity and positions on mainnet you need a wallet with **real ETH and USDC on Base**. This is real money — be careful with amounts.

### Summary (3 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `nivo-api/` | `npm run dev-mainnet` |
| 2 | `nivo-keeper/` | `npm run dev-mainnet` |
| 3 | `nivo-dashboard/` | `npm run dev-mainnet` |

---

## How the Services Connect

```
nivo-api (port 3002)
  ├── Fetches prices from Chainlink Data Streams
  ├── Serves GET /api/markets (market metadata)
  └── Serves GET /api/prices?symbols=GBP,USDC (prices for keeper + web app)

nivo-keeper
  ├── Polls blockchain for pending orders/deposits/withdrawals
  ├── Fetches prices from nivo-api (not Chainlink directly)
  ├── Executes transactions on GMX V2 contracts
  └── Monitors positions for liquidation

nivo-dashboard / nivo-web-app
  ├── Creates requests via ExchangeRouter (user signs with MetaMask)
  ├── Reads positions/balances from blockchain
  └── Fetches prices from nivo-api for display
```

> **Start order matters:** Hardhat → API → Keeper → Dashboard. The API must be running before the keeper because the keeper depends on it for all price data.

---

## Wallets Overview

There are **two wallets** (same setup for both testnet and mainnet). All tokens and funds must be on **Base Sepolia** for testnet or **Base** for mainnet:

### 1) Deployer / User Wallet
- Used by the protocol to **deploy contracts**
- Holds **LINK, USDC, and ETH**
- Used to **add/fund LINK** into one of the contracts
- Can also be used as a **user wallet** to:
  - provide/create liquidity
  - open **short** positions
  - open **long** positions

### 2) Keeper Wallet
- Used by the **keeper** to pay **gas fees** when executing requests
- Only needs **ETH on Base**
- Does **not** need LINK or USDC
