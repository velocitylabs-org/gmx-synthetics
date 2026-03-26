import { HardhatRuntimeEnvironment } from "hardhat/types";

export type FeeDistributorConfig = {
  feeDistributor?: string;
};

export default async function (hre: HardhatRuntimeEnvironment): Promise<FeeDistributorConfig> {
  const config: { [network: string]: FeeDistributorConfig } = {
    hardhat: {},
    base: {
      // FeeDistributor expects (gmx, esGmx, wnt) addresses at construction time.
      // Base mainnet currently lacks canonical config wiring in this repo, so we
      // provide a fork-bring-up mapping with verified GMX token and a placeholder
      // esGMX mapping (needs confirmation for production).
      gmx: "0xa1D7caBCe916E6B8e0506eaa3788B23ebC81232E", // GMX token on Base (verified via fork RPC)
      esGmx: "0xa1D7caBCe916E6B8e0506eaa3788B23ebC81232E", // TODO: replace with the real escrowed GMX token on Base
      wnt: "0x4200000000000000000000000000000000000006", // WETH9 on Base
    },
    arbitrum: {
      gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
      esGmx: "0xf42Ae1D54fd613C9bb14810b0588FaAa09a426cA",
      wnt: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    },
    avalanche: {
      gmx: "0x62edc0692BD897D2295872a9FFCac5425011c661",
      esGmx: "0xff1489227bbaac61a9209a08929e4c2a526ddd17",
      wnt: "0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7",
    },
    avalancheFuji: {
      gmx: "To be added",
      esGmx: "To be added",
      wnt: "To be added",
    },
    arbitrumSepolia: {
      gmx: "To be added",
      esGmx: "To be added",
      wnt: "To be added",
    },
  };

  const feeDistributorConfig: FeeDistributorConfig = config[hre.network.name];

  return feeDistributorConfig;
}
