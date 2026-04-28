import { processTradingEngineTick } from "@/server/services/trading-service";

declare global {
  // eslint-disable-next-line no-var
  var __gainixTradingSchedulerStarted: boolean | undefined;
}

export function startTradingScheduler() {
  if (globalThis.__gainixTradingSchedulerStarted) {
    return;
  }

  globalThis.__gainixTradingSchedulerStarted = true;

  processTradingEngineTick().catch(() => {
    globalThis.__gainixTradingSchedulerStarted = false;
  });

  setInterval(() => {
    processTradingEngineTick().catch(() => {
      // Keep the interval alive; route handlers surface errors on demand.
    });
  }, 60_000);
}
