import { randomUUID } from "node:crypto";
import catalog from "../../data/catalog.json";
import { env } from "../../config/env";
import { AppError } from "../../lib/errors";
import { detectImageMime, MAX_IMAGE_BYTES } from "./tryon.validation";
import type {
  PreparedImage,
  PreparedTryOnRequest,
} from "./tryon.validation";

export type TryOnCategory = "shirt" | "glasses" | "dress";

export type TryOnProduct = {
  id: number;
  title: string;
  category: string;
  tryOnCategory: TryOnCategory;
  tryOnType: "clothing_ai" | "glasses_ar";
  srcUrl: string;
  price: number;
  brand: string;
  gender?: string;
  overlayUrl?: string;
};

const OVERLAY_CLASSIC = "/images/tryon/classic-sunglasses.png";
const OVERLAY_AVIATOR = "/images/tryon/aviator-sunglasses.png";

/**
 * Single source of truth for the glasses overlay on the server. The frontend
 * mirrors this mapping in `src/lib/utils/tryon.ts`; keep both in sync.
 */
export function getGlassesOverlay(product: {
  id?: number;
  title?: string;
  overlayUrl?: string;
}): string {
  if (product.overlayUrl === OVERLAY_AVIATOR) return OVERLAY_AVIATOR;
  if (product.overlayUrl === OVERLAY_CLASSIC) return OVERLAY_CLASSIC;

  if (product.id === 142) return OVERLAY_AVIATOR;
  if (product.id === 33) return OVERLAY_CLASSIC;

  const title = (product.title ?? "").toLowerCase();
  if (/aviator|pilot|teardrop|versace/.test(title)) return OVERLAY_AVIATOR;
  if (/classic|round|retro|wayfarer|square/.test(title)) return OVERLAY_CLASSIC;

  const key =
    product.id ??
    Array.from(title).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return key % 2 === 0 ? OVERLAY_AVIATOR : OVERLAY_CLASSIC;
}

// Curated feature products representing the 3 target categories
export const FEATURED_TRYON_PRODUCTS: TryOnProduct[] = [
  // 1. Men's shirt
  {
    id: 3,
    title: "Checkered Shirt",
    category: "shirts",
    tryOnCategory: "shirt",
    tryOnType: "clothing_ai",
    srcUrl: "/images/product-3.jpg",
    price: 180,
    brand: "LUXE",
    gender: "men",
  },
  {
    id: 54,
    title: "Prada Tailored Italian Poplin Dress Shirt",
    category: "shirts",
    tryOnCategory: "shirt",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/shirts/product-54.jpg",
    price: 950,
    brand: "Prada",
    gender: "men",
  },
  // 2. Sunglasses / glasses (real-time AR face tracking)
  {
    id: 33,
    title: "Classic Sunglasses",
    category: "accessories",
    tryOnCategory: "glasses",
    tryOnType: "glasses_ar",
    srcUrl: "/images/product-33.jpg",
    price: 120,
    brand: "LUXE",
    gender: "unisex",
    overlayUrl: OVERLAY_CLASSIC,
  },
  {
    id: 142,
    title: "Versace Polarized Acetate Aviator Sunglasses",
    category: "accessories",
    tryOnCategory: "glasses",
    tryOnType: "glasses_ar",
    srcUrl: "/images/products/accessories/product-142.jpg",
    price: 360,
    brand: "Versace",
    gender: "unisex",
    overlayUrl: OVERLAY_AVIATOR,
  },
  // 3. Women's dress / evening wear
  {
    id: 60,
    title: "Zara Satin Draped Evening Blouse",
    category: "shirts",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/shirts/product-60.jpg",
    price: 110,
    brand: "Zara",
    gender: "women",
  },
  {
    id: 17,
    title: "Women's Linen Blend Shirt",
    category: "shirts",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/product-17.jpg",
    price: 130,
    brand: "LUXE",
    gender: "women",
  },
  {
    id: 129,
    title: "Zara Classic Trench Coat with Storm Flap",
    category: "jackets",
    tryOnCategory: "dress",
    tryOnType: "clothing_ai",
    srcUrl: "/images/products/jackets/product-129.jpg",
    price: 260,
    brand: "Zara",
    gender: "women",
  },
];

/**
 * Returns all catalog products that qualify for Virtual Try-On.
 */
