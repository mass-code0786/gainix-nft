import { ethers, network, run } from "hardhat";

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

async function verifyContract(contract: string, address: string, constructorArguments: unknown[]) {
  console.log(`Verifying ${contract} at ${address}`);

  try {
    await run("verify:verify", {
      address,
      constructorArguments,
      contract,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("already verified")) {
      console.log(`${contract} already verified.`);
      return;
    }
    throw error;
  }
}

async function main() {
  if (network.config.chainId !== 56) {
    throw new Error(`Refusing BSC mainnet verification on chainId ${network.config.chainId ?? "unknown"}.`);
  }

  requiredEnv("BSCSCAN_API_KEY");

  const initialOwner = requiredAddress("INITIAL_OWNER");
  const withdrawalOperator = requiredAddressFrom(["WITHDRAWAL_OPERATOR_ADDRESS", "BACKEND_OPERATOR_WALLET", "OPERATOR_WALLET", "EXPECTED_DEPLOYER_ADDRESS"]);
  const feeRecipient = requiredAddress("MARKETPLACE_FEE_RECIPIENT");
  const botPassTreasury = requiredAddress("BOTPASS_TREASURY");
  const usdtToken = requiredAddressFrom(["NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS"]);

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

  await verifyContract(
    "contracts/GainixNFT.sol:GainixNFT",
    requiredAddressFrom(["NEXT_PUBLIC_GAINIX_NFT_ADDRESS"]),
    [nftName, nftSymbol, initialOwner, nftBaseUri, nftStartTokenId],
  );

  await verifyContract(
    "contracts/GainixMarketplace.sol:GainixMarketplace",
    requiredAddressFrom(["NEXT_PUBLIC_GAINIX_MARKETPLACE_ADDRESS"]),
    [initialOwner, feeRecipient, marketplaceFeeBps],
  );

  await verifyContract(
    "contracts/GainixBotPass.sol:GainixBotPass",
    requiredAddressFrom(["NEXT_PUBLIC_GAINIX_BOTPASS_ADDRESS"]),
    [initialOwner, botPassTreasury, planIds, planPrices, planCycles],
  );

  await verifyContract(
    "contracts/GainixWithdrawalVault.sol:GainixWithdrawalVault",
    requiredAddressFrom(["NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS", "WITHDRAWAL_VAULT_ADDRESS", "WITHDRAWAL_CONTRACT_ADDRESS"]),
    [initialOwner, withdrawalOperator, usdtToken],
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
