import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { AppError, toFieldIssues } from "../../lib/errors";

/**
 * Input hardening for the virtual try-on endpoint.
 *
 * The endpoint accepts base64 data URIs (camera/upload), remote image URLs and
 * local catalogue paths. Every accepted image is checked for:
 *   - an allowed MIME type (JPEG, PNG, WebP),
 *   - a valid base64 payload whose magic bytes match the declared type,
 *   - a decoded size of at most 5 MB,
 *   - a path that cannot escape `public/`.
 *
 * Nothing here logs or returns image contents, so secrets and user photos are
 * never written to the server log.
 */

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AllowedImageMime = (typeof ALLOWED_IMAGE_MIME_TYPES)[number];

/** Generous enough for a 5 MB binary image plus base64 padding. */
export const MAX_BASE64_LENGTH = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 8;

const MIME_ALIASES: Record<string, AllowedImageMime> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

const EXTENSION_MIME: Record<string, AllowedImageMime> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const DATA_URI_PATTERN =
  /^data:([a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/;

export type ImageInputKind = "data-uri" | "remote-url" | "local-path";

export type PreparedImage = {
  /** Value forwarded to the AI provider (local files become data URIs). */
  value: string;
  kind: ImageInputKind;
  mime: AllowedImageMime;
  bytes: number;
};

export type TryOnCategoryInput =
  | "shirt"
  | "dress"
  | "tops"
  | "one-pieces"
  | "bottoms"
  | "auto";

export type PreparedTryOnRequest = {
  personImage: string;
  garmentImage: string;
  person: PreparedImage;
  garment: PreparedImage;
  category: TryOnCategoryInput;
  productId?: number;
  productTitle?: string;
};

export type TryOnImageField = "personImage" | "garmentImage";

function invalid(
  status: number,
  code: string,
  message: string,
  details?: unknown
): AppError {
  return new AppError(status, code, message, details);
}

function normalizeMime(rawMime: string): AllowedImageMime | null {
  const mime = rawMime.trim().toLowerCase();
  if ((ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mime)) {
    return mime as AllowedImageMime;
  }
  return MIME_ALIASES[mime] ?? null;
}

/** Sniffs the real image type from the first bytes of the decoded payload. */
export function detectImageMime(buffer: Buffer): AllowedImageMime | null {
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "image/jpeg";
  }

  const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(pngMagic)) {
    return "image/png";
  }

  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  return null;
}

function assertDecodedImage(
  buffer: Buffer,
  declaredMime: AllowedImageMime,
  field: TryOnImageField
): PreparedImage {
  if (buffer.length === 0) {
    throw invalid(
      400,
      "INVALID_IMAGE_DATA",
      `${field} contains no image data`
    );
  }

  if (buffer.length > MAX_IMAGE_BYTES) {
    throw invalid(
      413,
      "IMAGE_TOO_LARGE",
      `${field} must be 5 MB or smaller`,
      { maxBytes: MAX_IMAGE_BYTES, receivedBytes: buffer.length, field }
    );
  }

  const detected = detectImageMime(buffer);
  if (!detected) {
    throw invalid(
      400,
      "INVALID_IMAGE_CONTENT",
      `${field} is not a valid JPEG, PNG or WebP image`,
      { field }
    );
  }

  if (detected !== declaredMime) {
    throw invalid(
      400,
      "IMAGE_TYPE_MISMATCH",
      `${field} declares ${declaredMime} but its content is ${detected}`,
      { field, declaredMime, detectedMime: detected }
    );
  }

  return {
    value: `data:${declaredMime};base64,${buffer.toString("base64")}`,
    kind: "data-uri",
    mime: declaredMime,
    bytes: buffer.length,
  };
}

function parseDataUri(value: string, field: TryOnImageField): PreparedImage {
  const match = DATA_URI_PATTERN.exec(value);
  if (!match) {
    throw invalid(
      400,
      "INVALID_IMAGE_DATA_URI",
      `${field} must be a base64 data URI such as data:image/jpeg;base64,...`,
      { field }
    );
  }

  const declaredMime = normalizeMime(match[1]);
  if (!declaredMime) {
    throw invalid(
      400,
      "INVALID_IMAGE_TYPE",
      `${field} must be a JPEG, PNG or WebP image`,
      { field, allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES }
    );
  }

  const base64 = match[2].replace(/\s+/g, "");
  if (base64.length === 0 || base64.length > MAX_BASE64_LENGTH) {
    throw invalid(
      413,
      "IMAGE_TOO_LARGE",
      `${field} must be 5 MB or smaller`,
      { field, maxBytes: MAX_IMAGE_BYTES }
    );
  }

  const unpadded = base64.replace(/=+$/, "");
  if (!/^[A-Za-z0-9+/]+$/.test(unpadded)) {
    throw invalid(
      400,
      "INVALID_IMAGE_BASE64",
      `${field} contains invalid base64 characters`,
      { field }
    );
  }

  const padding = (4 - (unpadded.length % 4)) % 4;
  if (padding === 3) {
    throw invalid(
      400,
      "INVALID_IMAGE_BASE64",
      `${field} contains an invalid base64 length`,
      { field }
    );
  }

  const normalized = unpadded + "=".repeat(padding);
  const buffer = Buffer.from(normalized, "base64");

  return assertDecodedImage(buffer, declaredMime, field);
}

