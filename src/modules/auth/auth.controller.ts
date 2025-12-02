import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserModel } from '../../models/User.js';
import { comparePassword, hashPassword } from '../../utils/password.js';
import { SessionModel } from '../../models/Session.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/tokens.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { ROLES } from '../../constants/roles.js';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env.js';
import crypto from 'crypto';
import { PasswordResetTokenModel } from '../../models/PasswordResetToken.js';
import { sendEmail } from '../../utils/email.js';
import { createAndSendVerification, verifyByRawToken } from './verification.service.js';



const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME_MIN = 15;

function nowPlusMinutes(min: number) {
  return new Date(Date.now() + min * 60000);
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { nombre, apellido, cedula, telefono, genero, email, password } = req.body;

    const exists = await UserModel.exists({ email });
    if (exists) throw new ApiError(StatusCodes.CONFLICT, 'Email ya registrado');

    const cedExists = await UserModel.exists({ cedula });
    if (cedExists) throw new ApiError(StatusCodes.CONFLICT, 'Cédula ya registrada');

    const user = await UserModel.create({
      nombre, apellido, cedula, telefono, genero, email,
      password: await hashPassword(password),
      role: 'CLIENTE', // o el rol correspondiente
      provider: 'local',
      emailVerified: false
    });

    // 👇 ya NO enviamos verificación aquí
    // await createAndSendVerification(user as any);

    res.status(StatusCodes.CREATED).json({
      message: 'Usuario registrado correctamente. Usa el endpoint /auth/send-verification-email para enviar el correo de verificación.',
      id: user.id
    });
  } catch (err) {
    next(err);
  }
}

export async function sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    if (!email) throw new ApiError(StatusCodes.BAD_REQUEST, 'Email requerido');

    const user = await UserModel.findOne({ email });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado');

    if (user.emailVerified) {
      return res.status(StatusCodes.OK).json({ message: 'Este correo ya está verificado' });
    }

    await createAndSendVerification(user as any);

    return res.status(StatusCodes.OK).json({ message: 'Correo de verificación enviado correctamente' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user || user.provider !== 'local') throw new ApiError(StatusCodes.UNAUTHORIZED, 'Credenciales inválidas');

    
    if (!user.emailVerified) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'Confirme primero el correo para poder ingresar');
    }
if (user.lockUntil && user.lockUntil > new Date()) {
      throw new ApiError(StatusCodes.LOCKED, 'Cuenta bloqueada temporalmente. Intenta más tarde.');
    }

    if (!user.isActive) {
  return res.status(403).json({ message: 'Tu cuenta está desactivada. Contacta a administración.' });
}


    const ok = await comparePassword(password, user.password || '');
    if (!ok) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockUntil = nowPlusMinutes(LOCK_TIME_MIN);
        user.loginAttempts = 0;
      }
      await user.save();
      throw new ApiError(StatusCodes.UNAUTHORIZED, 'Credenciales inválidas');
    }

    user.loginAttempts = 0;
    user.lockUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const session = await SessionModel.create({ userId: user._id });
    const accessToken = signAccessToken(user.id, session.id, user.role);
    const refreshToken = signRefreshToken(user.id, session.id, user.role);

    res
      .status(StatusCodes.OK)
      .json({ accessToken, refreshToken, user: { id: user.id, role: user.role, nombre: user.nombre, apellido: user.apellido, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction) {
  try {
    const { refreshToken } = req.body;
    const decoded = verifyRefreshToken(refreshToken);
    const session = await SessionModel.findById(decoded.sid);
    if (!session || session.revoked) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Refresh inválido');

    session.lastActivityAt = new Date();
    await session.save();

    const user = await UserModel.findById(decoded.sub);
    if (!user) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Usuario no encontrado');

    const accessToken = signAccessToken(user.id, session.id, user.role);
    const newRefreshToken = signRefreshToken(user.id, session.id, user.role);
    res.status(StatusCodes.OK).json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await SessionModel.findByIdAndUpdate(sessionId, { revoked: true });
    }
    res.status(StatusCodes.OK).json({ message: 'Sesión cerrada' });
  } catch (err) {
    next(err);
  }
}

export async function googleSignIn(req: Request, res: Response, next: NextFunction) {
  try {
    const { idToken } = req.body;
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.email) throw new ApiError(StatusCodes.UNAUTHORIZED, 'Token de Google inválido');
    const googleId = payload.sub!;
    const email = payload.email.toLowerCase();
    const nombre = payload.given_name ?? 'Cliente';
    const apellido = payload.family_name ?? 'Google';

    let user = await UserModel.findOne({ $or: [ { googleId }, { email } ] });
    if (!user) {
      // Crear solo cliente
      user = await UserModel.create({
        role: ROLES.CLIENTE,
        nombre, apellido,
        cedula: `G-${googleId}`,
        email,
        provider: 'google',
        googleId,
        emailVerified: true,
        isActive: true
      });
    } else {
      // Si existe y no es cliente, no permitir crear acceso por Google
      if (user.provider !== 'google' && user.role !== ROLES.CLIENTE) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'El inicio con Google solo está permitido para clientes');
      }
      if (!user.googleId) {
        user.googleId = googleId;
        user.provider = 'google';
      }
      if (!user.emailVerified) {
        user.emailVerified = true;
      }
      await user.save();
    }

    const session = await SessionModel.create({ userId: user._id });
    const accessToken = signAccessToken(user.id, session.id, user.role);
    const refreshToken = signRefreshToken(user.id, session.id, user.role);

    res.status(StatusCodes.OK).json({ accessToken, refreshToken, user: { id: user.id, role: user.role, nombre: user.nombre, apellido: user.apellido, email: user.email } });
  } catch (err) {
    next(err);
  }
}

