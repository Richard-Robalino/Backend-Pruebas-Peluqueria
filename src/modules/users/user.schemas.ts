import Joi from 'joi';
import { PASSWORD_POLICY_REGEX } from '../../utils/password.js';
import { ROLES } from '../../constants/roles.js';

export const createUserSchema = Joi.object({
  role: Joi.string().valid(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA ).required(),
  nombre: Joi.string().min(2).max(60).required(),
  apellido: Joi.string().min(2).max(60).required(),
  cedula: Joi.string().min(8).max(20).required(),
  telefono: Joi.string().allow('', null),
  genero: Joi.string().valid('M','F','O').optional(),
  email: Joi.string().email().required(),
  edad : Joi.number().integer().min(0).optional(),
  password: Joi.string().pattern(PASSWORD_POLICY_REGEX).required(),
}).keys({ ROLES });

export const updateUserSchema = Joi.object({
  telefono: Joi.string().allow('', null),
  genero: Joi.string().valid('M','F','O'),
  isActive: Joi.boolean()
});

export const updateProfileSchema = Joi.object({
  nombre: Joi.string().min(2).max(60).optional(),
  apellido: Joi.string().min(2).max(60).optional(),
  telefono: Joi.string().allow('', null),
  genero: Joi.string().valid('M','F','O'),
  edad : Joi.number().integer().min(0).optional(),
  password: Joi.string().pattern(PASSWORD_POLICY_REGEX).optional()
});


export const sendVerificationSchema = Joi.object({
  email: Joi.string().email().required()
})

export const resendVerificationSchema = Joi.object({
  // Si quieres permitir autenticado sin pasar email, hazlo opcional.
  email: Joi.string().email().optional()
})

export const verifyEmailSchema = Joi.object({
  token: Joi.string().min(10).required()
})

export const updateUserStatusSchema = Joi.object({
  isActive: Joi.boolean().required()
});
