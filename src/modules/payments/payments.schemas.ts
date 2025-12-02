import Joi from 'joi';

export const payBookingSchema = Joi.object({
  method: Joi.string().valid('CARD', 'TRANSFER_PICHINCHA').required(),
  // opcionales, según método
  cardBrand: Joi.string().max(50).allow('', null),
  cardLast4: Joi.string().length(4).pattern(/^\d+$/).allow('', null),
  transactionRef: Joi.string().max(100).allow('', null)
});
