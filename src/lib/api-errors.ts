import "server-only";

import { NextResponse } from "next/server";
import { z } from "zod";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "CONFLICT"
  | "INVALID_STATE"
  | "INTERNAL_ERROR";

export type FieldIssue = {
  field: string;
  message: string;
};

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function jsonError(
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: unknown
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(details === undefined ? {} : { details })
      }
    },
    { status }
  );
}

export function validationErrorFromZod(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message
  }));

  return jsonError(400, "VALIDATION_ERROR", issues[0]?.message ?? "Validation failed", {
    field: issues[0]?.field ?? "body",
    issues
  });
}

export function internalError() {
  return jsonError(500, "INTERNAL_ERROR", "Internal server error");
}

export function routeErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return jsonError(error.status, error.code, error.message, error.details);
  }

  return internalError();
}
