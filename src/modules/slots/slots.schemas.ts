import Joi from 'joi';

const objectId = Joi.string().length(24).hex().message('ID inválido');

const dayOfWeek = Joi.string().valid(
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
  'DOMINGO'
);

const timeRegex = /^([01]\d|2[0-3]):(00|30)$/; // HH:00 o HH:30

export const createDaySlotsSchema = Joi.object({
  stylistId: objectId.required(),
  serviceId: objectId.required(),
  dayOfWeek: dayOfWeek.required(),
  // horario de trabajo del día: ejemplo  "09:00" a "17:00"
  dayStart: Joi.string().pattern(timeRegex).required()
    .messages({ 'string.pattern.base': 'dayStart debe ser HH:00 o HH:30' }),
  dayEnd: Joi.string().pattern(timeRegex).required()
    .messages({ 'string.pattern.base': 'dayEnd debe ser HH:00 o HH:30' })
});

export const updateSlotSchema = Joi.object({
  dayOfWeek: dayOfWeek,
  startTime: Joi.string().pattern(timeRegex)
    .messages({ 'string.pattern.base': 'startTime debe ser HH:00 o HH:30' }),
  endTime: Joi.string().pattern(timeRegex)
    .messages({ 'string.pattern.base': 'endTime debe ser HH:00 o HH:30' }),
  isActive: Joi.boolean()
}).min(1)
  .messages({ 'object.min': 'Debes enviar al menos un campo para actualizar' });

export const listSlotsQuery = Joi.object({
  stylistId: objectId.optional(),
  serviceId: objectId.optional(),
  dayOfWeek: dayOfWeek.optional(),
  onlyActive: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(200)
});
