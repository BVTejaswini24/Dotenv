import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app";
import { pool } from "../src/db/pool";
import { AppError } from "../src/lib/errors";
import {
  parseTryOnRequest,
  MAX_IMAGE_BYTES,
} from "../src/modules/tryon/tryon.validation";
import { runAIVirtualTryOn } from "../src/modules/tryon/tryon.service";

const app = createApp();

/** 1x1 transparent PNG. Only the magic bytes matter for validation. */
const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const TINY_JPEG =
  "data:image/jpeg;base64," +
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]).toString(
    "base64"
  );

afterAll(async () => {
  await pool.end();
});

function tryOnPayload(overrides: Record<string, unknown> = {}) {
  return {
    personImage: TINY_PNG,
    garmentImage: TINY_PNG,
    category: "tops",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fakeFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>
) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    calls.push({ url, init });
    return handler(url, init);
  }) as typeof fetch;
  return { impl, calls };
}

describe("try-on image validation", () => {
  it("rejects a request without images", async () => {
    const res = await request(app).post("/api/tryon").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a person image that is only a server path", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(tryOnPayload({ personImage: "/images/product-3.jpg" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE_SOURCE");
  });

  it("rejects an unsupported image MIME type", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(
        tryOnPayload({
          personImage:
            "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        })
      );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE_TYPE");
  });

  it("rejects malformed base64", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(tryOnPayload({ personImage: "data:image/png;base64,abcde" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE_BASE64");
  });

  it("rejects a declared MIME type that does not match the bytes", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(
        tryOnPayload({
          personImage: TINY_JPEG.replace("image/jpeg", "image/png"),
        })
      );
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IMAGE_TYPE_MISMATCH");
  });

  it("rejects an image larger than 5 MB", async () => {
    const oversized =
      "data:image/jpeg;base64," +
      Buffer.alloc(MAX_IMAGE_BYTES + 1, 0xff).toString("base64");

    const res = await request(app)
      .post("/api/tryon")
      .send(tryOnPayload({ personImage: oversized }));

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("IMAGE_TOO_LARGE");
  });

  it("rejects path traversal in a garment path", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(tryOnPayload({ garmentImage: "/images/../../package.json" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_IMAGE_PATH");
  });

  it("rejects a missing local garment image", async () => {
    const res = await request(app)
      .post("/api/tryon")
      .send(tryOnPayload({ garmentImage: "/images/does-not-exist.jpg" }));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("IMAGE_NOT_FOUND");
  });

  it("returns 422 and no image when no provider is configured", async () => {
    const res = await request(app).post("/api/tryon").send(tryOnPayload());

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("MISSING_TRYON_API_KEY");
    expect(res.body.fallbackAllowed).toBe(false);
    expect(res.body.data).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("imageUrl");
  });

  it("rejects an oversized body on non-try-on routes with 413", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "a".repeat(2 * 1024 * 1024), password: "x" });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });

  it("validates prediction status ids and provider filters", async () => {
    const badId = await request(app).get("/api/tryon/status/not valid");
    expect(badId.status).toBe(400);
    expect(badId.body.error.code).toBe("INVALID_PREDICTION_ID");

    const badProvider = await request(app).get(
      "/api/tryon/status/pred-123456?provider=other"
    );
    expect(badProvider.status).toBe(400);

    const noKey = await request(app).get(
      "/api/tryon/status/pred-123456?provider=fashn"
    );
    expect(noKey.status).toBe(422);
    expect(noKey.body.error.code).toBe("MISSING_TRYON_API_KEY");
  });

  it("maps each glasses product to its own overlay", async () => {
    const res = await request(app).get("/api/tryon/products");
    expect(res.status).toBe(200);

    const products = res.body.data.products as Array<{
      id: number;
      tryOnCategory: string;
      overlayUrl?: string;
    }>;
    const glasses = products.filter((p) => p.tryOnCategory === "glasses");
    expect(glasses.length).toBeGreaterThan(1);

    for (const product of glasses) {
      expect([
        "/images/tryon/classic-sunglasses.png",
        "/images/tryon/aviator-sunglasses.png",
      ]).toContain(product.overlayUrl);
    }

    expect(products.find((p) => p.id === 33)?.overlayUrl).toBe(
      "/images/tryon/classic-sunglasses.png"
    );
    expect(products.find((p) => p.id === 142)?.overlayUrl).toBe(
      "/images/tryon/aviator-sunglasses.png"
    );
  });
});

