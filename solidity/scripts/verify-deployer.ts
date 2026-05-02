import { Wallet } from "ethers";
import { ethers, network } from "hardhat";

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function verifyExpectedDeployer(): string {
  const privateKey = requiredEnv("DEPLOYER_PRIVATE_KEY");
  const expectedDeployer = requiredEnv("EXPECTED_DEPLOYER_ADDRESS");

  if (!ethers.isAddress(expectedDeployer)) {
    throw new Error("EXPECTED_DEPLOYER_ADDRESS must be a valid EVM address.");
  }

  const derivedDeployer = new Wallet(privateKey).address;
  const normalizedExpected = ethers.getAddress(expectedDeployer);

  console.log("Deployer address:", derivedDeployer);
  console.log("Expected deployer address:", normalizedExpected);

  if (derivedDeployer !== normalizedExpected) {
    throw new Error(
      `Deployer mismatch. DEPLOYER_PRIVATE_KEY derives ${derivedDeployer}, expected ${normalizedExpected}. Refusing to continue.`,
    );
  }

  return derivedDeployer;
}

async function main() {
  if (network.config.chainId !== 56) {
    throw new Error(`Refusing deployer verification on chainId ${network.config.chainId ?? "unknown"}.`);
  }

  console.log("Gainix BSC Mainnet deployer verification");
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  verifyExpectedDeployer();
  console.log("Deployer verification passed.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
