import { startNftTradingScheduler } from "@/server/nft-sim/scheduler";
import { ensureStoreInitialized } from "@/server/nft-sim/store";

export async function ensureNftTradingRuntime() {
  await ensureStoreInitialized();
  startNftTradingScheduler();
}
