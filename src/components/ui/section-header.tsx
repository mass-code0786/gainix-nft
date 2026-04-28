import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  href?: string;
  actionLabel?: string;
}

export function SectionHeader({
  title,
  subtitle,
  href,
  actionLabel = "View all",
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-xl font-semibold text-white sm:text-2xl">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
      </div>
      {href ? (
        <Link
          href={href}
          prefetch={false}
          className="inline-flex items-center text-xs font-medium uppercase tracking-[0.18em] text-zinc-300 transition hover:text-white"
        >
          {actionLabel}
          <ChevronRight className="ml-1 h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
