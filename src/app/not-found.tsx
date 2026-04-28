import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 pt-24">
      <div className="section-shell max-w-md text-center">
        <p className="muted-label">404</p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white">Page not found</h1>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/dashboard" className="premium-button">
            Go to dashboard
          </Link>
          <Link href="/connect" className="secondary-button">
            Wallet connect
          </Link>
        </div>
      </div>
    </main>
  );
}
