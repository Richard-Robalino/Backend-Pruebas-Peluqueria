import Joi from 'joi';

const objectId = Joi.string().length(24).hex().message('ID inválido');
const nombreRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 .,'-]+$/; // letras, números y separadores comunes

export const createCategorySchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(60).pattern(nombreRegex).required()
    .messages({
      'string.empty': 'El nombre es obligatorio',
      'string.pattern.base': 'El nombre contiene caracteres no permitidos'
    }),
  descripcion: Joi.string().trim().max(300).allow('', null),
  imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null)
    .messages({ 'string.uri': 'imageUrl debe ser una URL http/https válida' }),
  activo: Joi.boolean().optional(),
  services: Joi.array().items(objectId).unique().max(200).default([])
    .messages({
      'array.unique': 'services no debe contener IDs repetidos',
      'any.required': 'services debe ser un arreglo de IDs'
    })
});

export const updateCategorySchema = Joi.object({
  nombre: Joi.string().trim().min(2).max(60).pattern(nombreRegex)
    .messages({ 'string.pattern.base': 'El nombre contiene caracteres no permitidos' }),
  descripcion: Joi.string().trim().max(300).allow('', null),
  imageUrl: Joi.string().uri({ scheme: ['http', 'https'] }).allow('', null),
  activo: Joi.boolean()
})
.min(1) // al menos un campo a actualizar
.messages({ 'object.min': 'Debes enviar al menos un campo para actualizar' });

export const setCategoryServicesSchema = Joi.object({
  services: Joi.array().items(objectId).unique().max(400).required()
    .messages({
      'array.unique': 'services no debe contener IDs repetidos',
      'any.required': 'services es requerido'
    })
});

export const addRemoveServicesSchema = Joi.object({
  services: Joi.array().items(objectId).unique().min(1).max(400).required()
    .messages({
      'array.unique': 'services no debe contener IDs repetidos',
      'array.min': 'Debes enviar al menos un ID de servicio'
    })
});

export const listCategoriesQuery = Joi.object({
  q: Joi.string().trim().max(60).allow('', null),
  active: Joi.boolean().optional(),
  includeServices: Joi.boolean().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20)
});
