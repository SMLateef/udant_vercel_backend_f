import { ApiError } from './errorHandler.js';

/** Validate req.body against a zod schema, replacing req.body with the parsed result. */
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(new ApiError(400, 'Validation failed', result.error.flatten()));
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(new ApiError(400, 'Invalid query parameters', result.error.flatten()));
    }
    req.query = result.data;
    next();
  };
}
