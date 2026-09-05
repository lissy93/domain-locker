export type ApiErrorCode =
  | 'bad_request'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'read_only'
  | 'internal';

export const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  bad_request: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  read_only: 405,
  internal: 500,
};

/** A failure safe to show a caller: a stable code, a plain message, optional details */
export class ApiError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiError = (code: ApiErrorCode, message: string, details?: unknown) =>
  new ApiError(code, message, details);

export const notFound = (what: string) => new ApiError('not_found', `${what} not found`);
export const badRequest = (message: string, details?: unknown) =>
  new ApiError('bad_request', message, details);
