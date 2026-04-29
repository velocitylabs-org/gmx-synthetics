import { expect } from "chai";
import hre, { network } from "hardhat";

import * as keys from "../../utils/keys";
import { OrderType } from "../../utils/order";
import { runDisableSwapCreate } from "../../scripts/configs/disableSwapCreate";
import { runDisableSwapExecute } from "../../scripts/configs/disableSwapExecute";
import { getDeployedContract } from "../../scripts/configs/getDeployedContract";

const DEFAULT_CONFIG_KEEPER = "0xAed31d3C8942B38eec87Fe5830a671C1A3D0d967";

async function tryRpc(method: string, params: any[]) {
  await network.provider.request({ method, params });
}

async function impersonateAccount(address: string) {
  try {
    await tryRpc("hardhat_impersonateAccount", [address]);
  } catch {
    await tryRpc("anvil_impersonateAccount", [address]);
  }
}

async function stopImpersonateAccount(address: string) {
  try {
    await tryRpc("hardhat_stopImpersonatingAccount", [address]);
  } catch {
    try {
      await tryRpc("anvil_stopImpersonatingAccount", [address]);
    } catch {
      // ignore if not supported by the rpc endpoint
    }
  }
}

async function setAccountBalance(address: string, hexWei: string) {
  try {
    await tryRpc("hardhat_setBalance", [address, hexWei]);
  } catch {
    await tryRpc("anvil_setBalance", [address, hexWei]);
  }
}

describe("Config.VerifySwapReconfiguration", function () {
  const configKeeper = process.env.CONFIG_KEEPER || DEFAULT_CONFIG_KEEPER;
  const previousEnv: Record<string, string | undefined> = {};

  before(async function () {
    if (process.env.RUN_FORK_CONFIG_TESTS !== "true") {
      this.skip();
    }

    await impersonateAccount(configKeeper);
    await setAccountBalance(configKeeper, "0x56BC75E2D63100000"); // 100 ETH

    previousEnv.CONFIG_KEEPER = process.env.CONFIG_KEEPER;
    previousEnv.IS_DISABLED = process.env.IS_DISABLED;
    previousEnv.WRITE = process.env.WRITE;

    process.env.CONFIG_KEEPER = configKeeper;
    process.env.IS_DISABLED = "true";
    process.env.WRITE = "true";
  });

  after(async () => {
    process.env.CONFIG_KEEPER = previousEnv.CONFIG_KEEPER;
    process.env.IS_DISABLED = previousEnv.IS_DISABLED;
    process.env.WRITE = previousEnv.WRITE;

    await stopImpersonateAccount(configKeeper);
  });

  it("disables MarketSwap and LimitSwap for create + execute", async () => {
    await runDisableSwapCreate();
    await runDisableSwapExecute();

    const dataStore = await getDeployedContract(hre, "DataStore");
    const orderHandler = await getDeployedContract(hre, "OrderHandler");
    const orderHandlerAddress = orderHandler.address;

    const checks = [
      {
        label: "create MarketSwap",
        key: keys.createOrderFeatureDisabledKey(orderHandlerAddress, OrderType.MarketSwap),
      },
      {
        label: "create LimitSwap",
        key: keys.createOrderFeatureDisabledKey(orderHandlerAddress, OrderType.LimitSwap),
      },
      {
        label: "create StopLossDecrease",
        key: keys.createOrderFeatureDisabledKey(orderHandlerAddress, OrderType.StopLossDecrease),
      },
      {
        label: "execute MarketSwap",
        key: keys.executeOrderFeatureDisabledKey(orderHandlerAddress, OrderType.MarketSwap),
      },
      {
        label: "execute LimitSwap",
        key: keys.executeOrderFeatureDisabledKey(orderHandlerAddress, OrderType.LimitSwap),
      },
      {
        label: "execute StopLossDecrease",
        key: keys.executeOrderFeatureDisabledKey(orderHandlerAddress, OrderType.StopLossDecrease),
      },
    ];

    for (const check of checks) {
      const value = await dataStore.getBool(check.key);
      expect(value, check.label).eq(true);
    }
  });
});
