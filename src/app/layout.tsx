import type { Metadata } from "next";
import "@rainbow-me/rainbowkit/styles.css";
import "./globals.css";
import { AppProviders } from "@/components/providers/app-providers";
import { GlobalFooter } from "@/components/layout/global-footer";
import { GlobalHeader } from "@/components/layout/global-header";

export const metadata: Metadata = {
  title: "Gainix NFT",
  description: "Wallet-first decentralized NFT marketplace UI for BNB Smart Chain.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/favicon.ico",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          <GlobalHeader />
          <div className="pt-[calc(var(--header-height)+12px)] sm:pt-[calc(var(--header-height)+16px)]">{children}</div>
          <GlobalFooter />
        </AppProviders>
      </body>
    </html>
  );
}
