const REGISTERED_WALLETS_STORAGE_KEY = "gainix:registered-wallets";
const MOCK_REGISTRATION_DELAY_MS = 1_800;

export interface MockRegistrationReceipt {
  walletAddress: string;
  gasFeeBnb: number;
  txHash: string;
  registeredAt: number;
}

function normalizeWalletAddress(walletAddress: string) {
  return walletAddress.trim().toLowerCase();
}

function readRegisteredWallets() {
  if (typeof window === "undefined") {
    return [] as string[];
  }

  const rawValue = window.localStorage.getItem(REGISTERED_WALLETS_STORAGE_KEY);

  if (!rawValue) {
    return [] as string[];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as string[];
    }

    return parsedValue
      .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)
      .map((entry) => normalizeWalletAddress(entry));
  } catch {
    return [] as string[];
  }
}

function writeRegisteredWallets(walletAddresses: string[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(REGISTERED_WALLETS_STORAGE_KEY, JSON.stringify(Array.from(new Set(walletAddresses))));
}

function createMockTxHash() {
  const randomSegments = Array.from({ length: 4 }, () => Math.random().toString(16).slice(2).padEnd(16, "0").slice(0, 16));
  return `0x${randomSegments.join("")}`.slice(0, 66);
}

export function isWalletRegistered(walletAddress?: string | null) {
  if (!walletAddress) {
    return false;
  }

  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);
  return readRegisteredWallets().includes(normalizedWalletAddress);
}

export async function registerWalletWithMockContract(walletAddress: string) {
  const normalizedWalletAddress = normalizeWalletAddress(walletAddress);

  await new Promise((resolve) => {
    window.setTimeout(resolve, MOCK_REGISTRATION_DELAY_MS);
  });

  const currentWallets = readRegisteredWallets();
  writeRegisteredWallets([...currentWallets, normalizedWalletAddress]);

  return {
    walletAddress: normalizedWalletAddress,
    gasFeeBnb: 0.00042,
    txHash: createMockTxHash(),
    registeredAt: Date.now(),
  } satisfies MockRegistrationReceipt;
}
