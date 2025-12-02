import Joi from 'joi';

const objectId = Joi.string().length(24).hex().message('ID inválido');

export const createBookingSchema = Joi.object({
  // Puedes mandar UN slot...
  slotId: objectId.optional(),

  // ...o varios slots
  slotIds: Joi.array().items(objectId).min(1).optional(),

  // Fecha del día (mismo formato que antes)
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),

  notas: Joi.string().max(200).allow('', null)
})
  .custom((value, helpers) => {
    const hasSingle = !!value.slotId;
    const hasMany = Array.isArray(value.slotIds) && value.slotIds.length > 0;

    if (!hasSingle && !hasMany) {
      return helpers.error('any.custom', { message: 'Debes enviar slotId o slotIds' });
    }
    if (hasSingle && hasMany) {
      return helpers.error('any.custom', { message: 'Envía solo slotId o slotIds, no ambos' });
    }
    return value;
  }, 'slotId/slotIds validation');


export const rescheduleSchema = Joi.object({
  // Reprogramar también elige un nuevo slot y fecha
  slotId: objectId.required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required()
});

export const cancelSchema = Joi.object({
  motivo: Joi.string().max(100).required()
});

export const availabilityQuerySchema = Joi.object({
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
  serviceId: objectId.required(),
  stylistId: objectId.optional()
});
