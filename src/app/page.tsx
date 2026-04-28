import { Suspense } from "react";
import { HeroActionButtons, HeroPrimaryActions } from "@/components/sections/hero-primary-actions";
import { nfts } from "@/data/mock-data";
import { resolveNftImageUri } from "@/lib/web3/token-metadata";

export default function SplashPage() {
  const heroNft = nfts[0];
  const heroImageSrc = resolveNftImageUri({
    tokenUri: heroNft.tokenUri,
    imageUri: heroNft.imageUri,
    animalType: heroNft.animalType,
    rarity: heroNft.rarity,
  });

  return (
    <main className="relative overflow-hidden px-4 pb-10 pt-4 sm:px-6 sm:pt-6 lg:px-8">
      <div className="absolute inset-0">
        <div className="absolute left-[-120px] top-10 h-80 w-80 rounded-full bg-gainix-600/20 blur-[120px]" />
        <div className="absolute right-[-140px] top-24 h-96 w-96 rounded-full bg-red-950/40 blur-[140px]" />
      </div>

      <div className="relative mx-auto mt-2 flex max-w-7xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.24),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(127,29,29,0.28),transparent_38%),linear-gradient(145deg,rgba(24,7,10,0.96),rgba(7,8,12,0.98))] p-4 shadow-[0_30px_90px_rgba(0,0,0,0.4)] sm:p-6 lg:p-8">
          <p className="inline-flex items-center rounded-full border border-red-400/20 bg-red-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.28em] text-red-200/90">
            PREMIUM MARKETPLACE
          </p>

          <div className="mt-5 space-y-4 sm:space-y-5">
            <h1 className="max-w-3xl font-display text-4xl font-semibold leading-tight text-white sm:text-5xl lg:text-6xl">
              Gainix{" "}
              <span className="bg-gradient-to-r from-red-200 via-red-400 to-amber-300 bg-clip-text text-transparent">
                NFT Trading
              </span>
            </h1>

            <p className="max-w-2xl text-base leading-7 text-zinc-200/90 sm:text-lg">
              Gainix NFT is a premium global NFT trading platform where users can buy, sell, and profit from digital
              assets with smart price growth and seamless blockchain transactions.
            </p>

            <p className="max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
              Built for high-performance trading, auto growth pricing, and next-gen NFT earning systems.
            </p>

            <div className="mt-4">
              <Suspense fallback={null}>
                <HeroActionButtons />
              </Suspense>
            </div>
          </div>
        </section>

        <HeroPrimaryActions imageSrc={heroImageSrc} imageAlt={heroNft.name} />
      </div>
    </main>
  );
}
