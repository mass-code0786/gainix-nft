export class ApiRequestError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown> | null;

  constructor(message: string, status: number, payload: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.payload = payload;
  }
}

const inFlightGetRequests = new Map<string, Promise<unknown>>();
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function endpointLabel(input: RequestInfo | URL) {
  const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = new URL(raw, typeof window === "undefined" ? "http://localhost" : window.location.origin);
    return `${url.pathname}${url.search}`;
  } catch {
    return raw;
  }
}

function cacheTtlMs(input: RequestInfo | URL, init?: RequestInit) {
  const cacheMode = init?.cache;
  if (cacheMode === "no-store" || init?.method || init?.body) {
    return 0;
  }

  const endpoint = endpointLabel(input);
  if (
    endpoint.startsWith("/api/deposit/config") ||
    endpoint.startsWith("/api/nft/marketplace")
  ) {
    return 15_000;
  }

  return 0;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const endpoint = endpointLabel(input);
  const method = init?.method ?? "GET";
  const ttlMs = cacheTtlMs(input, init);
  const cacheKey = `${method}:${endpoint}`;
  const cached = ttlMs > 0 ? responseCache.get(cacheKey) : null;

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value as T;
  }

  if (method === "GET" && !init?.body && !init?.signal) {
    const existing = inFlightGetRequests.get(cacheKey);
    if (existing) {
      return existing as Promise<T>;
    }
  }

  const requestStartedAt = performance.now();
  const request = (async () => {
    const response = await fetch(input, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    console.info(`[perf.api] endpoint=${endpoint} durationMs=${Math.round(performance.now() - requestStartedAt)}`);

    if (!response.ok) {
      const payload = await parseErrorPayload(response);
      const message =
        typeof payload?.error === "string"
          ? payload.error
          : `Request failed with status ${response.status}.`;
      throw new ApiRequestError(message, response.status, payload);
    }

    const payload = (await response.json()) as T;
    if (ttlMs > 0) {
      responseCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, value: payload });
    }

    return payload;
  })();

  if (method === "GET" && !init?.body && !init?.signal) {
    inFlightGetRequests.set(cacheKey, request);
    request.finally(() => inFlightGetRequests.delete(cacheKey));
  }

  return request;
}
