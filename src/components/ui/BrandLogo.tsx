interface BrandLogoProps {
  className?: string;
}

export function BrandLogo({ className }: BrandLogoProps) {
  const rootClassName = ["flex min-w-[88px] flex-col items-start leading-tight", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <span className="text-lg font-bold tracking-wide text-red-500">GAINIX</span>

      <div className="mt-[2px] flex w-full items-center justify-start">
        <div className="h-[1px] flex-1 bg-red-500 opacity-60" />
        <span className="px-2 text-[10px] font-semibold tracking-widest text-red-400">NFT</span>
        <div className="h-[1px] flex-1 bg-red-500 opacity-60" />
      </div>
    </div>
  );
}
