import { ethers, network, run } from "hardhat";

const zeroAddress = "0x0000000000000000000000000000000000000000";

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
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

async function main() {
  if (network.config.chainId !== 56) {
    throw new Error(`Refusing BSC mainnet verification on chainId ${network.config.chainId ?? "unknown"}.`);
  }

  requiredEnv("BSCSCAN_API_KEY");

  const vaultAddress = requiredAddressFrom([
    "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
    "WITHDRAWAL_VAULT_ADDRESS",
    "WITHDRAWAL_CONTRACT_ADDRESS",
  ]);
  const initialOwner = requiredAddressFrom(["INITIAL_OWNER", "OWNER_WALLET_ADDRESS"]);
  const withdrawalOperator = requiredAddressFrom([
    "WITHDRAWAL_OPERATOR_ADDRESS",
    "BACKEND_OPERATOR_WALLET",
    "OPERATOR_WALLET",
    "EXPECTED_DEPLOYER_ADDRESS",
  ]);
  const usdtToken = requiredAddressFrom(["NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS"]);

  await run("verify:verify", {
    address: vaultAddress,
    constructorArguments: [initialOwner, withdrawalOperator, usdtToken],
    contract: "contracts/GainixWithdrawalVault.sol:GainixWithdrawalVault",
  });

  console.log(`Verified: https://bscscan.com/address/${vaultAddress}#code`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (message.toLowerCase().includes("already verified")) {
    console.log("GainixWithdrawalVault already verified.");
    process.exitCode = 0;
  } else {
    console.error(error);
    process.exitCode = 1;
  }
});
