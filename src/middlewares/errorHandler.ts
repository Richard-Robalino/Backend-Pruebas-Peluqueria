import { NextFunction, Request, Response } from 'express';
import { StatusCodes, getReasonPhrase } from 'http-status-codes';

export class ApiError extends Error {
  statusCode: number;
  details?: unknown;
  constructor(statusCode: number, message?: string, details?: unknown) {
    super(message ?? getReasonPhrase(statusCode));
    this.statusCode = statusCode;
    this.details = details;
  }
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(StatusCodes.NOT_FOUND, 'Recurso no encontrado'));
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  const status = err.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR;
  const payload: any = {
    name: err.name,
    message: err.message ?? 'Error interno',
  };
  if (err.details) payload.details = err.details;
  if (process.env.NODE_ENV !== 'production' && err.stack) payload.stack = err.stack;
  res.status(status).json(payload);
}
