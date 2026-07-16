/**
 * Machine-readable error codes shared between backend and frontend.
 *
 * The backend returns these codes (never localized prose) so the frontend can
 * map them to localized messages via i18n. Never leak stack traces or DB errors.
 */
export const ErrorCode = {
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMITED: 'RATE_LIMITED',
  CONFLICT: 'CONFLICT',

  // Auth
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_UNAUTHENTICATED: 'AUTH_UNAUTHENTICATED',
  AUTH_FORBIDDEN: 'AUTH_FORBIDDEN',
  AUTH_EMAIL_NOT_VERIFIED: 'AUTH_EMAIL_NOT_VERIFIED',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_REFRESH_REUSE_DETECTED: 'AUTH_REFRESH_REUSE_DETECTED',
  AUTH_CSRF_INVALID: 'AUTH_CSRF_INVALID',
  AUTH_ACCOUNT_SUSPENDED: 'AUTH_ACCOUNT_SUSPENDED',
  AUTH_PASSWORD_TOO_WEAK: 'AUTH_PASSWORD_TOO_WEAK',
  AUTH_EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  AUTH_OAUTH_FAILED: 'AUTH_OAUTH_FAILED',

  // Files / uploads
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  FILE_TYPE_NOT_ALLOWED: 'FILE_TYPE_NOT_ALLOWED',
  FILE_CONTENT_MISMATCH: 'FILE_CONTENT_MISMATCH',
  FILE_QUOTA_EXCEEDED: 'FILE_QUOTA_EXCEEDED',
  FILE_MISSING: 'FILE_MISSING',

  // Domain
  RESOURCE_NOT_APPROVED: 'RESOURCE_NOT_APPROVED',
  ALREADY_VOTED: 'ALREADY_VOTED',
  ALREADY_RATED: 'ALREADY_RATED',
  REQUEST_ALREADY_FULFILLED: 'REQUEST_ALREADY_FULFILLED',
  OWNERSHIP_REQUIRED: 'OWNERSHIP_REQUIRED',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Shape of every error response body returned by the API. */
export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    /** Optional non-sensitive detail (e.g. field validation issues). */
    message?: string;
    details?: unknown;
    /** Correlation id for tracing this failure in logs. */
    requestId?: string;
  };
}
