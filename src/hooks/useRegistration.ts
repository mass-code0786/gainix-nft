"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/client";

interface UseRegistrationResult {
  isRegistered: boolean;
  isCheckingRegistration: boolean;
  registrationError: string | null;
  refreshRegistration: () => Promise<void>;
  registerWallet: (referralCode?: string) => Promise<{ message: string }>;
}

export function useRegistration(walletAddress?: string | null, isConnected = false): UseRegistrationResult {
  const [isRegistered, setIsRegistered] = useState(false);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(true);
  const [registrationError, setRegistrationError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setIsRegistered(false);
      setIsCheckingRegistration(false);
      setRegistrationError(null);
      return;
    }

    let isCancelled = false;
    async function checkRegistration() {
      setIsCheckingRegistration(true);
      setRegistrationError(null);

      try {
        const result = await fetchJson<{ isRegistered: boolean; user: unknown | null }>(
          `/api/me?walletAddress=${walletAddress}`,
        );
        if (!isCancelled) {
          setIsRegistered(result.isRegistered);
        }
      } catch (error) {
        if (!isCancelled) {
          setIsRegistered(false);
          setRegistrationError(error instanceof Error ? error.message : "Unable to check registration.");
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingRegistration(false);
        }
      }
    }

    void checkRegistration();

    return () => {
      isCancelled = true;
    };
  }, [walletAddress, isConnected]);

  async function refreshRegistration() {
    if (!isConnected || !walletAddress) {
      setIsRegistered(false);
      setRegistrationError(null);
      return;
    }

    setIsCheckingRegistration(true);
    setRegistrationError(null);

    try {
      const result = await fetchJson<{ isRegistered: boolean; user: unknown | null }>(
        `/api/me?walletAddress=${walletAddress}`,
      );
      setIsRegistered(result.isRegistered);
    } catch (error) {
      setIsRegistered(false);
      setRegistrationError(error instanceof Error ? error.message : "Unable to check registration.");
    } finally {
      setIsCheckingRegistration(false);
    }
  }

  async function registerWallet(referralCode?: string) {
    if (!walletAddress) {
      throw new Error("Connect a wallet before registering.");
    }

    setRegistrationError(null);
    const result = await fetchJson<{ message: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
        ...(referralCode ? { ref: referralCode } : {}),
      }),
    });

    setIsRegistered(true);
    return result;
  }

  return {
    isRegistered,
    isCheckingRegistration,
    registrationError,
    refreshRegistration,
    registerWallet,
  };
}
