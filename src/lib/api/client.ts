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

async function parseErrorPayload(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = await parseErrorPayload(response);
    const message =
      typeof payload?.error === "string"
        ? payload.error
        : `Request failed with status ${response.status}.`;
    throw new ApiRequestError(message, response.status, payload);
  }

  return (await response.json()) as T;
}
