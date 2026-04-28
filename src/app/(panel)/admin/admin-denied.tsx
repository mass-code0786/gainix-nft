import { AnimatedPage } from "@/components/ui/animated-page";
import { PageHeader } from "@/components/ui/page-header";
interface AdminDeniedProps {
  walletAddress: string;
}

function shortWallet(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AdminDenied({ walletAddress }: AdminDeniedProps) {
  return (
    <AnimatedPage>
      <PageHeader title="Admin" />
      <div className="rounded-[28px] border border-amber-500/20 bg-amber-500/10 p-5 text-sm text-amber-200">
        Connected wallet {shortWallet(walletAddress)} is not authorized for admin access.
      </div>
    </AnimatedPage>
  );
}
