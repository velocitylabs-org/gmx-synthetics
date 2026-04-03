import { HardhatRuntimeEnvironment } from "hardhat/types";
import { setBalance } from "@nomicfoundation/hardhat-network-helpers";
import { expandDecimals } from "../utils/math";

const func = async ({ getNamedAccounts, deployments }: HardhatRuntimeEnvironment) => {
  const { log } = deployments;
  const { deployer } = await getNamedAccounts();
  const balance = expandDecimals(1000, 18);
  // Use lowercase so setBalance skips EIP-55 checksum (Hardhat chainId differs from mainnet)
  const address = deployer.toLowerCase();
  log("set deployer %s balance to %s", address, balance);
  await setBalance(address, balance);
};

func.skip = async ({ network }) => {
  return network.live;
};
func.tags = ["FundAccounts"];
export default func;
