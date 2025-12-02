import Joi from 'joi';

export const createServiceSchema = Joi.object({
  nombre: Joi.string().min(2).max(80).required(),
  codigo: Joi.string().alphanum().min(2).max(20).required(),
  descripcion: Joi.string().allow('', null),
  precio: Joi.number().min(0).required(),
  duracionMin: Joi.number().integer().min(5).max(480).required(),
  activo: Joi.boolean().optional()
});

export const updateServiceSchema = Joi.object({
  nombre: Joi.string().min(2).max(80),
  descripcion: Joi.string().allow('', null),
  precio: Joi.number().min(0),
  duracionMin: Joi.number().integer().min(5).max(480),
  activo: Joi.boolean()
});
