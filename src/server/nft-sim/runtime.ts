import { startNftTradingScheduler } from "@/server/nft-sim/scheduler";
import { ensureStoreInitialized } from "@/server/services/db-state";

export async function ensureNftTradingRuntime() {
  await ensureStoreInitialized();
  startNftTradingScheduler();
}
