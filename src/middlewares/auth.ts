import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from './errorHandler.js';
import { StatusCodes } from 'http-status-codes';
import { SessionModel } from '../models/Session.js';

export interface JwtPayload {
  sub: string;
  sid: string;
  role: string;
  iat: number;
  exp: number;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Token no provisto');
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;

    // Validate session exists and inactivity
    const session = await SessionModel.findById(decoded.sid);
    if (!session || session.revoked) {
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Sesión inválida');
    }
    const now = new Date();
    const diffMin = (now.getTime() - session.lastActivityAt.getTime()) / 60000;
    if (diffMin > env.SESSION_INACTIVITY_MIN) {
      session.revoked = true;
      await session.save();
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Sesión expirada por inactividad');
    }
    // Update last activity (sliding)
    session.lastActivityAt = now;
    await session.save();

    req.user = { id: decoded.sub, role: decoded.role, sessionId: decoded.sid };
    next();
  } catch (err) {
    next(err);
  }
}
