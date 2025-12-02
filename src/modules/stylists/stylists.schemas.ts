import Joi from 'joi'
import { PASSWORD_POLICY_REGEX } from '../../utils/password.js'

const objectId = Joi.string()
  .length(24)
  .hex()
  .message('ID inválido')

export const createStylistSchema = Joi.object({
  nombre: Joi.string().min(2).max(60).required(),
  apellido: Joi.string().min(2).max(60).required(),
  cedula: Joi.string().min(8).max(20).required(),
  telefono: Joi.string().allow('', null),
  genero: Joi.string().valid('M', 'F', 'O').optional(),
  edad: Joi.number().integer().min(0).optional(),
  email: Joi.string().email().required(),
  password: Joi.string().pattern(PASSWORD_POLICY_REGEX).required(),
  // 🔥 ahora se envían catálogos, NO servicios
  catalogs: Joi.array().items(objectId).min(1).required()
    .messages({
      'array.min': 'Debes asignar al menos un catálogo al estilista'
    })
})

export const updateStylistServicesSchema = Joi.object({
  // usamos la misma ruta PUT /:id/services pero el body trae catalogs
  catalogs: Joi.array().items(objectId).min(1).required()
    .messages({
      'array.min': 'Debes asignar al menos un catálogo al estilista'
    })
})
