# gmx-synthetics Setup Guide

This guide covers the `gmx-synthetics` repo only. For running the full Nivo stack (API, keeper, dashboard), see the setup guides in those repos.

---

## Prerequisites

- **Doppler CLI** — manages all secrets; no `.env` files:
  ```bash
  doppler login   # once per machine
  ```

---

## Installation

```bash
git clone https://github.com/velocitylabs-org/gmx-synthetics.git
cd gmx-synthetics
pnpm install
```

---

## Environment Variables (Doppler)

Doppler injects secrets at runtime. The project is `nivo`; configs map to environments:

| Config | Environment | When to use |
|--------|-------------|-------------|
| `loc`  | localhost   | Local Hardhat node (default in `.doppler.yaml`) |
| `stg`  | Base Sepolia | Testnet deploys and scripts |
| `prd`  | Base mainnet | Production deploys and scripts |

Prefix any command with `doppler run --` to use the default `loc` config, or pass `-c stg` / `-c prd` to target another environment:

```bash
doppler run -- <cmd>                   # loc (localhost)
doppler run -c stg -- <cmd>            # Base Sepolia
doppler run -c prd -- <cmd>            # Base mainnet
```

> Fork scripts and the local Hardhat node use hardcoded Hardhat dev keys — Doppler is not required for those.

---

## Running Locally (Hardhat)

Two terminals required.

**Terminal — start the local node** (forks nothing; runs full deploy on startup, ~5 min):

```bash
doppler run -- pnpm exec hardhat node
```
---

## Forking Base Mainnet

Two options depending on which toolchain you want:

```bash
pnpm fork:base       # Hardhat node — forks Base mainnet, no deploy
pnpm hardhat:fork    # Anvil — forks Base mainnet, chain-id 8453, port 8545
```

To validate configs and deploy on top of the fork:

```bash
pnpm deploy:base:fork
```

---

## Networks

| Network | Hardhat name | Notes |
|---------|-------------|-------|
| localhost | `localhost` | Local Hardhat node (see above) |
| Base Sepolia | `baseSepolia` | Testnet; use `doppler run -c stg --` |
| Base mainnet | `base` | Production; `pnpm deploy:base:mainnet` has Doppler baked in |

**Base Sepolia** — deploy or run scripts:

```bash
doppler run -c stg -- pnpm exec hardhat deploy --network baseSepolia
doppler run -c stg -- pnpm exec hardhat run scripts/<script>.ts --network baseSepolia
```
---

## Common Commands

```bash
pnpm hardhat compile              # compile contracts
pnpm test                              # full test suite (8 GB heap)
pnpm hardhat test test/path/to/File.ts   # single file
pnpm lint                              # ESLint + Prettier (staged TS files only)
```
