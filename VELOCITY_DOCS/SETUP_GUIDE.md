# Nivo Protocol Setup Guide

How to run the Nivo protocol locally (Hardhat), on testnet (Base Sepolia), and on mainnet (Base).

---

## Prerequisites

- **Node.js 24 LTS** (I recommend using [mise](https://mise.jdx.dev/) for runtime management)
- **An Ethereum wallet** (MetaMask or any browser wallet)
- **Git**

## Clone the Repositories

All three repos must be siblings in the same parent directory:

```bash
mkdir nivo && cd nivo

git clone https://github.com/velocitylabs-org/gmx-synthetics.git
git clone https://github.com/velocitylabs-org/nivo-keeper.git
git clone https://github.com/velocitylabs-org/nivo-dashboard.git
```

Install dependencies in each repo:

```bash
cd gmx-synthetics && npm install && cd ..
cd nivo-keeper && npm install && cd ..
cd nivo-dashboard && npm install && cd ..
```

---

## 1. Localhost (Hardhat)

### Environment Files

You need `.env.localhost` for both the keeper and the dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

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

### Start the Keeper

Open a terminal in `nivo-keeper/`:

```bash
npm run setup-localhost
```

```bash
npm run dev
```

> **Note:** `setup-localhost` syncs contract addresses, grants keeper roles, and cleans up stale requests. You need to re-run it every time you restart `hardhat node` (new instance = new contract addresses).

### Start the Dashboard

Open a terminal in `nivo-dashboard/`:

```bash
npm run dev
```

Open **http://localhost:5173/** in your browser. Connect any Ethereum wallet, you'll automatically receive test USDC and ETH on the Hardhat network so you can add liquidity and create positions.

### Summary (4 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `gmx-synthetics/` | `npx hardhat node` |
| 2 | `gmx-synthetics/` | `SKIP_AUTO_HANDLER_REDEPLOYMENT=true npx hardhat deploy --network localhost` |
| 3 | `nivo-keeper/` | `npm run setup-localhost && npm run dev` |
| 4 | `nivo-dashboard/` | `npm run dev` |

---

## 2. Testnet (Base Sepolia)

### Environment Files

You need `.env.testnet` for both the keeper and the dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

- `nivo-keeper/.env.testnet`
- `nivo-dashboard/.env.testnet`

### Start the Keeper

The protocol is already deployed on Base Sepolia, no need to run anything in `gmx-synthetics/`.

Open a terminal in `nivo-keeper/`:

```bash
npm run setup-testnet
```

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

### Summary (2 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `nivo-keeper/` | `npm run setup-testnet && npm run dev-testnet` |
| 2 | `nivo-dashboard/` | `npm run dev-testnet` |

## 3. Mainnet (Base)

### Environment Files

You need `.env.mainnet` for both the keeper and the dashboard. Ask **@jonatan** on Slack for the correct files and place them in:

- `nivo-keeper/.env.mainnet`
- `nivo-dashboard/.env.mainnet`

### Start the Keeper

The protocol must already be deployed on Base. No need to run anything in `gmx-synthetics/`.

Open a terminal in `nivo-keeper/`:

```bash
npm run setup-mainnet
```

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

### Summary (2 terminals)

| Terminal | Directory | Command |
|----------|-----------|---------|
| 1 | `nivo-keeper/` | `npm run setup-mainnet && npm run dev-mainnet` |
| 2 | `nivo-dashboard/` | `npm run dev-mainnet` |

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
