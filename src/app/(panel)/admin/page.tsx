import { cookies } from "next/headers";
import AdminPageClient from "@/app/(panel)/admin/admin-client";
import { AdminDenied } from "@/app/(panel)/admin/admin-denied";
import { AdminSignIn } from "@/app/(panel)/admin/admin-sign-in";
import { AUTH_COOKIE, isAdminWallet, parseSessionToken } from "@/server/api/auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(AUTH_COOKIE)?.value;

  try {
    const session = parseSessionToken(sessionToken);
    const hasAdminAccess = await isAdminWallet(session.walletAddress);

    if (!hasAdminAccess) {
      return <AdminDenied walletAddress={session.walletAddress} />;
    }

    return <AdminPageClient />;
  } catch {
    return <AdminSignIn />;
  }
}
