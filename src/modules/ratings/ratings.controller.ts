import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../middlewares/errorHandler.js';
import { BookingModel } from '../../models/Booking.js';
import { RatingModel } from '../../models/Rating.js';
import { StatusCodes } from 'http-status-codes';
import { hasProfanity } from '../../utils/profanity.js';
import { BOOKING_STATUS } from '../../constants/statuses.js';
import { ROLES } from '../../constants/roles.js';

/** (Ya tienes) Crear calificación (cliente) */
export async function createRating(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { bookingId, estrellas, comentario } = req.body;
    const booking = await BookingModel.findById(bookingId);
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Reserva no existe');
    if (booking.clienteId.toString() !== userId) throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');
    if (booking.estado !== BOOKING_STATUS.COMPLETED) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Solo puedes calificar reservas finalizadas');
    }
    const exists = await RatingModel.exists({ bookingId });
    if (exists) throw new ApiError(StatusCodes.CONFLICT, 'Ya calificaste esta reserva');

    if (comentario && hasProfanity(comentario)) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'El comentario contiene lenguaje no permitido');
    }

    const rating = await RatingModel.create({
      bookingId, clienteId: booking.clienteId, estilistaId: booking.estilistaId, estrellas, comentario
    });
    res.status(StatusCodes.CREATED).json(rating);
  } catch (err) { next(err); }
}

/** Listar MIS calificaciones (cliente) */
export async function listMyRatingsClient(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { dateFrom, dateTo, minStars, maxStars } = req.query as any;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const q: any = { clienteId: userId };
    if (minStars || maxStars) {
      q.estrellas = {};
      if (minStars) q.estrellas.$gte = Number(minStars);
      if (maxStars) q.estrellas.$lte = Number(maxStars);
    }
    if (dateFrom || dateTo) {
      q.createdAt = {};
      if (dateFrom) q.createdAt.$gte = new Date(String(dateFrom));
      if (dateTo) q.createdAt.$lte = new Date(String(dateTo));
    }

    const [data, total] = await Promise.all([
      RatingModel.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit),
      RatingModel.countDocuments(q)
    ]);
    res.json({ data, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

/** Listar MIS calificaciones recibidas (estilista) + filtro + stats opcional */
export async function listMyRatingsStylist(req: Request, res: Response, next: NextFunction) {
  try {
    const stylistId = req.user!.id;
    const { dateFrom, dateTo, minStars, maxStars, withStats } = req.query as any;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const q: any = { estilistaId: stylistId };
    if (minStars || maxStars) {
      q.estrellas = {};
      if (minStars) q.estrellas.$gte = Number(minStars);
      if (maxStars) q.estrellas.$lte = Number(maxStars);
    }
    if (dateFrom || dateTo) {
      q.createdAt = {};
      if (dateFrom) q.createdAt.$gte = new Date(String(dateFrom));
      if (dateTo) q.createdAt.$lte = new Date(String(dateTo));
    }

    const [data, total, stats] = await Promise.all([
      RatingModel.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit),
      RatingModel.countDocuments(q),
      (String(withStats) === 'true')
        ? RatingModel.aggregate([
            { $match: q },
            { $group: { _id: '$estilistaId', avg: { $avg: '$estrellas' }, count: { $sum: 1 } } }
          ])
        : Promise.resolve(null)
    ]);

    res.json({
      data,
      meta: { page, limit, total },
      stats: stats && stats[0] ? { avg: stats[0].avg, count: stats[0].count } : undefined
    });
  } catch (err) { next(err); }
}

/** Listar calificaciones de un estilista (ADMIN/GERENTE) con filtros */
export async function listRatingsByStylistId(req: Request, res: Response, next: NextFunction) {
  try {
    const stylistId = req.params.id;
    const { dateFrom, dateTo, minStars, maxStars } = req.query as any;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 20);

    const q: any = { estilistaId: stylistId };
    if (minStars || maxStars) {
      q.estrellas = {};
      if (minStars) q.estrellas.$gte = Number(minStars);
      if (maxStars) q.estrellas.$lte = Number(maxStars);
    }
    if (dateFrom || dateTo) {
      q.createdAt = {};
      if (dateFrom) q.createdAt.$gte = new Date(String(dateFrom));
      if (dateTo) q.createdAt.$lte = new Date(String(dateTo));
    }

    const [data, total] = await Promise.all([
      RatingModel.find(q).sort({ createdAt: -1 }).skip((page-1)*limit).limit(limit),
      RatingModel.countDocuments(q)
    ]);
    res.json({ data, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

/** Obtener calificación por id (autorización por rol) */
export async function getRatingById(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await RatingModel.findById(req.params.id);
    if (!r) throw new ApiError(StatusCodes.NOT_FOUND, 'Calificación no encontrada');

    const u = req.user!;
    if (u.role === ROLES.ADMIN || u.role === ROLES.GERENTE) return res.json(r);
    if (u.role === ROLES.CLIENTE && r.clienteId.toString() === u.id) return res.json(r);
    if (u.role === ROLES.ESTILISTA && r.estilistaId.toString() === u.id) return res.json(r);

    throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');
  } catch (err) { next(err); }
}

/** Actualizar calificación (solo cliente dueño o admin/gerente) */
export async function updateRating(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await RatingModel.findById(req.params.id);
    if (!r) throw new ApiError(StatusCodes.NOT_FOUND, 'Calificación no encontrada');

    const u = req.user!;
    const canEdit = (u.role === ROLES.ADMIN || u.role === ROLES.GERENTE) || (u.role === ROLES.CLIENTE && r.clienteId.toString() === u.id);
    if (!canEdit) throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');

    const { estrellas, comentario } = req.body;

    if (typeof estrellas !== 'undefined') r.estrellas = Number(estrellas);
    if (typeof comentario !== 'undefined') {
      if (comentario && hasProfanity(comentario)) {
        throw new ApiError(StatusCodes.BAD_REQUEST, 'El comentario contiene lenguaje no permitido');
      }
      r.comentario = comentario;
    }

    await r.save();
    res.json(r);
  } catch (err) { next(err); }
}

/** Eliminar calificación (solo cliente dueño o admin/gerente) */
export async function deleteRating(req: Request, res: Response, next: NextFunction) {
  try {
    const r = await RatingModel.findById(req.params.id);
    if (!r) throw new ApiError(StatusCodes.NOT_FOUND, 'Calificación no encontrada');

    const u = req.user!;
    const canDelete = (u.role === ROLES.ADMIN || u.role === ROLES.GERENTE) || (u.role === ROLES.CLIENTE && r.clienteId.toString() === u.id);
    if (!canDelete) throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');

    await r.deleteOne();
    res.json({ message: 'Calificación eliminada' });
  } catch (err) { next(err); }
}
