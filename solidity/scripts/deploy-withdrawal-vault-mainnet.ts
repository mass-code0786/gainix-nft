import { ethers, network } from "hardhat";
import { verifyExpectedDeployer } from "./verify-deployer";

const zeroAddress = "0x0000000000000000000000000000000000000000";

function optionalEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
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
    throw new Error(`Refusing mainnet deployment on chainId ${network.config.chainId ?? "unknown"}.`);
  }

  verifyExpectedDeployer();

  const [deployer] = await ethers.getSigners();
  const initialOwner = requiredAddressFrom(["INITIAL_OWNER", "OWNER_WALLET_ADDRESS"]);
  const withdrawalOperator = requiredAddressFrom([
    "WITHDRAWAL_OPERATOR_ADDRESS",
    "BACKEND_OPERATOR_WALLET",
    "OPERATOR_WALLET",
    "EXPECTED_DEPLOYER_ADDRESS",
  ]);
  const usdtToken = requiredAddressFrom(["NEXT_PUBLIC_USDT_TOKEN_ADDRESS", "USDT_TOKEN_ADDRESS"]);

  console.log("Deploying GainixWithdrawalVault to BSC mainnet");
  console.log("Deployer:", deployer.address);
  console.log("Initial owner/admin:", initialOwner);
  console.log("Withdrawal operator:", withdrawalOperator);
  console.log("USDT token:", usdtToken);

  const withdrawalVaultFactory = await ethers.getContractFactory("GainixWithdrawalVault");
  const withdrawalVault = await withdrawalVaultFactory.deploy(initialOwner, withdrawalOperator, usdtToken);
  await withdrawalVault.waitForDeployment();
  const withdrawalVaultAddress = await withdrawalVault.getAddress();

  console.log("");
  console.log("Withdrawal vault deployment complete. Copy these into production env:");
  console.log(`NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS=${withdrawalVaultAddress}`);
  console.log(`WITHDRAWAL_VAULT_ADDRESS=${withdrawalVaultAddress}`);
  console.log(`BscScan: https://bscscan.com/address/${withdrawalVaultAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
