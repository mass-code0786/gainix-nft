"use client";

import { useSyncExternalStore } from "react";

let refreshVersion = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return refreshVersion;
}

export function triggerContractDataRefresh() {
  refreshVersion += 1;

  listeners.forEach((listener) => listener());
}

export function useContractDataRefreshVersion() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
