import { Request, Response, NextFunction } from 'express';
import { BusinessHoursModel } from '../../models/BusinessHours.js';
import { StylistScheduleModel } from '../../models/StylistSchedule.js';
import { StatusCodes } from 'http-status-codes';
import { ApiError } from '../../middlewares/errorHandler.js';

export async function upsertBusinessHours(req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await BusinessHoursModel.findOne();
    if (doc) {
      doc.days = req.body.days;
      doc.exceptions = req.body.exceptions ?? [];
      await doc.save();
      return res.json(doc);
    }
    const created = await BusinessHoursModel.create(req.body);
    res.status(StatusCodes.CREATED).json(created);
  } catch (err) { next(err); }
}

export async function getBusinessHours(_req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await BusinessHoursModel.findOne();
    res.json(doc);
  } catch (err) { next(err); }
}

export async function upsertStylistSchedule(req: Request, res: Response, next: NextFunction) {
  try {
    const { stylistId, dayOfWeek, slots, exceptions } = req.body;
    const doc = await StylistScheduleModel.findOneAndUpdate(
      { stylistId, dayOfWeek },
      { $set: { slots, exceptions } },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) { next(err); }
}

export async function getStylistSchedules(req: Request, res: Response, next: NextFunction) {
  try {
    const stylistId = req.params.stylistId;
    const docs = await StylistScheduleModel.find({ stylistId });
    res.json(docs);
  } catch (err) { next(err); }
}

// 🔴 Eliminar horario del negocio (borra el documento)
export async function deleteBusinessHours(_req: Request, res: Response, next: NextFunction) {
  try {
    const doc = await BusinessHoursModel.findOne();
    if (!doc) return res.status(StatusCodes.NO_CONTENT).end();
    await doc.deleteOne();
    res.json({ message: 'Horario de negocio eliminado' });
  } catch (err) { next(err); }
}

// 🔴 Eliminar el horario de un estilista para un día de la semana
export async function deleteStylistDay(req: Request, res: Response, next: NextFunction) {
  try {
    const { stylistId, dayOfWeek } = req.body as { stylistId: string; dayOfWeek: number };
    const deleted = await StylistScheduleModel.findOneAndDelete({ stylistId, dayOfWeek });
    if (!deleted) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe horario para ese estilista y día');
    res.json({ message: 'Horario del día eliminado' });
  } catch (err) { next(err); }
}

// 🔴 Eliminar SOLO una excepción de un día (mantiene el resto de slots/excepciones)
export async function deleteStylistException(req: Request, res: Response, next: NextFunction) {
  try {
    const { stylistId, dayOfWeek, date } = req.body as { stylistId: string; dayOfWeek: number; date: string };
    const doc = await StylistScheduleModel.findOne({ stylistId, dayOfWeek });
    if (!doc) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe horario para ese estilista y día');

    const before = doc.exceptions?.length || 0;
    doc.exceptions = (doc.exceptions || []).filter(e => e.date !== date);
    if ((doc.exceptions?.length || 0) === before) {
      throw new ApiError(StatusCodes.NOT_FOUND, 'Excepción no encontrada para esa fecha');
    }

    await doc.save();
    res.json({ message: 'Excepción eliminada' });
  } catch (err) { next(err); }
}
