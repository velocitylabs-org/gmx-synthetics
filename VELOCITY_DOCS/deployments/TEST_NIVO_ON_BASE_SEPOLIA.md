# Testing Nivo protocol on Base Sepolia

## Prerequisites

- Update the `.env` same as the `.env.example`
```typescript
# Wallets 
#(LPs & Positions wallet)
WALLET_TESTER_ADDRESS
WALLET_TESTER_PRIVATE_KEY

# API Keys
CHAINLINK_CLIENT_ID
CHAINLINK_CLIENT_SECRET

# BASE SEPOLIA
DEPOSIT_KEY
ORDER_KEY
```
- Fund the EOAs (WALLET_TESTER_ADDRESS & NIVO_KEEPER_ADDRESS) with Base Sepolia ETH & USDC. 
- [Circle faucet](https://faucet.circle.com/)

## ⛓️ Run scripts

### Deposit:
* **Create a deposit order** (WALLET_TESTER_PRIVATE_KEY)
    ```typescript
    pnpm hardhat run scripts/nivo/createDepositOrder.ts --network baseSepolia
    ```
* Log deposits: 
    ```typescript
    pnpm hardhat run scripts/printDeposits.ts --network baseSepolia
    ```

* **Execute the deposit** (NIVO_KEEPER_PRIVATE_KEY)
    * set the DEPOSIT_KEY you want to execute in your env var
    ```typescript
    pnpm hardhat run scripts/nivo/executeDeposit.ts --network baseSepolia
    ```

    * Log deposits: Your deposit should be removed from the list.
    ```typescript
    pnpm hardhat run scripts/printDeposits.ts --network baseSepolia
    ```
### Open position:
* **Create an open position order** (WALLET_TESTER_PRIVATE_KEY)
    ```typescript
    pnpm hardhat run scripts/nivo/openPositionOrder.ts --network baseSepolia
    ```

* **Execute the position order** (NIVO_KEEPER_PRIVATE_KEY)
    * set the ORDER_KEY you want to execute in your env var
    ```typescript
    pnpm hardhat run scripts/nivo/executeOpenPosition.ts --network baseSepolia
    ```
### Close position:
* **Create a close position order** (WALLET_TESTER_PRIVATE_KEY)
    ```typescript
    pnpm hardhat run scripts/nivo/closePositionOrder.ts --network baseSepolia
    ```

* **Execute the position order** (NIVO_KEEPER_PRIVATE_KEY)
    * set the ORDER_KEY you want to execute in your env var
    ```typescript
    pnpm hardhat run scripts/nivo/executeClosePosition.ts --network baseSepolia
    ```

