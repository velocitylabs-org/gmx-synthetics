import hre from "hardhat";

import { encodeData } from "../../../utils/hash";
import * as keys from "../../../utils/keys";
import { OrderType } from "../../../utils/order";
import { getDeployedContract } from "../helpers/getDeployedContract";
import { getConfigKeeperRoleSigner } from "../helpers/getConfigKeeperSigner";

export async function runDisableOrderExecuteFeatures() {
  const config = await getDeployedContract(hre, "Config");
  const orderHandlerAddress = process.env.ORDER_HANDLER || (await getDeployedContract(hre, "OrderHandler")).address;

  const disableValue = process.env.IS_DISABLED === undefined ? true : process.env.IS_DISABLED === "true";
  const write = process.env.WRITE === "true";

  const featureKeys = [
    {
      baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.MarketSwap]),
      label: "EXECUTE_ORDER_FEATURE_DISABLED MarketSwap",
    },
    {
      baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitSwap]),
      label: "EXECUTE_ORDER_FEATURE_DISABLED LimitSwap",
    },
    {
      baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.StopLossDecrease]),
      label: "EXECUTE_ORDER_FEATURE_DISABLED StopLossDecrease",
    },
    {
      baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitIncrease]),
      label: "EXECUTE_ORDER_FEATURE_DISABLED LimitIncrease",
    },
    {
      baseKey: keys.EXECUTE_ORDER_FEATURE_DISABLED,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitDecrease]),
      label: "EXECUTE_ORDER_FEATURE_DISABLED LimitDecrease",
    },
  ];

  const multicallWriteParams = featureKeys.map((f) =>
    config.interface.encodeFunctionData("setBool", [f.baseKey, f.data, disableValue])
  );
  const { configKeeperRoleAddress, configKeeperRoleSigner } = await getConfigKeeperRoleSigner(hre);
  const signedConfig = config.connect(configKeeperRoleSigner);

  console.log(`OrderHandler: ${orderHandlerAddress}`);
  console.log(`Config keeper role address: ${configKeeperRoleAddress}`);
  console.log(`Disable value: ${disableValue}`);
  console.log(`Prepared ${multicallWriteParams.length} execute-order feature updates`);
  featureKeys.forEach((f) => console.log(`- ${f.label}`));

  await signedConfig.callStatic.multicall(multicallWriteParams);
  console.log("callStatic passed");

  if (!write) {
    console.log("NOTE: executed in read-only mode, no transactions were sent");
    return;
  }

  const tx = await signedConfig.multicall(multicallWriteParams);
  console.log(`tx sent: ${tx.hash}`);
  await tx.wait();
  console.log("tx mined");
}

async function main() {
  await runDisableOrderExecuteFeatures();
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((ex) => {
      console.error(ex);
      process.exit(1);
    });
}
