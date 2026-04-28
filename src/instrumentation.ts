export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { ensureTradingRuntime } = await import("@/server/services/runtime");
  await ensureTradingRuntime();
}
