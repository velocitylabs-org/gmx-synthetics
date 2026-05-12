import { HardhatRuntimeEnvironment } from "hardhat/types";
import { expandDecimals } from "../utils/math";

const func = async ({ getNamedAccounts, deployments, network }: HardhatRuntimeEnvironment) => {
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();
  const balance = expandDecimals(1000, 18);
  log("set deployer %s balance to %s", deployer, balance);
  await network.provider.request({
    method: "hardhat_setBalance",
    params: [deployer, balance.toHexString()],
  });
};

func.skip = async ({ network }) => {
  return network.live;
};
func.tags = ["FundAccounts"];
export default func;
