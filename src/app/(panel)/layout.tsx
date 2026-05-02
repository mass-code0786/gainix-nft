import type { ReactNode } from "react";
import { AdminWalletRedirect } from "@/components/auth/admin-wallet-redirect";
import { BottomNav } from "@/components/layout/bottom-nav";

export default function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <AdminWalletRedirect />
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute left-[-80px] top-[-40px] h-56 w-56 rounded-full bg-gainix-600/20 blur-[90px]" />
        <div className="absolute right-[-60px] top-[100px] h-56 w-56 rounded-full bg-red-900/30 blur-[110px]" />
      </div>

      <div className="relative mx-auto min-h-screen w-full max-w-7xl px-4 pb-28 sm:px-6 lg:px-8">
        {children}
      </div>

      <BottomNav />
    </div>
  );
}
