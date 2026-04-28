"use client";

import Link from "next/link";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button";

export function GlobalHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-[70] px-2 pb-1 sm:px-4 sm:pb-1.5">
      <div className="mx-auto w-full max-w-7xl">
        <div className="header-shell flex h-[var(--header-height)] items-center justify-between gap-2 sm:gap-3 px-3.5 sm:px-5">
          <Link href="/" prefetch={false} aria-label="Gainix NFT home" className="relative z-10 flex min-w-0 items-center py-1">
            <BrandLogo />
          </Link>

          <div className="relative z-10 flex shrink-0 items-center justify-end">
            <div className="shrink-0">
              <WalletConnectButton variant="header" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
