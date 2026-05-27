import hre from "hardhat";

import { encodeData } from "../../../utils/hash";
import { OrderType } from "../../../utils/order";
import { getIsDisabled, getWriteMode } from "../configRuntime";
import { getConfigKeeperRoleSigner } from "./getConfigKeeperRoleSigner";
import { getDeployedContract } from "./getDeployedContract";

export async function disableOrderFeatures(baseKey: string, keyName: string, actionLabel: string): Promise<void> {
  const config = await getDeployedContract(hre, "Config");
  const orderHandlerAddress = process.env.ORDER_HANDLER || (await getDeployedContract(hre, "OrderHandler")).address;

  const disableValue = getIsDisabled();
  const write = getWriteMode();

  const featureKeys = [
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.MarketSwap]),
      label: `${keyName} MarketSwap`,
    },
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitSwap]),
      label: `${keyName} LimitSwap`,
    },
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.StopLossDecrease]),
      label: `${keyName} StopLossDecrease`,
    },
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitIncrease]),
      label: `${keyName} LimitIncrease`,
    },
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.LimitDecrease]),
      label: `${keyName} LimitDecrease`,
    },
    {
      baseKey,
      data: encodeData(["address", "uint256"], [orderHandlerAddress, OrderType.StopIncrease]),
      label: `${keyName} StopIncrease`,
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
  console.log(`Prepared ${multicallWriteParams.length} ${actionLabel} feature updates`);
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
