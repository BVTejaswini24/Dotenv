import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import {
  AppError,
  BadRequestError,
  isAppError,
  toFieldIssues,
} from "../lib/errors";

type PgError = Error & { code?: string; constraint?: string };

/** Postgres errors we can translate into safe client responses. */
function fromPgError(error: PgError): AppError | null {
  switch (error.code) {
    case "22P02": // invalid_text_representation, e.g. malformed UUID
      return new BadRequestError("A path or query parameter has an invalid format");
    case "23505": // unique_violation
      return new AppError(409, "DUPLICATE_RESOURCE", "That resource already exists");
    case "23503": // foreign_key_violation
      return new BadRequestError("Referenced resource does not exist");
    case "23514": // check_violation
      return new BadRequestError("The request violates a data constraint");
    default:
      return null;
  }
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "Endpoint not found" },
  });
}

/**
 * Central error middleware. Every response has the same shape:
 *   { error: { code, message, details? } }
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: { issues: toFieldIssues(error) },
      },
    });
    return;
  }

  if (isAppError(error)) {
    res.status(error.status).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    });
    return;
  }

  const pgError = error instanceof Error ? fromPgError(error as PgError) : null;
  if (pgError) {
    res.status(pgError.status).json({
      error: { code: pgError.code, message: pgError.message },
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: { code: "INVALID_JSON", message: "Request body is not valid JSON" },
    });
    return;
  }

  console.error("[error] Unhandled request error:", error);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal Server Error" },
  });
}
