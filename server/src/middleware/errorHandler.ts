import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { HttpError, type ErrorCode } from '../lib/httpError.js';
import { logger } from '../lib/logger.js';

type ErrorBody = { error: { code: ErrorCode; message: string; details: unknown[] } };

const uniqueViolationMessages: Record<string, string> = {
  users_business_email_key: 'An account with that email already exists.',
};

function hasPgCode(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';
}

function isBodyParserError(error: unknown): error is { type: string; status: number } {
  return typeof error === 'object' && error !== null && 'type' in error && 'status' in error;
}

function toResponse(error: unknown): { status: number; body: ErrorBody } {
  const body = (code: ErrorCode, message: string, details: unknown[] = []): ErrorBody => ({
    error: { code, message, details },
  });

  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
    return { status: 400, body: body('VALIDATION_ERROR', 'Some fields are missing or invalid.', details) };
  }
  if (error instanceof HttpError) {
    return { status: error.status, body: body(error.code, error.message, error.details) };
  }
  if (isBodyParserError(error)) {
    const message =
      error.type === 'entity.parse.failed' ? 'The request body is not valid JSON.' : 'The request body could not be read.';
    return { status: 400, body: body('VALIDATION_ERROR', message) };
  }
  if (hasPgCode(error) && error.code === '23P01') {
    return { status: 409, body: body('CONFLICT', 'That time was just taken.') };
  }
  if (hasPgCode(error) && error.code === '23505') {
    const message = uniqueViolationMessages[error.constraint ?? ''] ?? 'That already exists.';
    return { status: 409, body: body('CONFLICT', message) };
  }
  return { status: 500, body: body('INTERNAL', 'Something went wrong on our side. Please try again.') };
}

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}.`, details: [] } });
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const { status, body } = toResponse(error);
  if (status >= 500) {
    (req.log ?? logger).error({ err: error }, 'unhandled error');
  }
  res.status(status).json(body);
};
