import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:4000";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON",
        },
      },
      { status: 400 }
    );
  }

  const controller = new AbortController();
  // The free Hugging Face Space may sit in a queue before rendering, so this
  // proxy waits longer than the backend's own provider timeout.
  const timeout = setTimeout(() => controller.abort(), 150_000);

  try {
    const response = await fetch(`${BACKEND_URL}/api/tryon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const data = await response.json().catch(() => null);

    return NextResponse.json(
      data ?? {
        error: {
          code: "INVALID_BACKEND_RESPONSE",
          message: "The try-on service returned an invalid response",
        },
      },
      {
        status: response.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    // Log only the failure reason; request bodies and keys are never logged.
    console.error(
      "[api/tryon] backend request failed:",
      error instanceof Error ? error.name : "unknown"
    );

    return NextResponse.json(
      {
        error: {
          code: "BACKEND_UNAVAILABLE",
          message:
            "Could not reach the try-on service. Make sure the backend is running.",
        },
      },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  } finally {
    clearTimeout(timeout);
  }
}
