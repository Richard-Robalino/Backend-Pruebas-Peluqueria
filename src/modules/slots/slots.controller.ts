import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import mongoose from 'mongoose';

import { ServiceSlotModel } from '../../models/ServiceSlot.js';
import { UserModel } from '../../models/User.js';
import { ServiceModel } from '../../models/Service.js';
import { ApiError } from '../../middlewares/errorHandler.js';
import { ROLES } from '../../constants/roles.js';
import { CategoryModel } from '../../models/Category.js';

// ---------------- Helpers ----------------

function timeStringToMinutes(t: string): number {
  const [hh, mm] = t.split(':').map(Number);
  if (
    Number.isNaN(hh) || Number.isNaN(mm) ||
    hh < 0 || hh > 23 ||
    (mm !== 0 && mm !== 30)
  ) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Hora inválida, debe ser HH:00 o HH:30');
  }
  return hh * 60 + mm;
}

function minutesToTimeString(m: number): string {
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const hhStr = hh.toString().padStart(2, '0');
  const mmStr = mm.toString().padStart(2, '0');
  return `${hhStr}:${mmStr}`;
}

async function validateStylistAndService(stylistId: string, serviceId: string) {
  if (!mongoose.isValidObjectId(stylistId) || !mongoose.isValidObjectId(serviceId)) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'IDs inválidos');
  }

  const [stylist, service] = await Promise.all([
    // ahora también traemos catalogs
    UserModel.findById(stylistId).select('role isActive catalogs').lean(),
    ServiceModel.findById(serviceId).lean()
  ]);

  if (!stylist) {
    throw new ApiError(StatusCodes.NOT_FOUND, 'Estilista no encontrado');
  }
  if (stylist.role !== ROLES.ESTILISTA) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'El usuario no es un estilista');
  }
  if (stylist.isActive === false) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'El estilista está inactivo');
  }

  if (!service || !service.activo) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'Servicio no encontrado o inactivo');
  }

  // 👉 Validar asociación usando CATÁLOGOS, no solo servicesOffered
  const catalogs = ((stylist as any).catalogs || []) as mongoose.Types.ObjectId[];

  if (!catalogs.length) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'El estilista no tiene catálogos asignados'
    );
  }

  // ¿Existe algún catálogo activo del estilista que contenga ese servicio?
  const catExists = await CategoryModel.exists({
    _id: { $in: catalogs },
    services: new mongoose.Types.ObjectId(serviceId),
    activo: true
  });

  if (!catExists) {
    throw new ApiError(
      StatusCodes.FORBIDDEN,
      'El servicio no está asociado a este estilista'
    );
  }

  // Validar duración del servicio
  const duracion = (service as any).duracionMin as number;
  if (!duracion || duracion <= 0) {
    throw new ApiError(StatusCodes.BAD_REQUEST, 'El servicio no tiene duración válida');
  }
  if (duracion % 30 !== 0) {
    throw new ApiError(
      StatusCodes.BAD_REQUEST,
      'La duración del servicio debe ser múltiplo de 30 minutos para crear horarios disponibles'
    );
  }

  return { stylist, service, duracion };
}


async function ensureNoOverlap(
  stylistId: string,
  dayOfWeek: string,
  startMin: number,
  endMin: number,
  excludeId?: string
) {
  const filter: any = {
    stylist: stylistId,
    dayOfWeek,
    isActive: true,
    startMin: { $lt: endMin },
    endMin: { $gt: startMin }
  };
  if (excludeId && mongoose.isValidObjectId(excludeId)) {
    filter._id = { $ne: excludeId };
  }

  const overlap = await ServiceSlotModel.exists(filter);
  if (overlap) {
    throw new ApiError(
      StatusCodes.CONFLICT,
      'Ya existe un horario disponible para este estilista que se cruza con ese rango'
    );
  }
}

// ---------------- Controllers ----------------

