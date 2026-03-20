import { HardhatRuntimeEnvironment } from "hardhat/types";

export type VaultV1Config = {
  vaultV1?: string;
};

export default async function (hre: HardhatRuntimeEnvironment): Promise<VaultV1Config> {
  const config: { [network: string]: VaultV1Config } = {
    hardhat: {},
    localhost: {},
    // Base mainnet currently uses GMX V2 for trading; this contract still requires
    // a non-empty IVaultV1 + gmx address at construction time. FeeHandler will
    // only touch the vault for `version == 1`, so we can safely provide placeholders
    // for fork bring-up until the correct V1 vault/token mapping is confirmed.
    base: {
      vaultV1: "0x0000000000000000000000000000000000000000",
      gmx: "0x4200000000000000000000000000000000000006", // WETH9 on Base (used as placeholder)
    },
    arbitrum: {
      vaultV1: "0x489ee077994B6658eAfA855C308275EAd8097C4A",
      gmx: "0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a",
    },
    avalanche: {
      vaultV1: "0x9ab2De34A33fB459b538c43f251eB825645e8595",
      gmx: "0x62edc0692BD897D2295872a9FFCac5425011c661",
    },
    avalancheFuji: {
      vaultV1: "To be added",
      gmx: "To be added",
    },
    arbitrumSepolia: {
      vaultV1: "To be added",
      gmx: "To be added",
    },
  };

  const vaultV1Config: VaultV1Config = config[hre.network.name];

  return vaultV1Config;
}
