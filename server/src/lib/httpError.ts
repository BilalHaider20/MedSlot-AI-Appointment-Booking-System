export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details: unknown[] = [],
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, details: unknown[] = []) =>
  new HttpError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Please sign in to continue.') =>
  new HttpError(401, 'UNAUTHORIZED', message);
export const notFound = (message = 'Not found.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);
