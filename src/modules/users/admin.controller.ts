import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { UserModel } from '../../models/User.js';
import { hashPassword } from '../../utils/password.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { createAndSendVerification } from '../auth/verification.service.js';
import { verifyByRawToken } from '../auth/verification.service.js';
import { ROLES } from '../../constants/roles.js';


export async function createUser(req: Request, res: Response, next: NextFunction) {
  try {
    const { role, nombre, apellido, cedula, telefono, genero, email, password, edad } = req.body

    const exists = await UserModel.exists({ email })
    if (exists) throw new ApiError(StatusCodes.CONFLICT, 'Email ya registrado')

    const cedExists = await UserModel.exists({ cedula })
    if (cedExists) throw new ApiError(StatusCodes.CONFLICT, 'Cédula ya registrada')

    const user = await UserModel.create({
      role,
      nombre,
      apellido,
      cedula,
      telefono,
      genero,
      edad,
      email,
      password: await hashPassword(password),
      provider: 'local',
      emailVerified: false,   // <- importante
      isActive: true
    })

    // 👇 Ya NO enviamos verificación automática
    // await createAndSendVerification(user as any)

    res.status(StatusCodes.CREATED).json({
      id: user.id,
      message: 'Usuario creado. Usa /api/v1/auth/send-verification-email para enviar la verificación cuando quieras.'
    })
  } catch (err) { next(err) }
}

export async function listUsers(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);
    const users = await UserModel.find().skip((page-1)*limit).limit(limit).select('-password');
    const total = await UserModel.countDocuments();
    res.json({ data: users, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

export async function getUser(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await UserModel.findById(req.params.id).select('-password');
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json(user);
  } catch (err) { next(err); }
}

export async function updateUser(req: Request, res: Response, next: NextFunction) {
  try {
    const updates = req.body;
    const user = await UserModel.findByIdAndUpdate(req.params.id, updates, { new: true }).select('-password');
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json(user);
  } catch (err) { next(err); }
}

export async function deleteUser(req: Request, res: Response, next: NextFunction) {
  try {
    // Regla: no eliminar si tiene citas pendientes
    // (se valida en Booking antes de borrar; aquí simplificamos y desactivamos)
    const user = await UserModel.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json({ message: 'Usuario desactivado' });
  } catch (err) { next(err); }
}

export async function updateOwnProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { nombre,apellido,telefono, genero, password } = req.body;
    const updates: any = { nombre,apellido,telefono, genero };
    if (password) {
      updates.password = await hashPassword(password);
    }
    const user = await UserModel.findByIdAndUpdate(userId, updates, { new: true }).select('-password');
    res.json(user);
  } catch (err) { next(err); }
}

export async function getOwnProfile(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const user = await UserModel.findById(userId).select('-password');
    res.json(user);
  } catch (err) { next(err); }
}
 

export async function sendVerificationEmail(req: Request, res: Response, next: NextFunction) {
  try {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) throw new ApiError(StatusCodes.BAD_REQUEST, 'Email requerido')

    const user = await UserModel.findOne({ email })
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado')

    if (user.emailVerified) {
      return res.status(StatusCodes.OK).json({ message: 'Este correo ya está verificado' })
    }

    await createAndSendVerification(user as any) // throttle 90s en tu service
    res.json({ message: 'Correo de verificación enviado' })
  } catch (err) { next(err) }
}

export async function resendVerification(req: Request, res: Response, next: NextFunction) {
  try {
    // opción: tomar de req.user si está autenticado y no envías email en body
    const email = String((req.body?.email ?? req.user?.email ?? '')).trim().toLowerCase()
    if (!email) throw new ApiError(StatusCodes.BAD_REQUEST, 'Email requerido')

    const user = await UserModel.findOne({ email })
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado')

    if (user.emailVerified) {
      return res.status(StatusCodes.OK).json({ message: 'Este correo ya está verificado' })
    }

    await createAndSendVerification(user as any)
    res.json({ message: 'Correo de verificación reenviado' })
  } catch (err) { next(err) }
}

export async function verifyEmailLink(req: Request, res: Response, next: NextFunction) {
  try {
    const token = String(req.query.token || '')
    if (!token) return res.status(StatusCodes.BAD_REQUEST).send(htmlError('Falta token'))

    const result = await verifyByRawToken(token)
    if (!result.ok || !result.userId) {
      return res.status(StatusCodes.BAD_REQUEST).send(htmlError(result.message || 'Token inválido o expirado'))
    }

    await UserModel.findByIdAndUpdate(result.userId, { emailVerified: true })
    return res.status(StatusCodes.OK).send(htmlOk('¡Correo verificado! Ya puedes iniciar sesión.'))
  } catch (err) { next(err) }
}

export async function verifyEmailJSON(req: Request, res: Response, next: NextFunction) {
  try {
    const token = String(req.body.token || '')
    const result = await verifyByRawToken(token)
    if (!result.ok || !result.userId) {
      return res.status(StatusCodes.BAD_REQUEST).json({ ok: false, message: result.message })
    }
    await UserModel.findByIdAndUpdate(result.userId, { emailVerified: true })
    res.json({ ok: true, message: 'Correo verificado' })
  } catch (err) { next(err) }
}

function htmlOk(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Verificación</title></head>
  <body style="font-family:Arial;margin:40px"><h2>✅ Verificación exitosa</h2><p>${msg}</p></body></html>`
}
function htmlError(msg: string) {
  return `<!doctype html><html><head><meta charset="utf-8"/><title>Verificación</title></head>
  <body style="font-family:Arial;margin:40px"><h2>❌ No se pudo verificar</h2><p>${msg}</p></body></html>`
}


export async function setUserActiveStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isActive } = req.body as { isActive: boolean };

    // No permitir auto-desactivarse
    if (req.user?.id === id && isActive === false) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'No puedes desactivar tu propia cuenta');
    }

    const user = await UserModel.findById(id);
    if (!user) throw new ApiError(StatusCodes.NOT_FOUND, 'Usuario no encontrado');

    // Proteger al último admin activo
    if (user.role === ROLES.ADMIN && isActive === false) {
      const otherActiveAdmins = await UserModel.countDocuments({
        role: ROLES.ADMIN,
        isActive: true,
        _id: { $ne: user._id }
      });
      if (otherActiveAdmins === 0) {
        throw new ApiError(StatusCodes.FORBIDDEN, 'No puedes desactivar al último administrador');
      }
    }

    user.isActive = !!isActive;
    await user.save();

    const plain = user.toObject();
    delete (plain as any).password;
    res.json({ message: `Usuario ${isActive ? 'activado' : 'desactivado'}`, user: plain });
  } catch (err) { next(err); }
}

// Alias opcionales y semánticos
export async function activateUser(req: Request, res: Response, next: NextFunction) {
  (req as any).body = { isActive: true };
  return setUserActiveStatus(req, res, next);
}
export async function deactivateUser(req: Request, res: Response, next: NextFunction) {
  (req as any).body = { isActive: false };
  return setUserActiveStatus(req, res, next);
}