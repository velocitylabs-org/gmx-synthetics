import { ethers, deployments } from "hardhat";

async function main() {
  const marketAddress = "0x76fF6efB7B42274D96536Eb0EEf8057E48faeC55"; // The market we picked
  // Tokens from listMarkets output:
  const indexToken = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const longToken = "0x0165878A594ca255338adfa4d48449f69242Eb8F";
  const shortToken = "0xB7f8BC63BbcaD18155201308C8f3540b07f84F5e";

  const getSymbol = async (address: string) => {
    try {
      const token = await ethers.getContractAt("IERC20Metadata", address);
      return await token.symbol();
    } catch (e) {
      return "UNKNOWN";
    }
  };

  console.log("Market:", marketAddress);
  console.log("Index:", indexToken, await getSymbol(indexToken));
  console.log("Long:", longToken, await getSymbol(longToken));
  console.log("Short:", shortToken, await getSymbol(shortToken));

  // Also check DataStore for execution fee requirements if possible,
  // but just knowing the tokens helps huge amounts.
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
