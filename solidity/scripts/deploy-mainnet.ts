import { ethers, network } from "hardhat";
import { verifyExpectedDeployer } from "./verify-deployer";

const zeroAddress = "0x0000000000000000000000000000000000000000";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requiredAddress(name: string): string {
  const value = requiredEnv(name);
  if (!ethers.isAddress(value) || value.toLowerCase() === zeroAddress) {
    throw new Error(`${name} must be a non-zero EVM address.`);
  }
  return ethers.getAddress(value);
}

function requiredAddressFrom(names: string[]): string {
  for (const name of names) {
    const value = optionalEnv(name);
    if (value) {
      if (!ethers.isAddress(value) || value.toLowerCase() === zeroAddress) {
        throw new Error(`${name} must be a non-zero EVM address.`);
      }
      return ethers.getAddress(value);
    }
  }

  throw new Error(`Missing required env var: ${names.join(" or ")}`);
}

function parseCsvBigInt(input: string): bigint[] {
  return input
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => BigInt(value));
}

async function main() {
  if (network.config.chainId !== 56) {
    throw new Error(`Refusing mainnet deployment on chainId ${network.config.chainId ?? "unknown"}.`);
  }

  verifyExpectedDeployer();

  const initialOwner = requiredAddress("INITIAL_OWNER");
  const withdrawalOperator = requiredAddressFrom(["WITHDRAWAL_OPERATOR_ADDRESS", "BACKEND_OPERATOR_WALLET", "OPERATOR_WALLET", "EXPECTED_DEPLOYER_ADDRESS"]);
  const feeRecipient = requiredAddress("MARKETPLACE_FEE_RECIPIENT");
  const botPassTreasury = requiredAddress("BOTPASS_TREASURY");

  const platformTreasury = optionalEnv("PLATFORM_TREASURY_WALLET");
  if (platformTreasury && (!ethers.isAddress(platformTreasury) || platformTreasury.toLowerCase() === zeroAddress)) {
    throw new Error("PLATFORM_TREASURY_WALLET must be a non-zero EVM address when set.");
  }

  const nftName = process.env.NFT_NAME ?? "Gainix NFT";
  const nftSymbol = process.env.NFT_SYMBOL ?? "GNFT";
  const nftBaseUri = process.env.NFT_BASE_URI ?? "ipfs://gainix-nft-metadata/";
  const nftStartTokenId = BigInt(process.env.NFT_START_TOKEN_ID ?? "1000");
  const marketplaceFeeBps = Number(process.env.MARKETPLACE_FEE_BPS ?? "200");

  const planIds = parseCsvBigInt(process.env.BOT_PLAN_IDS ?? "1,2,3,4,5");
  const planPrices = parseCsvBigInt(
    process.env.BOT_PLAN_PRICES_WEI ??
      "10000000000000000,20000000000000000,50000000000000000,100000000000000000,500000000000000000",
  );
  const planCycles = parseCsvBigInt(process.env.BOT_PLAN_CYCLES ?? "120,260,700,1600,9000");

  if (!(planIds.length === planPrices.length && planIds.length === planCycles.length)) {
    throw new Error("Bot plan arrays are mismatched.");
  }

  const [deployer] = await ethers.getSigners();
  console.log("Gainix BSC Mainnet deployment");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("Deployer:", deployer.address);
  console.log("Initial owner/admin:", initialOwner);
  console.log("Withdrawal operator:", withdrawalOperator);
  console.log("Marketplace fee recipient:", feeRecipient);
  console.log("BotPass treasury:", botPassTreasury);
  if (platformTreasury) {
    console.log("Platform treasury wallet:", ethers.getAddress(platformTreasury));
  }

  const nftFactory = await ethers.getContractFactory("GainixNFT");
  const nft = await nftFactory.deploy(nftName, nftSymbol, initialOwner, nftBaseUri, nftStartTokenId);
  await nft.waitForDeployment();
  const nftAddress = await nft.getAddress();

  const marketplaceFactory = await ethers.getContractFactory("GainixMarketplace");
  const marketplace = await marketplaceFactory.deploy(initialOwner, feeRecipient, marketplaceFeeBps);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  const botPassFactory = await ethers.getContractFactory("GainixBotPass");
  const botPass = await botPassFactory.deploy(initialOwner, botPassTreasury, planIds, planPrices, planCycles);
  await botPass.waitForDeployment();
  const botPassAddress = await botPass.getAddress();

  const usdtToken = requiredAddressFrom(["NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS"]);
  const withdrawalVaultFactory = await ethers.getContractFactory("GainixWithdrawalVault");
  const withdrawalVault = await withdrawalVaultFactory.deploy(initialOwner, withdrawalOperator, usdtToken);
  await withdrawalVault.waitForDeployment();
  const withdrawalVaultAddress = await withdrawalVault.getAddress();

  console.log("");
  console.log("Deployment complete. Copy these into production env:");
  console.log(`NEXT_PUBLIC_CHAIN_ID=56`);
  console.log(`NEXT_PUBLIC_GAINIX_NFT_ADDRESS=${nftAddress}`);
  console.log(`NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log(`NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS=${botPassAddress}`);
  console.log(`NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS=${withdrawalVaultAddress}`);
  console.log(`MARKETPLACE_FEE_RECIPIENT=${feeRecipient}`);
  console.log(`BOTPASS_TREASURY=${botPassTreasury}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