export function getEligibleProducts(): TryOnProduct[] {
  const result: TryOnProduct[] = [...FEATURED_TRYON_PRODUCTS];
  const seenIds = new Set(result.map((p) => p.id));

  const all = catalog.products as Array<{
    id: number;
    title: string;
    category: string;
    srcUrl: string;
    price: number;
    brand?: string;
    gender?: string;
    tags?: string[];
  }>;

  for (const item of all) {
    if (seenIds.has(item.id)) continue;

    const title = (item.title || "").toLowerCase();
    const cat = (item.category || "").toLowerCase();
    const gender = (item.gender || "").toLowerCase();

    if (/sunglass|glasses|eyewear/.test(title)) {
      result.push({
        id: item.id,
        title: item.title,
        category: item.category,
        tryOnCategory: "glasses",
        tryOnType: "glasses_ar",
        srcUrl: item.srcUrl,
        price: item.price,
        brand: item.brand || "LUXE",
        gender: item.gender,
        overlayUrl: getGlassesOverlay(item),
      });
      seenIds.add(item.id);
    } else if (gender === "women" && (/dress|blouse|gown/.test(title) || cat === "dresses")) {
      result.push({
        id: item.id,
        title: item.title,
        category: item.category,
        tryOnCategory: "dress",
        tryOnType: "clothing_ai",
        srcUrl: item.srcUrl,
        price: item.price,
        brand: item.brand || "LUXE",
        gender: item.gender,
      });
      seenIds.add(item.id);
    } else if (cat === "shirts" || /shirt|polo/.test(title)) {
      result.push({
        id: item.id,
        title: item.title,
        category: item.category,
        tryOnCategory: gender === "women" ? "dress" : "shirt",
        tryOnType: "clothing_ai",
        srcUrl: item.srcUrl,
        price: item.price,
        brand: item.brand || "LUXE",
        gender: item.gender,
      });
      seenIds.add(item.id);
    }
  }

  return result;
}

export type TryOnProvider = "fashn" | "replicate" | "hf-space" | "none";
export type TryOnStatus = "completed" | "processing" | "in_queue" | "failed";

export type TryOnResponse = {
  success: boolean;
  predictionId?: string;
  status: TryOnStatus;
  imageUrl?: string;
  provider: TryOnProvider;
  message?: string;
  details?: Record<string, unknown>;
};

export type ProviderOptions = {
  fashnApiKey?: string;
  replicateApiToken?: string;
  /** Optional Hugging Face token for the free FASHN VTON v1.5 Space. */
  hfToken?: string;
  /** Space origin override, mainly for tests and mirrors. */
  hfSpaceUrl?: string;
  /** How long to wait for a Space result before reporting it as queued. */
  hfWaitMs?: number;
  /** How long a status check waits for a queued Space job. */
  hfStatusWaitMs?: number;
  fetchImpl?: typeof fetch;
  /** Delay between status polls. Default 2500 ms. */
  pollIntervalMs?: number;
  /** Maximum number of status polls. Default 12 (~30 s). */
  maxPolls?: number;
};

type JsonObject = Record<string, unknown>;

const FASHN_RUN_URL = "https://api.fashn.ai/v1/run";
const FASHN_STATUS_URL = "https://api.fashn.ai/v1/status";
const FASHN_MODEL = "tryon-v1.6";

const REPLICATE_MODEL_URL =
  "https://api.replicate.com/v1/models/cuuupid/idm-vton/predictions";
// Kept as a fallback for accounts/proxies that reject the model shortcut.
const REPLICATE_VERSION_URL =
  "https://api.replicate.com/v1/predictions";
const REPLICATE_VERSION =
  "c871bb9b046607b680449ecbae55fd8c6d945e0a1948644bf2361b3d021d3084";

const DEFAULT_POLL_INTERVAL_MS = 2500;
const DEFAULT_MAX_POLLS = 12;
const REQUEST_TIMEOUT_MS = 25_000;

// Hugging Face Space provider: the public, free FASHN VTON v1.5 Gradio demo.
const HF_SPACE_URL = "https://fashn-ai-fashn-vton-1-5.hf.space";
const HF_UPLOAD_PATH = "/gradio_api/upload";
const HF_CALL_PATH = "/gradio_api/call/try_on";
const HF_REQUEST_TIMEOUT_MS = 30_000;
const HF_WAIT_TIMEOUT_MS = 120_000;
const HF_STATUS_WAIT_MS = 8_000;
const MAX_OUTPUT_IMAGE_BYTES = 15 * 1024 * 1024;
const HF_TIMESTEPS = 50;
const HF_GUIDANCE_SCALE = 1.5;
const HF_SEED = 42;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJson(response: Response): Promise<JsonObject | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" ? (value as JsonObject) : null;
  } catch {
    return null;
  }
}

/** Removes anything that looks like an API credential from provider strings. */
function sanitizeProviderMessage(message: unknown): string {
  const raw =
    typeof message === "string"
      ? message
      : message instanceof Error
        ? message.message
        : "Unknown provider error";

  return raw
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/\b(?:fa-|r8_|fal_|hf_)[A-Za-z0-9_-]{6,}\b/g, "[redacted]")
    .replace(
      /(?:api[_-]?key|token|authorization)["']?\s*[:=]\s*["']?[^"',}\s]+/gi,
      "$1=[redacted]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

