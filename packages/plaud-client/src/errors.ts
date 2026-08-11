/**
 * Error classes for the Plaud API client.
 */

export class PlaudError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaudError";
  }
}

export class AuthError extends PlaudError {
  constructor(message: string = "Not authenticated. Please log in.") {
    super(message);
    this.name = "AuthError";
  }
}

export class NotFoundError extends PlaudError {
  constructor(message: string = "Resource not found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends PlaudError {
  public retryAfterMs?: number;

  constructor(message: string = "Rate limit exceeded.", retryAfterMs?: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export class NetworkError extends PlaudError {
  public cause?: unknown;

  constructor(message: string = "Network error occurred.", cause?: unknown) {
    super(message);
    this.name = "NetworkError";
    this.cause = cause;
  }
}

export class TimeoutError extends PlaudError {
  constructor(message: string = "Request timed out.") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ApiError extends PlaudError {
  public statusCode: number;
  public details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(`API error ${statusCode}: ${message}`);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.details = details;
  }
}
