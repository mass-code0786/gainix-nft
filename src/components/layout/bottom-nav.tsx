"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gem, Grid2X2, House, Users, WalletCards } from "lucide-react";
import { motion } from "framer-motion";
import { bottomNavItems } from "@/data/navigation";
import { cn } from "@/utils/cn";

const iconMap = {
  Home: House,
  Market: Gem,
  Team: Users,
  Portfolio: Grid2X2,
  Wallet: WalletCards,
} as const;

function getRouteGroup(pathname: string) {
  if (pathname.startsWith("/marketplace") || pathname.startsWith("/trade") || pathname.startsWith("/list")) {
    return "/marketplace";
  }

  if (pathname.startsWith("/team")) {
    return "/team";
  }

  if (pathname.startsWith("/portfolio")) {
    return "/portfolio";
  }

  if (pathname.startsWith("/wallet") || pathname.startsWith("/notifications")) {
    return "/wallet";
  }

  return "/dashboard";
}

export function BottomNav() {
  const pathname = usePathname();
  const activeHref = getRouteGroup(pathname);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-2 z-50 flex justify-center px-3 sm:bottom-3 sm:px-4">
      <nav className="pointer-events-auto w-full max-w-md rounded-[28px] border border-white/10 bg-black/80 p-1.5 pb-[calc(0.35rem+env(safe-area-inset-bottom))] shadow-glow backdrop-blur-2xl sm:max-w-lg">
        <div className="grid grid-cols-5 gap-1">
          {bottomNavItems.map(({ href, label }) => {
            const Icon = iconMap[label];
            const active = activeHref === href;

            return (
              <Link key={href} href={href} prefetch={false} className="relative">
                {active ? (
                  <motion.span
                    layoutId="active-nav"
                    className="absolute inset-0 rounded-[20px] border border-gainix-400/30 bg-gradient-to-b from-gainix-500/30 to-red-900/25"
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  />
                ) : null}
                <span
                  className={cn(
                    "relative z-10 flex flex-col items-center gap-1 rounded-[20px] px-1.5 py-2.5 text-[10px] font-medium leading-none transition sm:px-2 sm:text-[11px]",
                    active ? "text-white" : "text-zinc-500 hover:text-zinc-200",
                  )}
                >
                  <Icon className={cn("h-[18px] w-[18px]", active ? "text-gainix-300" : "text-zinc-500")} />
                  <span className="whitespace-nowrap">{label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