function providerErrorText(data: JsonObject | null, status: number): string {
  const error = data?.error;
  if (typeof error === "string") return sanitizeProviderMessage(error);
  if (error && typeof error === "object") {
    const record = error as JsonObject;
    const message =
      typeof record.message === "string"
        ? record.message
        : typeof record.name === "string"
          ? record.name
          : null;
    if (message) return sanitizeProviderMessage(message);
  }
  if (typeof data?.message === "string") {
    return sanitizeProviderMessage(data.message);
  }
  if (typeof data?.detail === "string") {
    return sanitizeProviderMessage(data.detail);
  }
  return `Provider request failed with HTTP ${status}`;
}

/** Accepts provider output as https URL, CDN host without scheme, or data URI. */
function normalizeOutputUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (raw === "") return null;

  if (raw.startsWith("data:image/")) {
    return raw.length > MAX_IMAGE_BYTES * 2 ? null : raw;
  }

  const withScheme = raw.startsWith("//")
    ? `https:${raw}`
    : /^[a-z][a-z0-9+.-]*:\/\//i.test(raw)
      ? raw
      : `https://${raw}`;

  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function firstOutput(value: unknown): unknown {
  if (Array.isArray(value)) return value[0];
  return value;
}

function fashnCategory(category: PreparedTryOnRequest["category"]): string {
  switch (category) {
    case "dress":
    case "one-pieces":
      return "one-pieces";
    case "bottoms":
      return "bottoms";
    case "auto":
      return "auto";
    default:
      return "tops";
  }
}

function replicateCategory(category: PreparedTryOnRequest["category"]): string {
  switch (category) {
    case "dress":
    case "one-pieces":
      return "dresses";
    case "bottoms":
      return "lower_body";
    default:
      return "upper_body";
  }
}

function mapFashnStatus(status: unknown): TryOnStatus {
  switch (status) {
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "in_queue":
      return "in_queue";
    default:
      return "processing";
  }
}

function mapReplicateStatus(status: unknown): TryOnStatus {
  switch (status) {
    case "succeeded":
      return "completed";
    case "failed":
    case "canceled":
      return "failed";
    default:
      return "processing";
  }
}

