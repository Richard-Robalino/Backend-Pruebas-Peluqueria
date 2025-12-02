import { NextFunction, Request, Response } from 'express';
import Joi from 'joi';
import { ApiError } from './errorHandler.js';
import { StatusCodes } from 'http-status-codes';

export function validateBody(schema: Joi.ObjectSchema<any>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Datos inválidos', error.details));
    }
    req.body = value;
    next();
  };
}

export function validateQuery(schema: Joi.ObjectSchema<any>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, { abortEarly: false, stripUnknown: true });
    if (error) {
      return next(new ApiError(StatusCodes.BAD_REQUEST, 'Parámetros inválidos', error.details));
    }
    req.query = value;
    next();
  };
}
