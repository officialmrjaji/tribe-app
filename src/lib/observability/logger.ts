export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

const redactedKeys = [
  "authorization",
  "cookie",
  "password",
  "secret",
  "token",
  "key",
  "signature",
];

export function createRequestId() {
  return `req_${crypto.randomUUID().replaceAll("-", "").slice(0, 18)}`;
}

export function getRequestIdFromHeaders(headers: Headers) {
  return (
    headers.get("x-request-id") ??
    headers.get("x-vercel-id") ??
    createRequestId()
  );
}

export function logger(level: LogLevel, message: string, context: LogContext = {}) {
  const entry = {
    context: sanitizeContext(context),
    level,
    message,
    timestamp: new Date().toISOString(),
  };
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  if (level === "debug") {
    console.debug(serialized);
    return;
  }

  console.info(serialized);
}

export function logError(message: string, error: unknown, context: LogContext = {}) {
  logger("error", message, {
    ...context,
    error: serializeError(error),
  });
}

export function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return {
    message: String(error),
  };
}

function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      shouldRedact(key) ? "[redacted]" : sanitizeValue(value),
    ]),
  );
}

function sanitizeValue(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  return sanitizeContext(value as LogContext);
}

function shouldRedact(key: string) {
  const normalized = key.toLowerCase();

  return redactedKeys.some((redactedKey) => normalized.includes(redactedKey));
}
