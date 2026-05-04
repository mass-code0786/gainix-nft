import { NextResponse } from "next/server";
import { isAddress, zeroAddress } from "viem";
import { contractActiveChainId } from "@/contracts/config/chain";
import { withSecurityHeaders } from "@/server/api/http";

const knownWithdrawalVaultAddress = "0x520fF6fB8690b495901E482D2B2395c562931659";

function firstEnv(names: string[]) {
  return names.map((name) => process.env[name]?.trim()).find(Boolean) ?? null;
}

function isConfiguredAddress(address: string | null | undefined) {
  return Boolean(address && isAddress(address) && address.toLowerCase() !== zeroAddress);
}

export async function GET() {
  const vaultAddress =
    firstEnv([
      "NEXT_PUBLIC_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_GAINIX_WITHDRAWAL_VAULT_ADDRESS",
      "NEXT_PUBLIC_WITHDRAWAL_CONTRACT_ADDRESS",
      "WITHDRAWAL_VAULT_ADDRESS",
      "WITHDRAWAL_CONTRACT_ADDRESS",
    ]) ?? knownWithdrawalVaultAddress;

  const configured = isConfiguredAddress(vaultAddress);

  console.info("[withdraw.config] apiVaultAddress=", configured ? vaultAddress : "");
  console.info("[withdraw.config] configured=", configured);

  return withSecurityHeaders(
    NextResponse.json({
      vaultAddress,
      chainId: contractActiveChainId,
      configured,
    }),
  );
}
