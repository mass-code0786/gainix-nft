"use client";

import { useEffect, useState } from "react";

interface LatestListedNftsResponse {
  nfts: Array<{
    imageUrl: string;
  }>;
}

export function LatestListedNfts() {
  const [images, setImages] = useState<string[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLatestListings() {
      try {
        const response = await fetch("/api/marketplace/latest?limit=5", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("Unable to load latest NFTs.");
        }

        const payload = (await response.json()) as LatestListedNftsResponse;
        if (!controller.signal.aborted) {
          setImages(payload.nfts.map((item) => item.imageUrl).filter(Boolean).slice(0, 5));
        }
      } catch {
        if (!controller.signal.aborted) {
          setImages([]);
        }
      } finally {
        if (!controller.signal.aborted) {
          setHasLoaded(true);
        }
      }
    }

    void loadLatestListings();

    return () => controller.abort();
  }, []);

  if (!hasLoaded) {
    return null;
  }

  if (images.length === 0) {
    return (
      <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,7,10,0.88),rgba(7,8,12,0.96))] p-4 sm:p-5">
        <h2 className="font-display text-2xl font-semibold text-white">Latest Listed NFTs</h2>
        <p className="mt-3 text-sm text-zinc-400">No NFTs listed yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(18,7,10,0.88),rgba(7,8,12,0.96))] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
      <h2 className="font-display text-2xl font-semibold text-white">Latest Listed NFTs</h2>
      <div className="mt-4 -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid min-w-[620px] grid-cols-5 gap-3 sm:min-w-0">
          {images.map((imageUrl, index) => (
            <div
              key={`${imageUrl}-${index}`}
              className="aspect-square overflow-hidden rounded-[24px] border border-red-400/20 bg-black/35 shadow-[0_18px_40px_rgba(127,29,29,0.18)]"
            >
              <img
                src={imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="lazy"
                aria-hidden="true"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