describe("provider request handling (mocked, no live calls)", () => {
  const prepared = parseTryOnRequest(tryOnPayload());

  it("sends the documented FASHN v1.6 envelope and returns its image", async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.endsWith("/v1/run")) {
        return jsonResponse({ id: "pred_123456", error: null });
      }
      if (url.includes("/v1/status/")) {
        return jsonResponse({
          id: "pred_123456",
          status: "completed",
          output: ["https://cdn.fashn.ai/pred_123456/output_0.png"],
          error: null,
        });
      }
      return jsonResponse({ error: { message: "unexpected url" } }, 500);
    });

    const result = await runAIVirtualTryOn(prepared, {
      fashnApiKey: "fa-test-key-not-real",
      fetchImpl: impl,
      pollIntervalMs: 1,
      maxPolls: 2,
    });

    expect(result).toMatchObject({
      success: true,
      provider: "fashn",
      status: "completed",
      imageUrl: "https://cdn.fashn.ai/pred_123456/output_0.png",
    });

    const runCall = calls.find((call) => call.url.endsWith("/v1/run"));
    expect(runCall).toBeTruthy();
    const body = JSON.parse(String(runCall?.init?.body));
    expect(body.model_name).toBe("tryon-v1.6");
    expect(body.inputs).toMatchObject({
      model_image: TINY_PNG,
      garment_image: TINY_PNG,
      category: "tops",
      mode: "balanced",
      moderation_level: "conservative",
    });
    // The key belongs in the Authorization header only, never in the body.
    expect(JSON.stringify(body)).not.toContain("fa-test-key-not-real");
  });

  it("falls back to Replicate when FASHN fails", async () => {
    const { impl, calls } = fakeFetch((url) => {
      if (url.includes("fashn.ai/v1/run")) {
        return jsonResponse({ error: { message: "PoseError" } }, 422);
      }
      if (url.includes("replicate.com/v1/models/")) {
        return jsonResponse({
          id: "rep_123456",
          status: "succeeded",
          output: "https://replicate.delivery/pbxt/result.png",
        });
      }
      return jsonResponse({ detail: "unexpected url" }, 500);
    });

    const result = await runAIVirtualTryOn(prepared, {
      fashnApiKey: "fa-test-key-not-real",
      replicateApiToken: "r8_test_token_not_real",
      fetchImpl: impl,
      pollIntervalMs: 1,
      maxPolls: 2,
    });

    expect(result).toMatchObject({
      success: true,
      provider: "replicate",
      status: "completed",
      imageUrl: "https://replicate.delivery/pbxt/result.png",
    });

    const replicateCall = calls.find((call) =>
      call.url.includes("replicate.com/v1/models/")
    );
    const body = JSON.parse(String(replicateCall?.init?.body));
    expect(body.input).toMatchObject({
      human_img: TINY_PNG,
      garm_img: TINY_PNG,
      category: "upper_body",
    });
  });

  it("never marks a queued job as a completed success", async () => {
    const { impl } = fakeFetch((url) => {
      if (url.endsWith("/v1/run")) {
        return jsonResponse({ id: "pred_123456", error: null });
      }
      return jsonResponse({ id: "pred_123456", status: "processing", output: null });
    });

    const result = await runAIVirtualTryOn(prepared, {
      fashnApiKey: "fa-test-key-not-real",
      fetchImpl: impl,
      pollIntervalMs: 1,
      maxPolls: 2,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("processing");
    expect(result.imageUrl).toBeUndefined();
    expect(result.message).toBe("TRYON_PENDING");
  });

  it("redacts provider credentials from returned error details", async () => {
    const fashnSecret = "fa-live-SECRETVALUE123456";
    const replicateSecret = "r8_SECRETVALUE123456";
    const { impl } = fakeFetch((url) => {
      if (url.includes("fashn.ai")) {
        return jsonResponse(
          { error: { message: `invalid key ${fashnSecret}` } },
          401
        );
      }
      return jsonResponse({ detail: `Unauthorized ${replicateSecret}` }, 401);
    });

    const error = await runAIVirtualTryOn(prepared, {
      fashnApiKey: fashnSecret,
      replicateApiToken: replicateSecret,
      fetchImpl: impl,
      pollIntervalMs: 1,
      maxPolls: 1,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.status).toBe(502);
    expect(appError.code).toBe("TRYON_PROVIDER_ERROR");
    const serialized = JSON.stringify(appError.details);
    expect(serialized).not.toContain("SECRETVALUE");
    expect(serialized).toContain("[redacted]");
  });
});

describe("Hugging Face Space provider (mocked, no live calls)", () => {
  const HF_BASE = "https://hf-space.test";
  const HF_TOKEN = "hf_test_token_not_real";
  const UPLOAD_PATH = "/tmp/gradio/uploaded-image.png";
  const OUTPUT_URL = `${HF_BASE}/gradio_api/file=/tmp/gradio/out.png`;
  const PNG_BYTES = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    )
  );

  function sseResponse(body: string): Response {
    return new Response(body, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  }

  function imageResponse(): Response {
    return new Response(PNG_BYTES, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Content-Length": String(PNG_BYTES.length),
      },
    });
  }

  function hfRoutes(
    overrides: { submit?: Response; stream?: Response } = {}
  ) {
    return fakeFetch((url) => {
      if (url.endsWith("/gradio_api/upload")) {
        return jsonResponse([UPLOAD_PATH]);
      }
      if (url.endsWith("/gradio_api/call/try_on")) {
        return overrides.submit ?? jsonResponse({ event_id: "evt_1234567890" });
      }
      if (url.includes("/gradio_api/call/try_on/evt_1234567890")) {
        return (
          overrides.stream ??
          sseResponse(
            `event: complete\ndata: [{"path":"/tmp/gradio/out.png","url":"${OUTPUT_URL}"}]\n\n`
          )
        );
      }
      if (url === OUTPUT_URL) return imageResponse();
      return jsonResponse({ detail: `unexpected url ${url}` }, 500);
    });
  }

  it("uploads both images and returns the generated Space image", async () => {
    const { impl, calls } = hfRoutes();

    const result = await runAIVirtualTryOn(
      parseTryOnRequest(tryOnPayload({ category: "dress" })),
      {
        hfToken: HF_TOKEN,
        hfSpaceUrl: HF_BASE,
        fetchImpl: impl,
        hfWaitMs: 1000,
      }
    );

    expect(result).toMatchObject({
      success: true,
      provider: "hf-space",
      status: "completed",
      imageUrl: OUTPUT_URL,
      predictionId: "evt_1234567890",
    });

    const uploads = calls.filter((call) =>
      call.url.endsWith("/gradio_api/upload")
    );
    expect(uploads).toHaveLength(2);
    for (const upload of uploads) {
      const headers = upload.init?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toContain("multipart/form-data; boundary=");
      expect(headers.Authorization).toBe(`Bearer ${HF_TOKEN}`);
    }

    const submit = calls.find((call) =>
      call.url.endsWith("/gradio_api/call/try_on")
    );
    expect(submit).toBeTruthy();
    const headers = submit?.init?.headers as Record<string, string>;
    const body = JSON.parse(String(submit?.init?.body)) as { data: unknown[] };

    // Exact order and types verified from the live /gradio_api/info.
    expect(body.data).toEqual([
      { path: UPLOAD_PATH, meta: { _type: "gradio.FileData" } },
      { path: UPLOAD_PATH, meta: { _type: "gradio.FileData" } },
      "one-pieces",
      "model",
      50,
      1.5,
      42,
      true,
    ]);
    expect(JSON.stringify(body)).not.toContain(HF_TOKEN);
    expect(headers.Authorization).toBe(`Bearer ${HF_TOKEN}`);
  });

  it("reports a queued Space job as pending instead of success", async () => {
    const { impl } = hfRoutes({
      stream: sseResponse("event: heartbeat\ndata: null\n\n"),
    });

    const result = await runAIVirtualTryOn(parseTryOnRequest(tryOnPayload()), {
      hfToken: HF_TOKEN,
      hfSpaceUrl: HF_BASE,
      fetchImpl: impl,
      hfWaitMs: 10,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe("in_queue");
    expect(result.provider).toBe("hf-space");
    expect(result.imageUrl).toBeUndefined();
    expect(result.predictionId).toBe("evt_1234567890");
    expect(String(result.details?.statusEndpoint)).toContain(
      "provider=hf-space"
    );
  });

  it("maps Space quota exhaustion to a 429 error", async () => {
    const { impl } = hfRoutes({
      stream: sseResponse(
        'event: error\ndata: "You have exceeded your ZeroGPU quota (60s requested vs. 5s left)."\n\n'
      ),
    });

    const error = await runAIVirtualTryOn(
      parseTryOnRequest(tryOnPayload()),
      {
        hfToken: HF_TOKEN,
        hfSpaceUrl: HF_BASE,
        fetchImpl: impl,
        hfWaitMs: 1000,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(429);
    expect((error as AppError).code).toBe("TRYON_QUOTA_EXHAUSTED");
  });

  it("rejects a Space response that is not a real image", async () => {
    const { impl } = hfRoutes({
      stream: sseResponse(
        `event: complete\ndata: [{"path":"/tmp/gradio/out.png","url":"${OUTPUT_URL}"}]\n\n`
      ),
    });

    const htmlImpl = (async (
      input: RequestInfo | URL,
      init?: RequestInit
    ) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      if (url === OUTPUT_URL) {
        return new Response("<html>not an image</html>", {
          status: 200,
          headers: { "Content-Type": "text/html" },
        });
      }
      return impl(input, init);
    }) as typeof fetch;

    const error = await runAIVirtualTryOn(
      parseTryOnRequest(tryOnPayload()),
      {
        hfToken: HF_TOKEN,
        hfSpaceUrl: HF_BASE,
        fetchImpl: htmlImpl,
        hfWaitMs: 1000,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(502);
    expect((error as AppError).code).toBe("TRYON_INVALID_OUTPUT");
  });

  it("reports Space downtime without claiming success", async () => {
    const { impl } = hfRoutes({
      submit: jsonResponse({ detail: "Service unavailable" }, 503),
    });

    const error = await runAIVirtualTryOn(
      parseTryOnRequest(tryOnPayload()),
      {
        hfToken: HF_TOKEN,
        hfSpaceUrl: HF_BASE,
        fetchImpl: impl,
        hfWaitMs: 1000,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).status).toBe(502);
    expect((error as AppError).code).toBe("TRYON_SPACE_UNAVAILABLE");
  });

  it("does not publish a broken completion payload as an image", async () => {
    const { impl } = hfRoutes({
      stream: sseResponse("event: complete\ndata: []\n\n"),
    });

    const error = await runAIVirtualTryOn(
      parseTryOnRequest(tryOnPayload()),
      {
        hfToken: HF_TOKEN,
        hfSpaceUrl: HF_BASE,
        fetchImpl: impl,
        hfWaitMs: 1000,
      }
    ).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe("TRYON_INVALID_OUTPUT");
  });
});
