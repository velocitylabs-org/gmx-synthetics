# Re-Deploying Chainlink DataStream Provider on Base Sepolia

The protocol does not use a proxy upgradeability pattern. Contracts are immutable, so any logic change requires deploying a new contract instance and updating the relevant configuration.

## Deployment & migration process after updating:

### Run tests and compile:

```typescript
npx hardhat test
npx hardhat compile
```

In `deployChainlinkDataStreamProvider.ts`, the deployment uses:

```typescript
id: "ChainlinkDataStreamProvider_6" 
```

This ID must be manually removed from: `deployments/baseSepolia/.migrations.json` to force a fresh deployment.

### Deploy the updated provider:

```typescript
 npx hardhat deploy --network baseSepolia --tags ChainlinkDataStreamProvider
```

This deploys the new contract instance and updates the solcInputs in the deployment artifacts.

### Re-map tokens to the new Oracle provider:

```typescript
npx hardhat deploy --network baseSepolia --tags ConfigureOracleTokens
```

- ⚠️ During this step, some nonce issues occurred. The command had to be run multiple times until all tokens were correctly mapped to the new provider address in DataStore.

### Optional cleanup -> disable the old Oracle provider:

```typescript
npx hardhat console --network baseSepolia
```
```typescript
  const dataStore = await ethers.getContract("DataStore");
  const keys = require("../utils/keys");
  const oldProvider = "0xOLD_PROVIDER_ADDRESS";
  const oldKey = await keys.isOracleProviderEnabledKey(oldProvider);
  await dataStore.setBool(oldKey, false);
  console.log("Disabled:", await dataStore.getBool(enabledKey));
```