async function pollFashn(
  predictionId: string,
  apiKey: string,
  options: Required<Pick<ProviderOptions, "fetchImpl" | "pollIntervalMs" | "maxPolls">>
): Promise<TryOnResponse> {
  for (let attempt = 0; attempt < options.maxPolls; attempt += 1) {
    await sleep(options.pollIntervalMs);

    const response = await options.fetchImpl(
      `${FASHN_STATUS_URL}/${encodeURIComponent(predictionId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    const data = await readJson(response);

    if (!response.ok) {
      throw new Error(providerErrorText(data, response.status));
    }

    const status = mapFashnStatus(data?.status);
    if (status === "completed") {
      const imageUrl = normalizeOutputUrl(firstOutput(data?.output));
      if (!imageUrl) {
        throw new Error("FASHN completed without returning an image");
      }
      return {
        success: true,
        predictionId,
        status: "completed",
        imageUrl,
        provider: "fashn",
      };
    }

    if (status === "failed") {
      throw new Error(providerErrorText(data, response.status));
    }
  }

  return {
    success: false,
    predictionId,
    status: "processing",
    provider: "fashn",
    message: "TRYON_PENDING",
    details: {
      retryAfterSeconds: 3,
      statusEndpoint: `/api/tryon/status/${predictionId}?provider=fashn`,
    },
  };
}

async function runFashn(
  req: PreparedTryOnRequest,
  apiKey: string,
  options: Required<Pick<ProviderOptions, "fetchImpl" | "pollIntervalMs" | "maxPolls">>
): Promise<TryOnResponse> {
  const response = await options.fetchImpl(FASHN_RUN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model_name: FASHN_MODEL,
      inputs: {
        model_image: req.personImage,
        garment_image: req.garmentImage,
        category: fashnCategory(req.category),
        mode: "balanced",
        moderation_level: "conservative",
        garment_photo_type: "auto",
        output_format: "jpeg",
        num_samples: 1,
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  const data = await readJson(response);
  if (!response.ok || data?.error) {
    throw new Error(providerErrorText(data, response.status));
  }

  const predictionId =
    typeof data?.id === "string" && data.id.length > 0 ? data.id : null;
  if (!predictionId) {
    throw new Error("FASHN did not return a prediction id");
  }

  return pollFashn(predictionId, apiKey, options);
}

async function postReplicate(
  req: PreparedTryOnRequest,
  token: string,
  fetchImpl: typeof fetch
): Promise<{ id: string | null; status: TryOnStatus; imageUrl: string | null; raw: JsonObject | null; httpStatus: number }> {
  const input = {
    human_img: req.personImage,
    garm_img: req.garmentImage,
    garment_des: req.productTitle || "clothing item",
    category: replicateCategory(req.category),
    crop: true,
    steps: 30,
  };

  const request = async (url: string, body: JsonObject) => {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "wait",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65_000),
    });
    return { response, data: await readJson(response) };
  };

  let { response, data } = await request(REPLICATE_MODEL_URL, { input });

  // Some Replicate-compatible proxies only expose the versioned endpoint.
  if (response.status === 404 || response.status === 422) {
    ({ response, data } = await request(REPLICATE_VERSION_URL, {
      version: REPLICATE_VERSION,
      input,
    }));
  }

  if (!response.ok) {
    throw new Error(providerErrorText(data, response.status));
  }

  const id = typeof data?.id === "string" ? data.id : null;
  const status = mapReplicateStatus(data?.status);
  const imageUrl = normalizeOutputUrl(firstOutput(data?.output));

  return { id, status, imageUrl, raw: data, httpStatus: response.status };
}

async function pollReplicate(
  predictionId: string,
  token: string,
  options: Required<Pick<ProviderOptions, "fetchImpl" | "pollIntervalMs" | "maxPolls">>
): Promise<TryOnResponse> {
  for (let attempt = 0; attempt < options.maxPolls; attempt += 1) {
    await sleep(options.pollIntervalMs);

    const response = await options.fetchImpl(
      `${REPLICATE_VERSION_URL}/${encodeURIComponent(predictionId)}`,
      {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    const data = await readJson(response);
    if (!response.ok) {
      throw new Error(providerErrorText(data, response.status));
    }

    const status = mapReplicateStatus(data?.status);
    if (status === "completed") {
      const imageUrl = normalizeOutputUrl(firstOutput(data?.output));
      if (!imageUrl) {
        throw new Error("Replicate succeeded without returning an image");
      }
      return {
        success: true,
        predictionId,
        status: "completed",
        imageUrl,
        provider: "replicate",
      };
    }

    if (status === "failed") {
      throw new Error(providerErrorText(data, response.status));
    }
  }

  return {
    success: false,
    predictionId,
    status: "processing",
    provider: "replicate",
    message: "TRYON_PENDING",
    details: {
      retryAfterSeconds: 3,
      statusEndpoint: `/api/tryon/status/${predictionId}?provider=replicate`,
    },
  };
}

async function runReplicate(
  req: PreparedTryOnRequest,
  token: string,
  options: Required<Pick<ProviderOptions, "fetchImpl" | "pollIntervalMs" | "maxPolls">>
): Promise<TryOnResponse> {
  const { id, status, imageUrl, raw } = await postReplicate(
    req,
    token,
    options.fetchImpl
  );

  if (status === "completed") {
    if (!imageUrl) {
      throw new Error("Replicate succeeded without returning an image");
    }
    return {
      success: true,
      predictionId: id ?? undefined,
      status: "completed",
      imageUrl,
      provider: "replicate",
    };
  }

  if (status === "failed") {
    throw new Error(providerErrorText(raw, 200));
  }

  if (!id) {
    throw new Error("Replicate did not return a prediction id");
  }

  return pollReplicate(id, token, options);
}

// ---------------------------------------------------------------------------
// Hugging Face Space provider (free FASHN VTON v1.5 Gradio demo)
// ---------------------------------------------------------------------------

type HfResolved = {
  fetchImpl: typeof fetch;
  hfSpaceUrl: string;
  hfWaitMs: number;
  hfStatusWaitMs: number;
  hfToken?: string;
};

type HfEventResult =
  | { kind: "completed"; file: unknown }
  | { kind: "pending" }
  | { kind: "failed"; message: string };

function hfBaseUrl(resolved: HfResolved): string {
  return resolved.hfSpaceUrl.replace(/\/+$/, "");
}

function hfAuthorization(resolved: HfResolved): Record<string, string> {
  return resolved.hfToken
    ? { Authorization: `Bearer ${resolved.hfToken}` }
    : {};
}

function isQuotaMessage(message: string): boolean {
  return /quota|exceeded your|gpu limit|rate limit|too many requests/i.test(
    message
  );
}

function hfQuotaError(reason?: string): AppError {
  return new AppError(
    429,
    "TRYON_QUOTA_EXHAUSTED",
    "The free Hugging Face GPU quota for try-on is used up. It resets 24 hours after first use; add FASHN_API_KEY or REPLICATE_API_TOKEN for uninterrupted try-on.",
    { provider: "hf-space", retryAfterHours: 24, reason }
  );
}

function hfSpaceUnavailable(reason?: unknown): AppError {
  return new AppError(
    502,
    "TRYON_SPACE_UNAVAILABLE",
    "The free Hugging Face try-on Space is unavailable right now. Please try again shortly.",
    {
      provider: "hf-space",
      reason:
        reason === undefined ? undefined : sanitizeProviderMessage(reason),
    }
  );
}

function hfInvalidOutput(attempt: string): AppError {
  return new AppError(
    502,
    "TRYON_INVALID_OUTPUT",
    "The Hugging Face Space did not return a usable image.",
    { provider: "hf-space", attempt }
  );
}

function hfSpaceHttpError(
  payload: JsonObject | null,
  status: number
): AppError {
  const detail = providerErrorText(payload, status);
  if (status === 429 || isQuotaMessage(detail)) return hfQuotaError(detail);
  if (status >= 500 || status === 404 || status === 503) {
    return hfSpaceUnavailable(detail);
  }
  return new AppError(
    502,
    "TRYON_PROVIDER_ERROR",
    "The Hugging Face Space rejected the try-on request.",
    { provider: "hf-space", reason: detail }
  );
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  );
}

/** Category values accepted by the Space (verified from /gradio_api/info). */
function hfCategory(
  category: PreparedTryOnRequest["category"]
): "tops" | "bottoms" | "one-pieces" {
  switch (category) {
    case "dress":
    case "one-pieces":
      return "one-pieces";
    case "bottoms":
      return "bottoms";
    default:
      return "tops";
  }
}

/** Catalogue images are flat-lay shots; uploaded photos usually show a model. */
function hfGarmentPhotoType(req: PreparedTryOnRequest): "model" | "flat-lay" {
  return req.garment.kind === "local-path" ? "flat-lay" : "model";
}

/** Builds a multipart body without relying on global FormData/Blob types. */
function buildUploadBody(image: PreparedImage, index: number) {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=]+)$/.exec(image.value);
  if (!match) {
    throw new AppError(
      502,
      "TRYON_SPACE_INVALID_INPUT",
      "The prepared image could not be encoded for the Hugging Face Space."
    );
  }

  const mime = match[1];
  const bytes = Buffer.from(match[2], "base64");
  if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) {
    throw new AppError(
      413,
      "IMAGE_TOO_LARGE",
      `image-${index} must be 5 MB or smaller`,
      { maxBytes: MAX_IMAGE_BYTES }
    );
  }

  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const boundary = `----shopsphere${randomUUID().replace(/-/g, "")}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="files"; filename="image-${index}.${extension}"\r\nContent-Type: ${mime}\r\n\r\n`,
    "utf8"
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");

  return {
    boundary,
    body: new Uint8Array(Buffer.concat([head, bytes, tail])),
  };
}

async function hfUploadImage(
  image: PreparedImage,
  index: number,
  resolved: HfResolved
): Promise<string> {
  // Remote URLs are handed to the Space, which fetches them itself. The backend
  // never downloads user-supplied URLs (SSRF protection).
  if (image.kind === "remote-url") return image.value;

  const { boundary, body } = buildUploadBody(image, index);
  const response = await resolved.fetchImpl(
    `${hfBaseUrl(resolved)}${HF_UPLOAD_PATH}`,
    {
      method: "POST",
      headers: {
        ...hfAuthorization(resolved),
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(HF_REQUEST_TIMEOUT_MS),
    }
  );

  const data = await readJson(response);
  if (!response.ok) throw hfSpaceHttpError(data, response.status);

  const uploaded = Array.isArray(data) ? data[0] : null;
  if (
    typeof uploaded !== "string" ||
    !uploaded.startsWith("/") ||
    uploaded.includes("..")
  ) {
    throw hfSpaceUnavailable("upload did not return a temporary path");
  }

  return uploaded;
}

async function hfSubmit(
  personPath: string,
  garmentPath: string,
  req: PreparedTryOnRequest,
  resolved: HfResolved
): Promise<string> {
  const fileRef = (path: string) => ({
    path,
    meta: { _type: "gradio.FileData" },
  });

  // Parameter order verified from /gradio_api/info on the live Space.
  const data = [
    fileRef(personPath),
    fileRef(garmentPath),
    hfCategory(req.category),
    hfGarmentPhotoType(req),
    HF_TIMESTEPS,
    HF_GUIDANCE_SCALE,
    HF_SEED,
    true,
  ];

  const response = await resolved.fetchImpl(
    `${hfBaseUrl(resolved)}${HF_CALL_PATH}`,
    {
      method: "POST",
      headers: {
        ...hfAuthorization(resolved),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ data }),
      signal: AbortSignal.timeout(HF_REQUEST_TIMEOUT_MS),
    }
  );

  const payload = await readJson(response);
  if (!response.ok) throw hfSpaceHttpError(payload, response.status);

  const eventId =
    payload && typeof payload.event_id === "string" ? payload.event_id : null;
  if (!eventId || !/^[A-Za-z0-9_-]{4,128}$/.test(eventId)) {
    throw hfSpaceUnavailable("the Space did not return an event id");
  }

  return eventId;
}

function parseSseEvents(text: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];

  for (const block of text.split(/\r?\n\r?\n/)) {
    if (block.trim() === "") continue;

    let event = "message";
    const dataLines: string[] = [];
    for (const line of block.split(/\r?\n/)) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
    }

    if (dataLines.length > 0) {
      events.push({ event, data: dataLines.join("\n") });
    }
  }

  return events;
}

function parseSseError(data: string): string {
  try {
    const parsed: unknown = JSON.parse(data);
    if (typeof parsed === "string") return sanitizeProviderMessage(parsed);
    if (parsed && typeof parsed === "object") {
      const record = parsed as JsonObject;
      return providerErrorText(record, 500);
    }
  } catch {
    // Plain text error payload
  }
  return sanitizeProviderMessage(data);
}

async function hfWaitForResult(
  eventId: string,
  resolved: HfResolved,
  timeoutMs: number
): Promise<HfEventResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await resolved.fetchImpl(
      `${hfBaseUrl(resolved)}${HF_CALL_PATH}/${encodeURIComponent(eventId)}`,
      {
        headers: {
          ...hfAuthorization(resolved),
          Accept: "text/event-stream",
        },
        signal: controller.signal,
      }
    );

    if (!response.ok) {
      throw hfSpaceHttpError(await readJson(response), response.status);
    }

    const events = parseSseEvents(await response.text());

    const complete = events.find((event) => event.event === "complete");
    if (complete) {
      let file: unknown;
      try {
        const parsed: unknown = JSON.parse(complete.data);
        file = Array.isArray(parsed) ? parsed[0] : parsed;
      } catch {
        throw hfInvalidOutput("unparseable completion payload");
      }
      return { kind: "completed", file };
    }

    const failure = events.find((event) => event.event === "error");
    if (failure) {
      const message = parseSseError(failure.data);
      if (isQuotaMessage(message)) throw hfQuotaError(message);
      return { kind: "failed", message };
    }

    // No completion yet: the job is still queued or rendering.
    return { kind: "pending" };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isAbortError(error)) return { kind: "pending" };
    throw hfSpaceUnavailable(error);
  } finally {
    clearTimeout(timer);
  }
}

function hfOutputUrl(file: unknown, base: string): string {
  const record =
    file && typeof file === "object" ? (file as JsonObject) : null;
  const rawUrl = record && typeof record.url === "string" ? record.url : null;
  const rawPath =
    record && typeof record.path === "string" ? record.path : null;
  const candidate = rawUrl ?? rawPath;

  if (!candidate) throw hfInvalidOutput("completion contained no image");

  const absolute = candidate.startsWith("/")
    ? new URL(`/gradio_api/file=${candidate}`, base).toString()
    : candidate;
  const normalized = normalizeOutputUrl(absolute);
  if (!normalized) throw hfInvalidOutput("completion image URL is invalid");

  const parsed = new URL(normalized);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw hfInvalidOutput("completion image is not a remote URL");
  }

  return parsed.toString();
}

async function hfVerifyGeneratedImage(
  file: unknown,
  resolved: HfResolved
): Promise<string> {
  const url = hfOutputUrl(file, hfBaseUrl(resolved));

  const response = await resolved.fetchImpl(url, {
    headers: { Accept: "image/*" },
    signal: AbortSignal.timeout(HF_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw hfInvalidOutput(`image download failed with HTTP ${response.status}`);
  }

  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("image/")) {
    throw hfInvalidOutput(`image URL returned ${contentType || "no type"}`);
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_OUTPUT_IMAGE_BYTES) {
    throw hfInvalidOutput("generated image is too large");
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length === 0 || buffer.length > MAX_OUTPUT_IMAGE_BYTES) {
    throw hfInvalidOutput("generated image is empty or too large");
  }
  if (!detectImageMime(buffer)) {
    throw hfInvalidOutput("generated file is not a JPEG, PNG or WebP image");
  }

  return url;
}

async function runHfSpace(
  req: PreparedTryOnRequest,
  token: string,
  resolved: HfResolved
): Promise<TryOnResponse> {
  const scoped: HfResolved = { ...resolved, hfToken: token };

  const [personPath, garmentPath] = await Promise.all([
    hfUploadImage(req.person, 1, scoped),
    hfUploadImage(req.garment, 2, scoped),
  ]);

  const eventId = await hfSubmit(personPath, garmentPath, req, scoped);
  const event = await hfWaitForResult(eventId, scoped, scoped.hfWaitMs);

  if (event.kind === "pending") {
    return {
      success: false,
      predictionId: eventId,
      status: "in_queue",
      provider: "hf-space",
      message: "TRYON_PENDING",
      details: {
        provider: "hf-space",
        retryAfterSeconds: 5,
        statusEndpoint: `/api/tryon/status/${eventId}?provider=hf-space`,
      },
    };
  }

  if (event.kind === "failed") {
    throw new AppError(
      502,
      "TRYON_PROVIDER_ERROR",
      "The Hugging Face Space could not generate an image. Please try again.",
      {
        provider: "hf-space",
        attempts: [`Hugging Face Space: ${sanitizeProviderMessage(event.message)}`],
      }
    );
  }

  const imageUrl = await hfVerifyGeneratedImage(event.file, scoped);

  return {
    success: true,
    predictionId: eventId,
    status: "completed",
    imageUrl,
    provider: "hf-space",
  };
}

function resolveProviderOptions(options: ProviderOptions) {
  return {
    fashnApiKey: options.fashnApiKey ?? env.fashnApiKey,
    replicateApiToken: options.replicateApiToken ?? env.replicateApiToken,
    hfToken: options.hfToken ?? env.hfToken,
    hfSpaceUrl: options.hfSpaceUrl ?? HF_SPACE_URL,
    hfWaitMs: options.hfWaitMs ?? HF_WAIT_TIMEOUT_MS,
    hfStatusWaitMs: options.hfStatusWaitMs ?? HF_STATUS_WAIT_MS,
    fetchImpl: options.fetchImpl ?? fetch,
    pollIntervalMs: options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
    maxPolls: options.maxPolls ?? DEFAULT_MAX_POLLS,
  };
}

/**
 * Runs the AI virtual try-on using real provider APIs only.
 *
 * - FASHN Try-On v1.6 is attempted first when FASHN_API_KEY is set.
 * - Replicate IDM-VTON is used as a fallback when REPLICATE_API_TOKEN is set.
 * - The free FASHN VTON v1.5 Hugging Face Space is the final fallback when
 *   HF_TOKEN is set (it is opt-in so photos are never sent without consent).
 * - With no credentials a MISSING_API_KEY result is returned; this function
 *   never fabricates an image or reports simulated output as success.
 */
export async function runAIVirtualTryOn(
  req: PreparedTryOnRequest,
  options: ProviderOptions = {}
): Promise<TryOnResponse> {
  const resolved = resolveProviderOptions(options);
  const { fashnApiKey, replicateApiToken, hfToken } = resolved;

  if (!fashnApiKey && !replicateApiToken && !hfToken) {
    return {
      success: false,
      status: "failed",
      provider: "none",
      message: "MISSING_API_KEY",
      details: {
        requiredEnvVars: ["FASHN_API_KEY", "REPLICATE_API_TOKEN", "HF_TOKEN"],
        instructions:
          "Add FASHN_API_KEY (https://fashn.ai), REPLICATE_API_TOKEN (https://replicate.com) or a free HF_TOKEN (https://huggingface.co/settings/tokens) to backend/.env and restart the backend.",
      },
    };
  }

  const failures: string[] = [];

  if (fashnApiKey) {
    try {
      return await runFashn(req, fashnApiKey, resolved);
    } catch (error) {
      const message = sanitizeProviderMessage(error);
      failures.push(`FASHN: ${message}`);
      console.warn(`[tryon] FASHN attempt failed: ${message}`);
    }
  }

  if (replicateApiToken) {
    try {
      return await runReplicate(req, replicateApiToken, resolved);
    } catch (error) {
      const message = sanitizeProviderMessage(error);
      failures.push(`Replicate: ${message}`);
      console.warn(`[tryon] Replicate attempt failed: ${message}`);
    }
  }

  if (hfToken) {
    try {
      return await runHfSpace(req, hfToken, resolved);
    } catch (error) {
      // Quota exhaustion and Space downtime are actionable on their own, so
      // they surface instead of being reported as a generic provider failure.
      if (
        error instanceof AppError &&
        (error.code === "TRYON_QUOTA_EXHAUSTED" ||
          error.code === "TRYON_SPACE_UNAVAILABLE" ||
          error.code === "TRYON_INVALID_OUTPUT")
      ) {
        throw error;
      }

      const message = sanitizeProviderMessage(error);
      failures.push(`Hugging Face Space: ${message}`);
      console.warn(`[tryon] Hugging Face Space attempt failed: ${message}`);
    }
  }

  throw new AppError(
    502,
    "TRYON_PROVIDER_ERROR",
    "The virtual try-on provider could not generate an image. Please try again.",
    { attempts: failures }
  );
}

/**
 * Checks the status of an ongoing prediction.
 *
 * The provider must match the one that created the prediction; `auto` prefers
 * FASHN when it is configured, otherwise Replicate.
 */
export async function checkPredictionStatus(
  predictionId: string,
  provider: "fashn" | "replicate" | "hf-space" | "auto" = "auto",
  options: ProviderOptions = {}
): Promise<TryOnResponse> {
  if (!/^[A-Za-z0-9_-]{6,128}$/.test(predictionId)) {
    throw new AppError(
      400,
      "INVALID_PREDICTION_ID",
      "predictionId has an invalid format"
    );
  }

  const resolved = resolveProviderOptions(options);
  const selected =
    provider === "auto"
      ? resolved.fashnApiKey
        ? "fashn"
        : resolved.replicateApiToken
          ? "replicate"
          : resolved.hfToken
            ? "hf-space"
            : "none"
      : provider;

  if (selected === "fashn") {
    if (!resolved.fashnApiKey) {
      throw new AppError(
        422,
        "MISSING_TRYON_API_KEY",
        "FASHN_API_KEY is not configured in backend/.env",
        { requiredEnvVars: ["FASHN_API_KEY"] }
      );
    }

    const response = await resolved.fetchImpl(
      `${FASHN_STATUS_URL}/${encodeURIComponent(predictionId)}`,
      {
        headers: { Authorization: `Bearer ${resolved.fashnApiKey}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    const data = await readJson(response);
    if (!response.ok) {
      throw new AppError(
        502,
        "TRYON_PROVIDER_ERROR",
        providerErrorText(data, response.status)
      );
    }

    const status = mapFashnStatus(data?.status);
    return {
      success: status === "completed",
      predictionId,
      status,
      imageUrl: normalizeOutputUrl(firstOutput(data?.output)) ?? undefined,
      provider: "fashn",
    };
  }

  if (selected === "replicate") {
    if (!resolved.replicateApiToken) {
      throw new AppError(
        422,
        "MISSING_TRYON_API_KEY",
        "REPLICATE_API_TOKEN is not configured in backend/.env",
        { requiredEnvVars: ["REPLICATE_API_TOKEN"] }
      );
    }

    const response = await resolved.fetchImpl(
      `${REPLICATE_VERSION_URL}/${encodeURIComponent(predictionId)}`,
      {
        headers: { Authorization: `Bearer ${resolved.replicateApiToken}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );
    const data = await readJson(response);
    if (!response.ok) {
      throw new AppError(
        502,
        "TRYON_PROVIDER_ERROR",
        providerErrorText(data, response.status)
      );
    }

    const status = mapReplicateStatus(data?.status);
    return {
      success: status === "completed",
      predictionId,
      status,
      imageUrl: normalizeOutputUrl(firstOutput(data?.output)) ?? undefined,
      provider: "replicate",
    };
  }

  if (selected === "hf-space") {
    if (!resolved.hfToken) {
      throw new AppError(
        422,
        "MISSING_TRYON_API_KEY",
        "HF_TOKEN is not configured in backend/.env",
        { requiredEnvVars: ["HF_TOKEN"] }
      );
    }

    const scoped: HfResolved = { ...resolved, hfToken: resolved.hfToken };
    const event = await hfWaitForResult(
      predictionId,
      scoped,
      scoped.hfStatusWaitMs
    );

    if (event.kind === "pending") {
      return {
        success: false,
        predictionId,
        status: "processing",
        provider: "hf-space",
        message: "TRYON_PENDING",
        details: {
          provider: "hf-space",
          retryAfterSeconds: 5,
          statusEndpoint: `/api/tryon/status/${predictionId}?provider=hf-space`,
        },
      };
    }

    if (event.kind === "failed") {
      throw new AppError(
        502,
        "TRYON_PROVIDER_ERROR",
        "The Hugging Face Space could not generate an image. Please try again.",
        {
          provider: "hf-space",
          attempts: [
            `Hugging Face Space: ${sanitizeProviderMessage(event.message)}`,
          ],
        }
      );
    }

    return {
      success: true,
      predictionId,
      status: "completed",
      imageUrl: await hfVerifyGeneratedImage(event.file, scoped),
      provider: "hf-space",
    };
  }

  throw new AppError(
    422,
    "MISSING_TRYON_API_KEY",
    "No virtual try-on provider is configured in backend/.env",
    { requiredEnvVars: ["FASHN_API_KEY", "REPLICATE_API_TOKEN", "HF_TOKEN"] }
  );
}