function validateRemoteUrl(value: string, field: TryOnImageField): PreparedImage {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalid(400, "INVALID_IMAGE_URL", `${field} is not a valid URL`, {
      field,
    });
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw invalid(
      400,
      "INVALID_IMAGE_URL",
      `${field} URL must use http or https`,
      { field }
    );
  }

  if (url.username || url.password) {
    throw invalid(
      400,
      "INVALID_IMAGE_URL",
      `${field} URL must not contain embedded credentials`,
      { field }
    );
  }

  const extension = path.extname(url.pathname).toLowerCase();
  const mime = EXTENSION_MIME[extension];
  if (!mime) {
    throw invalid(
      400,
      "INVALID_IMAGE_TYPE",
      `${field} URL must point to a .jpg, .jpeg, .png or .webp image`,
      { field, allowedExtensions: Object.keys(EXTENSION_MIME) }
    );
  }

  // Remote URLs are handed to the provider, which fetches them. Their size is
  // enforced by the provider's own limits; we cannot safely fetch arbitrary
  // URLs server-side (SSRF), so no byte count is reported here.
  return { value: url.toString(), kind: "remote-url", mime, bytes: 0 };
}

function resolvePublicDir(): string | null {
  const candidates = [
    path.resolve(process.cwd(), "public"),
    path.resolve(process.cwd(), "..", "public"),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

function validateLocalPath(value: string, field: TryOnImageField): PreparedImage {
  const publicDir = resolvePublicDir();
  if (!publicDir) {
    throw invalid(
      400,
      "INVALID_IMAGE_PATH",
      `${field} local image path could not be resolved`
    );
  }

  const relativePath = value.replace(/^\/+/, "");
  if (relativePath.length === 0 || /(^|[\\/])\.\.([\\/]|$)/.test(relativePath)) {
    throw invalid(
      400,
      "INVALID_IMAGE_PATH",
      `${field} must be a path inside the public directory`,
      { field }
    );
  }

  const resolvedPath = path.resolve(publicDir, relativePath);
  const relativeToPublic = path.relative(publicDir, resolvedPath);
  if (
    relativeToPublic.startsWith("..") ||
    path.isAbsolute(relativeToPublic)
  ) {
    throw invalid(
      400,
      "INVALID_IMAGE_PATH",
      `${field} must be a path inside the public directory`,
      { field }
    );
  }

  let stats: fs.Stats;
  try {
    stats = fs.lstatSync(resolvedPath);
  } catch {
    throw invalid(400, "IMAGE_NOT_FOUND", `${field} image was not found`, {
      field,
    });
  }

  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw invalid(
      400,
      "INVALID_IMAGE_PATH",
      `${field} must point to a regular image file`,
      { field }
    );
  }

  if (stats.size === 0 || stats.size > MAX_IMAGE_BYTES) {
    throw invalid(413, "IMAGE_TOO_LARGE", `${field} must be 5 MB or smaller`, {
      field,
      maxBytes: MAX_IMAGE_BYTES,
      receivedBytes: stats.size,
    });
  }

  const extension = path.extname(resolvedPath).toLowerCase();
  const declaredMime = EXTENSION_MIME[extension];
  if (!declaredMime) {
    throw invalid(
      400,
      "INVALID_IMAGE_TYPE",
      `${field} must be a JPEG, PNG or WebP image`,
      { field, allowedMimeTypes: ALLOWED_IMAGE_MIME_TYPES }
    );
  }

  const buffer = fs.readFileSync(resolvedPath);
  const prepared = assertDecodedImage(buffer, declaredMime, field);
  return {
    ...prepared,
    kind: "local-path",
  };
}

/**
 * Validates one image input. `allowLocalPath` is only true for catalogue
 * garments: a person photo must come from the camera/upload (data URI) or an
 * explicit remote image URL, never from the server's filesystem.
 */
export function validateTryOnImage(
  rawValue: string,
  field: TryOnImageField,
  options: { allowLocalPath: boolean }
): PreparedImage {
  const value = rawValue.trim();

  if (value.startsWith("data:")) {
    return parseDataUri(value, field);
  }

  if (/^https?:\/\//i.test(value)) {
    return validateRemoteUrl(value, field);
  }

  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    throw invalid(
      400,
      "INVALID_IMAGE_URL",
      `${field} must use http or https`,
      { field }
    );
  }

  if (!options.allowLocalPath) {
    throw invalid(
      400,
      "INVALID_IMAGE_SOURCE",
      `${field} must be an uploaded image (base64 data URI) or an http(s) image URL`,
      { field }
    );
  }

  return validateLocalPath(value, field);
}

const tryOnRequestSchema = z
  .object({
    personImage: z.string().min(1, "personImage is required"),
    garmentImage: z.string().min(1, "garmentImage is required"),
    category: z
      .enum(["shirt", "dress", "tops", "one-pieces", "bottoms", "auto"])
      .optional(),
    productId: z
      .union([z.number(), z.string().regex(/^\d+$/, "productId must be numeric")])
      .optional(),
    productTitle: z.string().trim().max(200).optional(),
  })
  .strict();

/**
 * Validates and normalizes the JSON body of POST /api/tryon.
 * Throws AppError with a stable code on any invalid input.
 */
export function parseTryOnRequest(body: unknown): PreparedTryOnRequest {
  const parsed = tryOnRequestSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Request validation failed",
      { issues: toFieldIssues(parsed.error) }
    );
  }

  const data = parsed.data;
  const person = validateTryOnImage(data.personImage, "personImage", {
    allowLocalPath: false,
  });
  const garment = validateTryOnImage(data.garmentImage, "garmentImage", {
    allowLocalPath: true,
  });

  return {
    personImage: person.value,
    garmentImage: garment.value,
    person,
    garment,
    category: data.category ?? "tops",
    productId:
      data.productId === undefined ? undefined : Number(data.productId),
    productTitle: data.productTitle,
  };
}
