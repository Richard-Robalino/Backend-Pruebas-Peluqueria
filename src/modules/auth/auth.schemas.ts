import Joi from 'joi';
import { PASSWORD_POLICY_REGEX } from '../../utils/password.js';

export const registerClientSchema = Joi.object({
  nombre: Joi.string().min(2).max(60).required(),
  apellido: Joi.string().min(2).max(60).required(),
  cedula: Joi.string().min(8).max(20).required(),
  telefono: Joi.string().allow('', null),
  genero: Joi.string().valid('M','F','O').optional(),
  email: Joi.string().email().required(),
  edad : Joi.number().integer().min(0).optional(),
  password: Joi.string().pattern(PASSWORD_POLICY_REGEX).required()
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

export const refreshSchema = Joi.object({
  refreshToken: Joi.string().required()
});

export const googleSignInSchema = Joi.object({
  idToken: Joi.string().required()
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

export const verifyOtpSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required()
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().pattern(PASSWORD_POLICY_REGEX).required()
});

export const resendVerificationSchema = Joi.object({
  // opcional: si el user está autenticado puede ir vacío y usar su propio email
  email: Joi.string().email().optional()
});

export const verifyEmailSchema = Joi.object({
  token: Joi.string().min(10).required()
});

