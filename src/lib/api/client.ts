/**
 * Minimal client for the ShopSphere backend.
 *
 * The browser talks only to the Express API; it never reaches PostgreSQL,
 * Kafka or OpenSearch directly. Override the base URL with
 * NEXT_PUBLIC_API_URL when the API is not on localhost:4000.
 */

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

/**
 * Empty means same-origin: next.config.mjs rewrites /api/* to the backend.
 * This keeps the browser talking to one origin in development and production.
 */
export const API_BASE_URL = (configuredApiUrl ?? "").replace(/\/+$/, "");

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiErrorBody = {
  error?: { message?: string; code?: string };
};

export async function apiGet<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
    cache: "no-store",
  });

  const body = (await response.json().catch(() => null)) as
    | (T & ApiErrorBody)
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.error?.message ?? `Request failed (${response.status})`,
      response.status,
      body?.error?.code
    );
  }

  if (!body) {
    throw new ApiError("The server returned an empty response", response.status);
  }

  return body as T;
}

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}
