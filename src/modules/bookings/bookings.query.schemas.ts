import Joi from 'joi'

export const listAllBookingsQuery = Joi.object({
  status: Joi.string().optional(),
  stylistId: Joi.string().optional(),
  clientId: Joi.string().optional(),
  dateFrom: Joi.string().isoDate().optional(),
  dateTo: Joi.string().isoDate().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional()
})

export const pagedQuery = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(200).optional()
})
