interface AppLogoProps {
  className?: string;
  showText?: boolean;
}

export function AppLogo({ className, showText = true }: AppLogoProps) {
  const rootClassName = ["flex min-w-0 items-center gap-2", className].filter(Boolean).join(" ");

  return (
    <div className={rootClassName}>
      <img
        src="/images/gxn-token.png"
        alt="GXN token logo"
        className="h-8 w-8 shrink-0 rounded-full border border-amber-300/30 object-cover shadow-[0_0_18px_rgba(168,85,247,0.25)] sm:h-9 sm:w-9"
      />
      {showText ? (
        <span className="truncate font-display text-sm font-semibold tracking-wide text-white sm:text-base">
          GAINIX NFT
        </span>
      ) : null}
    </div>
  );
}