// --- Password recovery (OTP) ---
function generateCode(): string {
  // 6 digits
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function forgotPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado');

    let tokenDoc = await PasswordResetTokenModel.findOne({ userId: user._id });
    const now = new Date();
    if (tokenDoc && tokenDoc.lastSentAt && (now.getTime() - tokenDoc.lastSentAt.getTime()) < 90_000) {
      throw new ApiError(StatusCodes.TOO_MANY_REQUESTS, 'Debes esperar 90 segundos para reenviar el código');
    }
    const code = generateCode();
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    if (!tokenDoc) {
      tokenDoc = await PasswordResetTokenModel.create({ userId: user._id, tokenHash: hash, expiresAt, lastSentAt: now });
    } else {
      tokenDoc.tokenHash = hash;
      tokenDoc.expiresAt = expiresAt;
      tokenDoc.lastSentAt = now;
      await tokenDoc.save();
    }

    await sendEmail(user.email, 'Código de recuperación', `<p>Tu código es: <b>${code}</b>. Expira en 15 minutos.</p>`);

    res.status(StatusCodes.OK).json({ message: 'Código enviado al correo' });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, code, newPassword } = req.body;
    const user = await UserModel.findOne({ email });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado');

    const tokenDoc = await PasswordResetTokenModel.findOne({ userId: user._id });
    if (!tokenDoc || tokenDoc.expiresAt < new Date()) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Código expirado. Solicita uno nuevo.');
    }
    const hash = crypto.createHash('sha256').update(code).digest('hex');
    if (hash !== tokenDoc.tokenHash) throw new ApiError(StatusCodes.BAD_REQUEST, 'Código incorrecto');

    user.password = await hashPassword(newPassword);
    await user.save();
    await tokenDoc.deleteOne();

    res.status(StatusCodes.OK).json({ message: 'Contraseña actualizada' });
  } catch (err) {
    next(err);
  }
}


export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    // Si no mandan email y el user está logueado, usamos su email
    const email = (req.body?.email || req.user?.email || '').toString().trim().toLowerCase();
    if (!email) throw new ApiError(StatusCodes.BAD_REQUEST, 'Email requerido');

    const user = await UserModel.findOne({ email });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado');

    if (user.emailVerified) {
      return res.status(StatusCodes.OK).json({ message: 'Este email ya está verificado' });
    }

    await createAndSendVerification(user as any); // throttle 90s incluido en tu service
    return res.status(StatusCodes.OK).json({ message: 'Enlace de verificación enviado' });
  } catch (err) { next(err); }
}

export async function verifyEmailLink(req: Request, res: Response, next: NextFunction) {
  try {
    // GET /auth/verify-email?token=...
    const token = String(req.query.token || '');
    if (!token) return res.status(StatusCodes.BAD_REQUEST).send(htmlError('Falta token'));

    const result = await verifyByRawToken(token);
    if (!result.ok || !result.userId) {
      return res.status(StatusCodes.BAD_REQUEST).send(htmlError(result.message || 'Token inválido o expirado'));
    }

    await UserModel.findByIdAndUpdate(result.userId, { emailVerified: true });
    return res.status(StatusCodes.OK).send(htmlOk('¡Correo verificado! Ya puedes iniciar sesión.'));
  } catch (err) { next(err); }
}

export async function verifyEmailJSON(req: Request, res: Response, next: NextFunction) {
  try {
    // POST /auth/verify-email (token en body para apps móviles/postman)
    const token = String(req.body.token || '');
    const result = await verifyByRawToken(token);
    if (!result.ok || !result.userId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ ok: false, message: result.message });
    }
    await UserModel.findByIdAndUpdate(result.userId, { emailVerified: true });
    return res.status(StatusCodes.OK).json({ ok: true, message: 'Correo verificado' });
  } catch (err) { next(err); }
}

// Helpers HTML (igual a lo que ya usas)
function htmlOk(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Verificación</title></head>
  <body style="font-family:Arial;margin:40px">
    <h2>✅ Verificación exitosa</h2><p>${msg}</p>
  </body></html>`;
}
function htmlError(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Verificación</title></head>
  <body style="font-family:Arial;margin:40px">
    <h2>❌ No se pudo verificar</h2><p>${msg}</p>
  </body></html>`;
}