import Joi from 'joi';

const objectId = Joi.string().length(24).hex().message('ID inválido');

export const reportsRangeQuery = Joi.object({
  // día / semana / mes / año / rango manual
  period: Joi.string()
    .valid('day', 'week', 'month', 'year', 'custom')
    .default('month'),

  // para period = 'custom'
  from: Joi.date().iso().optional(),
  to: Joi.date().iso().optional(),

  // opcional: filtrar por estilista en algunos reportes JSON
  stylistId: objectId.optional()
});
