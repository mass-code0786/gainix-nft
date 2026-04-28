import { ethers } from "hardhat";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function parseCsvBigInt(input: string): bigint[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => BigInt(value));
}

async function main() {
  const initialOwner = requiredEnv("INITIAL_OWNER");
  const feeRecipient = requiredEnv("MARKETPLACE_FEE_RECIPIENT");
  const treasury = requiredEnv("BOTPASS_TREASURY");

  const nftName = process.env.NFT_NAME ?? "Gainix NFT";
  const nftSymbol = process.env.NFT_SYMBOL ?? "GNFT";
  const nftBaseUri = process.env.NFT_BASE_URI ?? "ipfs://gainix-nft-metadata/";
  const nftStartTokenId = BigInt(process.env.NFT_START_TOKEN_ID ?? "1000");

  const marketplaceFeeBps = Number(process.env.MARKETPLACE_FEE_BPS ?? "200");

  const planIds = parseCsvBigInt(process.env.BOT_PLAN_IDS ?? "1,2,3,4,5");
  const planPrices = parseCsvBigInt(
    process.env.BOT_PLAN_PRICES_WEI ??
      "10000000000000000,20000000000000000,50000000000000000,100000000000000000,500000000000000000"
  );
  const planCycles = parseCsvBigInt(process.env.BOT_PLAN_CYCLES ?? "120,260,700,1600,9000");

  if (!(planIds.length === planPrices.length && planIds.length === planCycles.length)) {
    throw new Error("Bot plan arrays are mismatched");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with:", deployer.address);

  const nftFactory = await ethers.getContractFactory("GainixNFT");
  const nft = await nftFactory.deploy(nftName, nftSymbol, initialOwner, nftBaseUri, nftStartTokenId);
  await nft.waitForDeployment();

  const marketplaceFactory = await ethers.getContractFactory("GainixMarketplace");
  const marketplace = await marketplaceFactory.deploy(initialOwner, feeRecipient, marketplaceFeeBps);
  await marketplace.waitForDeployment();

  const botPassFactory = await ethers.getContractFactory("GainixBotPass");
  const botPass = await botPassFactory.deploy(initialOwner, treasury, planIds, planPrices, planCycles);
  await botPass.waitForDeployment();

  console.log("GainixNFT:", await nft.getAddress());
  console.log("GainixMarketplace:", await marketplace.getAddress());
  console.log("GainixBotPass:", await botPass.getAddress());
  console.log("Deployment complete for BNB Smart Chain testnet (chainId 97).");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
