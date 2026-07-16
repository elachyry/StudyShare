import { ErrorCode } from '@studyshare/shared';

/**
 * Typed application error. Every thrown AppError maps deterministically to an
 * HTTP status + machine-readable code. Handlers throw these; the global error
 * handler serializes them. Never expose stack traces or DB errors to clients.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  /** When true, the message is safe to return to the client. */
  readonly expose: boolean;

  constructor(params: {
    statusCode: number;
    code: ErrorCode;
    message?: string;
    details?: unknown;
    expose?: boolean;
  }) {
    super(params.message ?? params.code);
    this.name = 'AppError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.expose = params.expose ?? true;
  }
}

export const Errors = {
  validation: (details?: unknown) =>
    new AppError({ statusCode: 400, code: ErrorCode.VALIDATION_ERROR, details }),
  unauthenticated: () =>
    new AppError({ statusCode: 401, code: ErrorCode.AUTH_UNAUTHENTICATED }),
  forbidden: (code: ErrorCode = ErrorCode.AUTH_FORBIDDEN) =>
    new AppError({ statusCode: 403, code }),
  notFound: () => new AppError({ statusCode: 404, code: ErrorCode.NOT_FOUND }),
  conflict: (code: ErrorCode = ErrorCode.CONFLICT) =>
    new AppError({ statusCode: 409, code }),
  invalidCredentials: () =>
    new AppError({ statusCode: 401, code: ErrorCode.AUTH_INVALID_CREDENTIALS }),
  internal: () =>
    new AppError({ statusCode: 500, code: ErrorCode.INTERNAL_ERROR, expose: false }),
} as const;
