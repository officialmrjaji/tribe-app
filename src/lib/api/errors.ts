import { NextResponse } from "next/server";
import { getRequestIdFromHeaders, logError, logger } from "@/lib/observability/logger";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "FORBIDDEN"
  | "INTERNAL_SERVER_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UNAUTHORIZED"
  | "VALIDATION_ERROR";

export class ApiError extends Error {
  code: ApiErrorCode;
  details?: unknown;
  status: number;

  constructor({
    code,
    details,
    message,
    status,
  }: {
    code: ApiErrorCode;
    details?: unknown;
    message: string;
    status: number;
  }) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

export function unauthorized(message = "Authentication is required.") {
  return new ApiError({ code: "UNAUTHORIZED", message, status: 401 });
}

export function forbidden(message = "You do not have access to this resource.") {
  return new ApiError({ code: "FORBIDDEN", message, status: 403 });
}

export function notFound(message = "Resource not found.") {
  return new ApiError({ code: "NOT_FOUND", message, status: 404 });
}

export function badRequest(message: string, details?: unknown) {
  return new ApiError({
    code: "BAD_REQUEST",
    details,
    message,
    status: 400,
  });
}

export function rateLimited(message = "Please slow down and try again.") {
  return new ApiError({ code: "RATE_LIMITED", message, status: 429 });
}

export function getErrorStatus(error: unknown) {
  if (error instanceof ApiError) {
    return error.status;
  }

  if (error && typeof error === "object") {
    const status = (error as { status?: unknown }).status;

    if (typeof status === "number") {
      return status;
    }
  }

  return 500;
}

export function apiErrorResponse(
  error: unknown,
  {
    fallbackMessage = "Something went wrong.",
    request,
    requestId,
  }: {
    fallbackMessage?: string;
    request?: Request;
    requestId?: string;
  } = {},
) {
  const resolvedRequestId =
    requestId ?? (request ? getRequestIdFromHeaders(request.headers) : undefined);
  const status = getErrorStatus(error);
  const isExpected = error instanceof ApiError || status < 500;
  const message =
    error instanceof Error && isExpected ? error.message : fallbackMessage;
  const code =
    error instanceof ApiError
      ? error.code
      : status === 401
        ? "UNAUTHORIZED"
        : status === 403
          ? "FORBIDDEN"
          : status === 404
            ? "NOT_FOUND"
            : status === 429
              ? "RATE_LIMITED"
              : "INTERNAL_SERVER_ERROR";

  if (status >= 500) {
    logError("API request failed", error, {
      requestId: resolvedRequestId,
      status,
      url: request?.url,
    });
  } else {
    logger("warn", "API request returned expected error", {
      code,
      requestId: resolvedRequestId,
      status,
      url: request?.url,
    });
  }

  return NextResponse.json(
    {
      error: {
        code,
        message,
        requestId: resolvedRequestId,
        ...(error instanceof ApiError && error.details
          ? { details: error.details }
          : {}),
      },
    },
    {
      headers: resolvedRequestId ? { "x-request-id": resolvedRequestId } : {},
      status,
    },
  );
}

export async function withApiErrorHandling<T>(
  request: Request,
  handler: (requestId: string) => Promise<T>,
  fallbackMessage?: string,
) {
  const requestId = getRequestIdFromHeaders(request.headers);
  const startedAt = Date.now();

  try {
    const result = await handler(requestId);

    logger("info", "API request completed", {
      durationMs: Date.now() - startedAt,
      requestId,
      url: request.url,
    });

    return result;
  } catch (error) {
    return apiErrorResponse(error, {
      fallbackMessage,
      request,
      requestId,
    });
  }
}
