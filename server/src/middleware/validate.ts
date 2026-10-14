import type { RequestHandler, Response } from 'express';
import type { z } from 'zod';

type RequestSchemas = {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
};

type Validated<S extends RequestSchemas> = {
  [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

/**
 * Parses the given request parts and stores the results on res.locals.validated.
 * A ZodError is passed on to the error handler, which turns it into a 400.
 */
export function validate<S extends RequestSchemas>(schemas: S): RequestHandler {
  return (req, res, next) => {
    res.locals.validated = {
      body: schemas.body?.parse(req.body),
      query: schemas.query?.parse(req.query),
      params: schemas.params?.parse(req.params),
    };
    next();
  };
}

/** Typed read of what validate() stored. Pass the same schemas object used in the route. */
export function validated<S extends RequestSchemas>(res: Response, _schemas: S): Validated<S> {
  return res.locals.validated as Validated<S>;
}
