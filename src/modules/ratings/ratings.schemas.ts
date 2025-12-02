import Joi from 'joi';

export const createRatingSchema = Joi.object({
  bookingId: Joi.string().required(),
  estrellas: Joi.number().integer().min(1).max(5).required(),
  comentario: Joi.string().max(70).allow('', null)
});

export const updateRatingSchema = Joi.object({
  estrellas: Joi.number().integer().min(1).max(5),
  comentario: Joi.string().max(70).allow('', null)
}).min(1);

export const listRatingsQuerySchema = Joi.object({
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  minStars: Joi.number().integer().min(1).max(5).optional(),
  maxStars: Joi.number().integer().min(1).max(5).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  withStats: Joi.boolean().optional() // solo para recibidas (estilista)
});
