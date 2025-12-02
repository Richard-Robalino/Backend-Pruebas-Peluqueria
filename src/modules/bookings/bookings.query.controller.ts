import { Request, Response, NextFunction } from 'express'
import { StatusCodes } from 'http-status-codes'
import { BookingModel } from '../../models/Booking.js'
import { ApiError } from '../../middlewares/errorHandler.js'
import { ROLES } from '../../constants/roles.js'

/**
 * GET /bookings (ADMIN/GERENTE)
 * Filtros opcionales: status, stylistId, clientId, dateFrom, dateTo (ISO), page, limit
 */
export async function listAllBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const { status, stylistId, clientId, dateFrom, dateTo } = req.query as any
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)

    const q: any = {}
    if (status) q.estado = status
    if (stylistId) q.estilistaId = stylistId
    if (clientId) q.clienteId = clientId
    if (dateFrom || dateTo) {
      q.inicio = {}
      if (dateFrom) q.inicio.$gte = new Date(String(dateFrom))
      if (dateTo)   q.inicio.$lte = new Date(String(dateTo))
    }

    const [data, total] = await Promise.all([
      BookingModel.find(q)
        .sort({ inicio: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      BookingModel.countDocuments(q)
    ])

    res.json({ data, meta: { page, limit, total } })
  } catch (err) { next(err) }
}

/**
 * GET /bookings/me (CLIENTE)
 * Lista las citas del cliente autenticado
 */
export async function listMyBookingsClient(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)

    const [data, total] = await Promise.all([
      BookingModel.find({ clienteId: userId }).sort({ inicio: -1 }).skip((page-1)*limit).limit(limit),
      BookingModel.countDocuments({ clienteId: userId })
    ])

    res.json({ data, meta: { page, limit, total } })
  } catch (err) { next(err) }
}

/**
 * GET /bookings/mystyle (ESTILISTA)
 * Lista las citas del estilista autenticado
 */
export async function listMyBookingsStylist(req: Request, res: Response, next: NextFunction) {
  try {
    const stylistId = req.user!.id
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)

    const [data, total] = await Promise.all([
      BookingModel.find({ estilistaId: stylistId }).sort({ inicio: -1 }).skip((page-1)*limit).limit(limit),
      BookingModel.countDocuments({ estilistaId: stylistId })
    ])

    res.json({ data, meta: { page, limit, total } })
  } catch (err) { next(err) }
}

/**
 * GET /bookings/stylist/:id (ADMIN/GERENTE)
 * Lista las citas de un estilista específico
 */
export async function listBookingsByStylistId(req: Request, res: Response, next: NextFunction) {
  try {
    const stylistId = req.params.id
    const page = Number(req.query.page ?? 1)
    const limit = Number(req.query.limit ?? 20)

    const [data, total] = await Promise.all([
      BookingModel.find({ estilistaId: stylistId }).sort({ inicio: -1 }).skip((page-1)*limit).limit(limit),
      BookingModel.countDocuments({ estilistaId: stylistId })
    ])

    res.json({ data, meta: { page, limit, total } })
  } catch (err) { next(err) }
}

/**
 * GET /bookings/:id (todos los roles autenticados)
 * - ADMIN/GERENTE: cualquier cita
 * - ESTILISTA: solo si es su cita
 * - CLIENTE: solo si es su cita
 */
export async function getBookingById(req: Request, res: Response, next: NextFunction) {
  try {
    const booking = await BookingModel.findById(req.params.id)
    if (!booking) throw new ApiError(StatusCodes.NOT_FOUND, 'Cita no encontrada')

    const u = req.user!
    if (u.role === ROLES.ADMIN || u.role === ROLES.GERENTE) {
      return res.json(booking)
    }
    if (u.role === ROLES.ESTILISTA && booking.estilistaId.toString() === u.id) {
      return res.json(booking)
    }
    if (u.role === ROLES.CLIENTE && booking.clienteId.toString() === u.id) {
      return res.json(booking)
    }
    throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado')
  } catch (err) { next(err) }
}
