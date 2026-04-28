import { processTradingEngineTick } from "@/server/nft-sim/service";

declare global {
  // eslint-disable-next-line no-var
  var __gainixNftSchedulerStarted: boolean | undefined;
}

export function startNftTradingScheduler() {
  if (globalThis.__gainixNftSchedulerStarted) {
    return;
  }

  globalThis.__gainixNftSchedulerStarted = true;

  processTradingEngineTick().catch(() => {
    globalThis.__gainixNftSchedulerStarted = false;
  });

  setInterval(() => {
    processTradingEngineTick().catch(() => {
      // Keep the interval alive; route handlers surface errors on demand.
    });
  }, 60_000);
}
