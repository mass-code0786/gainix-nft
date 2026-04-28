"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useWalletAuth } from "@/hooks/useWalletAuth";
import { fetchJson } from "@/lib/api/client";
import type { AdminAnalytics, AdminOverview } from "@/types";

type AdminSettingsPayload = Partial<AdminOverview["settings"]>;

export function useAdminPanel(enabled: boolean) {
  const { fullAddress } = useWallet();
  const { ensureVerifiedSession, signPrompt, isSigning } = useWalletAuth(fullAddress);
  const [data, setData] = useState<AdminOverview | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setData(null);
      setAnalytics(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await ensureVerifiedSession();
      const [overview, analyticsPayload] = await Promise.all([
        fetchJson<AdminOverview>("/api/admin/overview"),
        fetchJson<AdminAnalytics>("/api/admin/analytics"),
      ]);
      setData(overview);
      setAnalytics(analyticsPayload);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load admin data.");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, ensureVerifiedSession]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveSettings = useCallback(
    async (payload: AdminSettingsPayload) => {
      setIsSaving(true);
      setError(null);
      setNotice(null);

      try {
        await ensureVerifiedSession();
        const response = await fetchJson<{ message: string; settings: AdminOverview["settings"] }>(
          "/api/admin/settings",
          {
            method: "PATCH",
            body: JSON.stringify(payload),
          },
        );
        setData((current) =>
          current
            ? {
                ...current,
                settings: response.settings,
              }
            : current,
        );
        setNotice(response.message);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Unable to save settings.");
      } finally {
        setIsSaving(false);
      }
    },
    [ensureVerifiedSession],
  );

  const saveReserve = useCallback(async (balance: number) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await ensureVerifiedSession();
      const response = await fetchJson<{ message: string; systemReserve: AdminOverview["systemReserve"] }>(
        "/api/admin/reserve",
        {
          method: "PATCH",
          body: JSON.stringify({ balance }),
        },
      );
      setData((current) =>
        current
          ? {
              ...current,
              systemReserve: response.systemReserve,
            }
          : current,
      );
      setNotice(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update reserve.");
    } finally {
      setIsSaving(false);
    }
  }, [ensureVerifiedSession]);

  const togglePayouts = useCallback(async (paused: boolean) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await ensureVerifiedSession();
      const response = await fetchJson<{ message: string; settings: AdminOverview["settings"] }>(
        "/api/admin/payout-control",
        {
          method: "POST",
          body: JSON.stringify({ paused }),
        },
      );
      setData((current) =>
        current
          ? {
              ...current,
              settings: response.settings,
            }
          : current,
      );
      setNotice(response.message);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update payout state.");
    } finally {
      setIsSaving(false);
    }
  }, [ensureVerifiedSession]);

  const approve = useCallback(async (withdrawalId: string) => {
    setIsSaving(true);
    setError(null);
    setNotice(null);

    try {
      await ensureVerifiedSession();
      await fetchJson<{ message: string }>("/api/admin/withdrawals/approve", {
        method: "POST",
        body: JSON.stringify({ withdrawalId }),
      });
      setNotice("Withdrawal approved.");
      await refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to approve withdrawal.");
    } finally {
      setIsSaving(false);
    }
  }, [ensureVerifiedSession, refresh]);

  return {
    data,
    analytics,
    isLoading,
    isSaving,
    error,
    notice,
    signPrompt,
    isSigning,
    refresh,
    saveSettings,
    saveReserve,
    togglePayouts,
    approve,
  };
}
