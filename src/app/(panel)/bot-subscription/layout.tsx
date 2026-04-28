import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bot Subscription | Gainix NFT",
  description: "Review bot subscription plans, active utility status, remaining cycles, trades, and recent activity.",
};

export default function BotSubscriptionLayout({ children }: { children: ReactNode }) {
  return children;
}
