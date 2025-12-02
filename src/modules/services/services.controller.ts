import { Request, Response, NextFunction } from 'express';
import { StatusCodes } from 'http-status-codes';
import { ServiceModel } from '../../models/Service.js';
import { ApiError } from '../../middlewares/errorHandler.js';

export async function createService(req: Request, res: Response, next: NextFunction) {
  try {
    const exists = await ServiceModel.exists({ codigo: req.body.codigo });
    if (exists) throw new ApiError(StatusCodes.CONFLICT, 'Código de servicio ya existe');
    const svc = await ServiceModel.create(req.body);
    res.status(StatusCodes.CREATED).json(svc);
  } catch (err) { next(err); }
}
export async function listServices(_req: Request, res: Response, next: NextFunction) {
  try {
    const list = await ServiceModel.find({ activo: true });
    res.json(list);
  } catch (err) { next(err); }
}
export async function getService(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await ServiceModel.findById(req.params.id);
    if (!svc) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json(svc);
  } catch (err) { next(err); }
}
export async function updateService(req: Request, res: Response, next: NextFunction) {
  try {
    const svc = await ServiceModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!svc) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json(svc);
  } catch (err) { next(err); }
}
export async function deleteService(req: Request, res: Response, next: NextFunction) {
  try {
    // No borrado duro si tiene citas futuras: aquí sólo marcamos inactivo
    const svc = await ServiceModel.findByIdAndUpdate(req.params.id, { activo: false }, { new: true });
    if (!svc) throw new ApiError(StatusCodes.NOT_FOUND, 'No existe');
    res.json({ message: 'Servicio desactivado' });
  } catch (err) { next(err); }
}
