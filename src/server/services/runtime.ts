import { ensureStoreInitialized } from "@/server/services/db-state";
import { startTradingScheduler } from "@/server/services/scheduler";

export async function ensureTradingRuntime() {
  await ensureStoreInitialized();
  startTradingScheduler();
}
