import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as keys from "../utils/keys";
import { setBoolIfDifferent, setBytes32IfDifferent, setUintIfDifferent } from "../utils/dataStore";
import { DEFAULT_MARKET_TYPE, getMarketTokenAddresses, getMarketKey, getOnchainMarkets } from "../utils/market";
import { updateMarketConfig } from "../scripts/updateMarketConfigUtils";
import { hashString } from "../utils/hash";

const func = async ({ deployments, getNamedAccounts, gmx }: HardhatRuntimeEnvironment) => {
  const { execute, get, read, log } = deployments;

  if (process.env.SKIP_NEW_MARKETS) {
    log("WARN: new markets will be skipped");
  }

  const { deployer } = await getNamedAccounts();

  const tokens = await gmx.getTokens();
  const markets = await gmx.getMarkets();

  const dataStore = await get("DataStore");

  // `MarketFactory.createMarket` requires the caller to have `MARKET_KEEPER` in RoleStore.
  // Some mainnet deployments skip auto role-granting, so make this step self-sufficient.
  const marketKeeperRoleHash = hashString("MARKET_KEEPER");
  const hasMarketKeeperRole = await read("RoleStore", "hasRole", deployer, marketKeeperRoleHash);
  if (!hasMarketKeeperRole) {
    log("deployer missing MARKET_KEEPER role; granting via RoleStore...");
    await execute("RoleStore", { from: deployer, log: true }, "grantRole", deployer, marketKeeperRoleHash);
  }

  // Market creation emits events via EventEmitter from within MarketFactory.
  // EventEmitter's emit methods require msg.sender to have CONTROLLER role,
  // so MarketFactory itself must be a CONTROLLER.
  const marketFactory = await get("MarketFactory");
  const controllerRoleHash = hashString("CONTROLLER");
  const marketFactoryHasControllerRole = await read("RoleStore", "hasRole", marketFactory.address, controllerRoleHash);
  if (!marketFactoryHasControllerRole) {
    log("MarketFactory %s missing CONTROLLER role; granting via RoleStore...", marketFactory.address);
    await execute("RoleStore", { from: deployer, log: true }, "grantRole", marketFactory.address, controllerRoleHash);
  }

  let onchainMarketsByTokens = await getOnchainMarkets(read, dataStore.address);

  for (const marketConfig of markets) {
    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);

    const marketKey = getMarketKey(indexToken, longToken, shortToken);
    const onchainMarket = onchainMarketsByTokens[marketKey];
    if (onchainMarket) {
      log("market %s:%s:%s already exists at %s", indexToken, longToken, shortToken, onchainMarket.marketToken);
      continue;
    }

    if (process.env.SKIP_NEW_MARKETS) {
      log("WARN: new market %s:%s:%s skipped", indexToken, longToken, shortToken);
      continue;
    }

    const marketType = DEFAULT_MARKET_TYPE;
    log("creating market %s:%s:%s:%s", indexToken, longToken, shortToken, marketType);
    await execute(
      "MarketFactory",
      { from: deployer, log: true },
      "createMarket",
      indexToken,
      longToken,
      shortToken,
      marketType
    );
  }

  onchainMarketsByTokens = await getOnchainMarkets(read, dataStore.address);

  for (const marketConfig of markets) {
    const [indexToken, longToken, shortToken] = getMarketTokenAddresses(marketConfig, tokens);
    const marketKey = getMarketKey(indexToken, longToken, shortToken);
    const onchainMarket = onchainMarketsByTokens[marketKey];
    const marketToken = onchainMarket.marketToken;

    // if trades are done before virtual IDs are set, the tracking of virtual
    // inventories may not be accurate
    //
    // so virtual IDs should be set before other market configurations e.g.
    // max pool amounts, this would help to ensure that no trades can be done
    // before virtual IDs are set

    // set virtual market id for swaps
    const virtualMarketId = marketConfig.virtualMarketId;
    if (virtualMarketId) {
      await setBytes32IfDifferent(
        keys.virtualMarketIdKey(marketToken),
        virtualMarketId,
        `virtual market id for market ${marketToken.toString()}`
      );
    }

    // set virtual token id for perps
    const virtualTokenId = marketConfig.virtualTokenIdForIndexToken;
    if (virtualTokenId) {
      await setBytes32IfDifferent(
        keys.virtualTokenIdKey(indexToken),
        virtualTokenId,
        `virtual token id for indexToken ${indexToken.toString()}`
      );
    }

    if (marketConfig.isDisabled !== undefined) {
      const key = keys.isMarketDisabledKey(marketToken);
      await setBoolIfDifferent(key, marketConfig.isDisabled, `isDisabled for ${marketToken}`);
    }

    // the rest of the params are not used for swap-only markets
    if (marketConfig.swapOnly !== undefined) {
      continue;
    }

    for (const name of ["positionImpactPoolDistributionRate", "minPositionImpactPoolAmount"]) {
      if (marketConfig[name]) {
        const value = marketConfig[name];
        const key = keys[`${name}Key`](marketToken);
        await setUintIfDifferent(key, value, `${name} for ${marketToken.toString()}`);
      }
    }
  }

  if (!gmx.isExistingMainnetDeployment) {
    await updateMarketConfig({ write: true });
  }
};

func.skip = async ({ gmx, network }) => {
  // skip if no markets configured
  const markets = await gmx.getMarkets();
  if (!markets || markets.length === 0) {
    console.warn("no markets configured for network %s", network.name);
    return true;
  }
  return false;
};
func.runAtTheEnd = true;
func.tags = ["Markets"];
func.dependencies = ["MarketFactory", "Tokens", "DataStore", "Config", "Multicall", "Roles"];
export default func;
