"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppLogo } from "@/components/ui/app-logo";

const footerLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/bot-subscription", label: "Auto Trading Bot" },
] as const;

const panelRoutePrefixes = [
  "/admin-mint",
  "/bot-activity",
  "/bot-subscription",
  "/dashboard",
  "/dev",
  "/history",
  "/income",
  "/leadership",
  "/list",
  "/marketplace",
  "/notifications",
  "/portfolio",
  "/team",
  "/trade",
  "/wallet",
  "/withdrawal",
] as const;

function isPanelRoute(pathname: string) {
  return panelRoutePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function GlobalFooter() {
  const pathname = usePathname();

  if (isPanelRoute(pathname)) {
    return null;
  }

  return (
    <footer className="border-t border-white/10 bg-black/45">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="min-w-0">
          <AppLogo />
          <p className="mt-1 text-xs text-zinc-500">Premium NFT marketplace.</p>
        </div>

        <nav className="flex flex-wrap gap-2">
          {footerLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-zinc-300 transition hover:border-gainix-400/30 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