/**
 * POST /api/v1/slots/day
 * Crea TODO el horario de un día de una sola vez para un servicio:
 *   - Genera bloques [duración del servicio] con salto de 30 min ENTRE CITAS.
 *   - Ej: duración = 60 => 09:00-10:00, 10:30-11:30, 12:00-13:00, ...
 */
export async function createDaySlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { stylistId, serviceId, dayOfWeek, dayStart, dayEnd } = req.body;

    const startMin = timeStringToMinutes(dayStart);
    const endMin = timeStringToMinutes(dayEnd);

    if (endMin <= startMin) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'dayEnd debe ser mayor que dayStart');
    }

    const { duracion } = await validateStylistAndService(stylistId, serviceId);

    // stride = duración del servicio + 30 min de descanso
    const breakMin = 30;
    const step = duracion + breakMin;

    const slotsToInsert: {
      stylist: string;
      service: string;
      dayOfWeek: string;
      startMin: number;
      endMin: number;
      isActive: boolean;
    }[] = [];

    let cursor = startMin;

    while (cursor + duracion <= endMin) {
      const s = cursor;
      const e = s + duracion;
      slotsToInsert.push({
        stylist: stylistId,
        service: serviceId,
        dayOfWeek,
        startMin: s,
        endMin: e,
        isActive: true
      });
      // siguiente cita con 30 min de salto
      cursor = e + breakMin;
    }

    if (!slotsToInsert.length) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        'Con ese rango de horas y esa duración no se pudo generar ningún horario'
      );
    }

    // Revisar que estos slots nuevos no se crucen con otros servicios del mismo estilista ese día
    for (const slot of slotsToInsert) {
      await ensureNoOverlap(stylistId, dayOfWeek, slot.startMin, slot.endMin);
    }

    // Borramos los slots anteriores de ESTE servicio en ese día (reemplazo total)
    await ServiceSlotModel.deleteMany({ stylist: stylistId, service: serviceId, dayOfWeek });

    // Insertamos todos los nuevos
    await ServiceSlotModel.insertMany(slotsToInsert);

    const created = await ServiceSlotModel.find({
      stylist: stylistId,
      service: serviceId,
      dayOfWeek,
      isActive: true
    })
      .sort({ startMin: 1 })
      .populate('stylist', 'nombre apellido')
      .populate('service', 'nombre duracionMin precio');

    // Convertimos startMin/endMin a HH:MM en la respuesta
    const response = created.map(s => ({
      id: s.id,
      stylist: s.stylist,
      service: s.service,
      dayOfWeek: s.dayOfWeek,
      startTime: minutesToTimeString(s.startMin),
      endTime: minutesToTimeString(s.endMin),
      isActive: s.isActive
    }));

    res.status(StatusCodes.CREATED).json(response);
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/slots
 * Lista horarios (filtrando por estilista, servicio, día)
 */
export async function listSlots(req: Request, res: Response, next: NextFunction) {
  try {
    const { stylistId, serviceId, dayOfWeek, onlyActive } = req.query as any;
    const page = Number(req.query.page ?? 1);
    const limit = Number(req.query.limit ?? 200);

    const filter: any = {};
    if (stylistId && mongoose.isValidObjectId(stylistId)) {
      filter.stylist = stylistId;
    }
    if (serviceId && mongoose.isValidObjectId(serviceId)) {
      filter.service = serviceId;
    }
    if (dayOfWeek) {
      filter.dayOfWeek = dayOfWeek;
    }
    if (typeof onlyActive !== 'undefined') {
      filter.isActive = (onlyActive === 'true' || onlyActive === true);
    } else {
      filter.isActive = true;
    }

    const query = ServiceSlotModel.find(filter)
      .sort({ dayOfWeek: 1, startMin: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('stylist', 'nombre apellido')
      .populate('service', 'nombre duracionMin precio');

    const [data, total] = await Promise.all([
      query,
      ServiceSlotModel.countDocuments(filter)
    ]);

    const mapped = data.map(s => ({
      id: s.id,
      stylist: s.stylist,
      service: s.service,
      dayOfWeek: s.dayOfWeek,
      startTime: minutesToTimeString(s.startMin),
      endTime: minutesToTimeString(s.endMin),
      isActive: s.isActive
    }));

    res.json({ data: mapped, meta: { page, limit, total } });
  } catch (err) { next(err); }
}

/**
 * GET /api/v1/slots/:id
 */
export async function getSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const s = await ServiceSlotModel.findById(req.params.id)
      .populate('stylist', 'nombre apellido')
      .populate('service', 'nombre duracionMin precio');

    if (!s) throw new ApiError(StatusCodes.NOT_FOUND, 'Horario no encontrado');

    res.json({
      id: s.id,
      stylist: s.stylist,
      service: s.service,
      dayOfWeek: s.dayOfWeek,
      startTime: minutesToTimeString(s.startMin),
      endTime: minutesToTimeString(s.endMin),
      isActive: s.isActive
    });
  } catch (err) { next(err); }
}

