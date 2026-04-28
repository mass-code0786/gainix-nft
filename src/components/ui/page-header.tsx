import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: {
    href: string;
    label: string;
  };
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-2">
        {eyebrow ? <p className="muted-label">{eyebrow}</p> : null}
        <div className="space-y-2">
          <h1 className="font-display text-[2rem] font-semibold tracking-tight text-white sm:text-[2.5rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-sm leading-7 text-zinc-400 sm:text-base">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? (
        <Link href={action.href} prefetch={false} className="secondary-button w-fit shrink-0">
          {action.label}
          <ChevronRight className="ml-2 h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
