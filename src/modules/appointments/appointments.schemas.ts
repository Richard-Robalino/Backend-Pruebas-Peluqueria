import Joi from 'joi';

const objectId = Joi.string()
  .length(24)
  .hex()
  .message('ID inválido');

// 🔹 Crear cita manual
export const createAppointmentSchema = Joi.object({
  stylistId: objectId.required(),  // estilista obligatorio

  // 🔥 uno o varios servicios
  serviceId: objectId.optional(),
  serviceIds: Joi.array().items(objectId).min(1).optional(),

  // 🔥 id de usuario (cliente) opcional
  clientId: objectId.optional(),

  // Fechas en ISO (ej: "2025-11-18T14:00:00.000Z")
  start: Joi.date().iso().required(),
  end: Joi.date().iso().required(),

  clientName: Joi.string().min(2).max(80).allow('', null),
  clientPhone: Joi.string().allow('', null),
  status: Joi.string().valid('PENDIENTE', 'CONFIRMADA').optional(),
  notes: Joi.string().max(500).allow('', null)
})
  .custom((value, helpers) => {
    const hasSingle = !!value.serviceId;
    const hasMany = Array.isArray(value.serviceIds) && value.serviceIds.length > 0;

    if (!hasSingle && !hasMany) {
      return helpers.error('any.custom', { message: 'Debes enviar serviceId o serviceIds' });
    }
    if (hasSingle && hasMany) {
      return helpers.error('any.custom', { message: 'Envía solo serviceId o serviceIds, no ambos' });
    }
    return value;
  }, 'serviceId/serviceIds validation');

// 🔹 Actualizar cita manual
export const updateAppointmentSchema = Joi.object({
  start: Joi.date().iso(),
  end: Joi.date().iso(),
  status: Joi.string().valid('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA'),
  clientId: objectId.optional(), // 🔥 ahora se puede actualizar el cliente
  clientName: Joi.string().min(2).max(80).allow('', null),
  clientPhone: Joi.string().allow('', null),
  notes: Joi.string().max(500).allow('', null)
})
  .min(1)
  .messages({ 'object.min': 'Debes enviar al menos un campo para actualizar' });

// 🔹 Filtros de listado
export const listAppointmentsQuery = Joi.object({
  stylistId: objectId.optional(),
  serviceId: objectId.optional(), // buscará citas que incluyan ese servicio
  status: Joi.string().valid('PENDIENTE', 'CONFIRMADA', 'CANCELADA', 'COMPLETADA').optional(),
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20)
});