/**
 * PUT /api/v1/slots/:id
 * Actualiza un solo slot (cambiar horas o activarlo/desactivarlo)
 */
export async function updateSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { dayOfWeek, startTime, endTime, isActive } = req.body;

    const slot = await ServiceSlotModel.findById(id);
    if (!slot) throw new ApiError(StatusCodes.NOT_FOUND, 'Horario no encontrado');

    if (req.user?.role === ROLES.ESTILISTA && slot.stylist.toString() !== req.user.id) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');
    }

    let startMin = slot.startMin;
    let endMin = slot.endMin;
    let day = slot.dayOfWeek;

    if (dayOfWeek) {
      day = dayOfWeek;
    }
    if (startTime) {
      startMin = timeStringToMinutes(startTime);
    }
    if (endTime) {
      endMin = timeStringToMinutes(endTime);
    }

    if (endMin <= startMin) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'La hora de fin debe ser mayor que la de inicio');
    }

    // validar contra duración del servicio
    const service = await ServiceModel.findById(slot.service).lean();
    if (!service || !service.activo) {
      throw new ApiError(StatusCodes.BAD_REQUEST, 'Servicio no encontrado o inactivo');
    }
    const duracion = (service as any).duracionMin as number;

    const minutes = endMin - startMin;
    if (minutes !== duracion) {
      throw new ApiError(
        StatusCodes.BAD_REQUEST,
        `La duración del horario (${minutes} min) debe coincidir con la duración del servicio (${duracion} min)`
      );
    }

    await ensureNoOverlap(String(slot.stylist), day, startMin, endMin, id);

    slot.dayOfWeek = day as any;
    slot.startMin = startMin;
    slot.endMin = endMin;
    if (typeof isActive === 'boolean') {
      slot.isActive = isActive;
    }

    await slot.save();

    await slot.populate([
      { path: 'stylist', select: 'nombre apellido' },
      { path: 'service', select: 'nombre duracionMin precio' }
    ]);

    res.json({
      id: slot.id,
      stylist: slot.stylist,
      service: slot.service,
      dayOfWeek: slot.dayOfWeek,
      startTime: minutesToTimeString(slot.startMin),
      endTime: minutesToTimeString(slot.endMin),
      isActive: slot.isActive
    });
  } catch (err) { next(err); }
}

/**
 * DELETE /api/v1/slots/:id
 * Soft delete: desactiva el horario
 */
export async function deleteSlot(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;

    const slot = await ServiceSlotModel.findById(id);
    if (!slot) throw new ApiError(StatusCodes.NOT_FOUND, 'Horario no encontrado');

    if (req.user?.role === ROLES.ESTILISTA && slot.stylist.toString() !== req.user.id) {
      throw new ApiError(StatusCodes.FORBIDDEN, 'No autorizado');
    }

    slot.isActive = false;
    await slot.save();

    res.json({ message: 'Horario desactivado' });
  } catch (err) { next(err); }
}
