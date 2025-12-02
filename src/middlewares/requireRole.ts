import { NextFunction, Request, Response } from 'express';
import { ROLES } from '../constants/roles.js';
import { ApiError } from './errorHandler.js';
import { StatusCodes } from 'http-status-codes';

export function requireRoles(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return next(new ApiError(StatusCodes.UNAUTHORIZED, 'No autenticado'));
    if (!roles.includes(user.role)) {
      return next(new ApiError(StatusCodes.FORBIDDEN, 'No autorizado'));
    }
    next();
  };
}
