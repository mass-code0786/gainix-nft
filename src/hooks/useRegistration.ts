"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/api/client";

interface UseRegistrationResult {
  isRegistered: boolean;
  isCheckingRegistration: boolean;
  registrationError: string | null;
  refreshRegistration: () => Promise<void>;
  registerWallet: () => Promise<{ message: string }>;
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
        await fetchJson(`/api/wallet?walletAddress=${walletAddress}`);
        if (!isCancelled) {
          setIsRegistered(true);
        }
      } catch {
        if (!isCancelled) {
          setIsRegistered(false);
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
      await fetchJson(`/api/wallet?walletAddress=${walletAddress}`);
      setIsRegistered(true);
    } catch {
      setIsRegistered(false);
    } finally {
      setIsCheckingRegistration(false);
    }
  }

  async function registerWallet() {
    if (!walletAddress) {
      throw new Error("Connect a wallet before registering.");
    }

    setRegistrationError(null);

    const result = await fetchJson<{ message: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({
        walletAddress,
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
