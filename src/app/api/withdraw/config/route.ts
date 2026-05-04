import { NextResponse } from "next/server";
import { contractActiveChainId } from "@/contracts/config/chain";
import { withSecurityHeaders } from "@/server/api/http";
import { resolveWithdrawalVaultAddress } from "@/server/services/withdrawal-config";

export async function GET() {
  const vaultAddress = resolveWithdrawalVaultAddress();
  const configured = Boolean(vaultAddress);

  console.info("[withdraw.config] apiVaultAddress=", configured ? vaultAddress : "");
  console.info("[withdraw.config] normalizedVaultAddress=", vaultAddress ?? "");
  console.info("[withdraw.config] configured=", configured);

  return withSecurityHeaders(
    NextResponse.json({
      vaultAddress: vaultAddress ?? "",
      chainId: contractActiveChainId,
      configured,
    }),
  );
}
