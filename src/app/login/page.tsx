import Link from "next/link";
import { KeyRound, ShieldCheck, Wallet2 } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";

const loginNotes = [
  "Wallet-only sign-in.",
  "Fast access across marketplace, portfolio, and wallet.",
  "Built for a clean BNB Chain experience.",
] as const;

export default function LoginPage() {
  return (
    <main className="px-4 pb-10 pt-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="text-center">
          <p className="muted-label">Authentication</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-white sm:text-5xl">
            Wallet Sign-In
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
            Connect your wallet to enter Gainix NFT.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <GlassCard className="space-y-5">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-gainix-400/20 bg-gainix-500/10 px-3 py-2 text-sm text-gainix-200">
              <Wallet2 className="h-4 w-4" />
              Wallet Required
            </div>
            <h2 className="font-display text-2xl font-semibold text-white sm:text-3xl">
              Continue with your BNB Chain wallet
            </h2>
            <p className="text-sm leading-7 text-zinc-400">
              Use the connect button in the header, then continue to the dashboard.
            </p>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/connect" className="premium-button">
                Open Connect Screen
              </Link>
              <Link href="/dashboard" className="secondary-button">
                Open Dashboard
              </Link>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-gainix-300" />
              <p className="font-display text-xl font-semibold text-white">Access Notes</p>
            </div>
            {loginNotes.map((note) => (
              <div key={note} className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-zinc-300">
                {note}
              </div>
            ))}
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 text-emerald-200">
                <ShieldCheck className="h-4 w-4" />
                <p className="text-sm font-medium">Secure access</p>
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-100/90">
                Wallet identity is used as the account boundary across the entire app.
              </p>
            </div>
          </GlassCard>
        </div>
      </div>
    </main>
  );
}
