import type { NextFunction, Request, RequestHandler, Response } from "express";
import type { z } from "zod";
import { BadRequestError, toFieldIssues } from "./errors";

/** Wraps an async route so rejected promises reach the error middleware. */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/** Parses and validates input, throwing a 400 with per-field details on failure. */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
  code = "VALIDATION_ERROR"
): z.output<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new BadRequestError("Request validation failed", code, {
      issues: toFieldIssues(result.error),
    });
  }
  return result.data;
}

export type Pagination = {
  page: number;
  limit: number;
  offset: number;
};

export function resolvePagination(
  page: number,
  limit: number,
  maxLimit = 100
): Pagination {
  const safeLimit = Math.min(Math.max(limit, 1), maxLimit);
  const safePage = Math.max(page, 1);
  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
}

export function paginationMeta(total: number, pagination: Pagination) {
  const totalPages = total === 0 ? 0 : Math.ceil(total / pagination.limit);
  return {
    page: pagination.page,
    limit: pagination.limit,
    total,
    totalPages,
    hasNextPage: pagination.page < totalPages,
    hasPrevPage: pagination.page > 1,
  };
}
