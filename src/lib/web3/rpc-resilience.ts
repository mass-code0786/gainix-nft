export const GAINIX_RPC_READ_TIMEOUT_MS = 3_500;
export const GAINIX_RPC_RETRY_LIMIT = 0;
export const GAINIX_RPC_SCAN_CAP = 24;
export const GAINIX_RPC_SCAN_BATCH_SIZE = 6;
export const GAINIX_RPC_FAILURE_BATCH_LIMIT = 2;

export function buildCappedScanIds({
  lastId,
  minId,
  scanCap = GAINIX_RPC_SCAN_CAP,
}: {
  lastId: number;
  minId: number;
  scanCap?: number;
}) {
  if (lastId < minId || scanCap <= 0) {
    return [];
  }

  const firstId = Math.max(minId, lastId - scanCap + 1);

  return Array.from({ length: lastId - firstId + 1 }, (_, index) => lastId - index);
}

export async function scanWithBatchCap<T>({
  ids,
  read,
  batchSize = GAINIX_RPC_SCAN_BATCH_SIZE,
  failureBatchLimit = GAINIX_RPC_FAILURE_BATCH_LIMIT,
}: {
  ids: number[];
  read: (id: number) => Promise<T | null>;
  batchSize?: number;
  failureBatchLimit?: number;
}) {
  const items: T[] = [];
  let consecutiveFailedBatches = 0;

  for (let index = 0; index < ids.length; index += batchSize) {
    const batchIds = ids.slice(index, index + batchSize);
    const batchResults = await Promise.all(batchIds.map((id) => read(id)));
    const successfulResults: T[] = [];

    for (const item of batchResults) {
      if (item !== null) {
        successfulResults.push(item);
      }
    }

    if (successfulResults.length === 0) {
      consecutiveFailedBatches += 1;
    } else {
      items.push(...successfulResults);
      consecutiveFailedBatches = 0;
    }

    if (consecutiveFailedBatches >= failureBatchLimit) {
      return {
        items,
        aborted: true,
        scanned: index + batchIds.length,
      };
    }
  }

  return {
    items,
    aborted: false,
    scanned: ids.length,
  };
}
