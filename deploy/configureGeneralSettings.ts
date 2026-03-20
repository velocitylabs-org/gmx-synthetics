import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as keys from "../utils/keys";
import { setAddressIfDifferent, setUintIfDifferent, setBoolIfDifferent } from "../utils/dataStore";
import { updateGeneralConfig } from "../scripts/updateGeneralConfigUtils";

const func = async ({ gmx }: HardhatRuntimeEnvironment) => {
  const generalConfig = await gmx.getGeneral();

  await setAddressIfDifferent(keys.FEE_RECEIVER, generalConfig.feeReceiver, "fee receiver");
  await setAddressIfDifferent(keys.HOLDING_ADDRESS, generalConfig.holdingAddress, "holding address");

  await setUintIfDifferent(
    keys.BORROWING_FEE_RECEIVER_FACTOR,
    generalConfig.borrowingFeeReceiverFactor,
    "borrowingFeeReceiverFactor"
  );

  await setBoolIfDifferent(
    keys.SKIP_BORROWING_FEE_FOR_SMALLER_SIDE,
    generalConfig.skipBorrowingFeeForSmallerSide,
    "skip borrowing fee for smaller side"
  );

  await setUintIfDifferent(
    keys.CLAIMABLE_COLLATERAL_TIME_DIVISOR,
    generalConfig.claimableCollateralTimeDivisor,
    "claimable collateral time divisor"
  );

  await setUintIfDifferent(
    keys.MAX_EXECUTION_FEE_MULTIPLIER_FACTOR,
    generalConfig.maxExecutionFeeMultiplierFactor,
    "max execution fee multiplier factor"
  );

  if (!gmx.isExistingMainnetDeployment) {
    await updateGeneralConfig({ write: true });
  }
};

func.skip = async (hre: HardhatRuntimeEnvironment) => {
  const deployOnFork = process.env.DEPLOY_ON_FORK === "true";
  const rpcUrl = typeof hre.network.config.url === "string" ? hre.network.config.url : "";
  const usesLocalRpc = rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost");
  return hre.network.name === "base" && (deployOnFork || usesLocalRpc);
};

func.tags = ["GeneralSettings"];
func.dependencies = ["DataStore", "Config", "Multicall", "Roles", "LayerZeroProvider"];
export default func;
