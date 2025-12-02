import Joi from 'joi';

const HHMM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/; // 00:00..23:59
const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

function toMin(s: string) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

/* ----------------- HORARIO GENERAL DEL NEGOCIO ----------------- */
export const businessHoursSchema = Joi.object({
  days: Joi.array().items(
    Joi.object({
      dayOfWeek: Joi.number().integer().min(0).max(6).required(),
      open: Joi.string().pattern(HHMM_REGEX).required().messages({
        'string.pattern.base': 'open debe tener formato HH:mm (00-23:59)'
      }),
      close: Joi.string().pattern(HHMM_REGEX).required().messages({
        'string.pattern.base': 'close debe tener formato HH:mm (00-23:59)'
      })
    })
    .custom((v, helpers) => {
      if (toMin(v.close) <= toMin(v.open)) {
        return helpers.error('any.invalid');
      }
      return v;
    }, 'validación open < close')
    .messages({
      'any.invalid': 'En days[*], close debe ser mayor que open'
    })
  ).min(1).required(),
  exceptions: Joi.array().items(
    Joi.object({
      date: Joi.string().pattern(YYYY_MM_DD).required(),
      closed: Joi.boolean().default(false),
      open: Joi.string().pattern(HHMM_REGEX).messages({
        'string.pattern.base': 'exceptions[*].open debe tener formato HH:mm'
      }),
      close: Joi.string().pattern(HHMM_REGEX).messages({
        'string.pattern.base': 'exceptions[*].close debe tener formato HH:mm'
      })
    })
    .custom((v, helpers) => {
      // Si está cerrado ese día, no se permiten horas
      if (v.closed) {
        if (v.open || v.close) return helpers.error('any.invalid');
        return v;
      }
      // Si no está marcado como cerrado, requiere open y close válidos y en orden
      if (!v.open || !v.close) return helpers.error('any.required');
      if (toMin(v.close) <= toMin(v.open)) return helpers.error('any.invalid');
      return v;
    }, 'validación de excepción del negocio')
    .messages({
      'any.invalid': 'En exceptions[*], si closed=true no se permiten open/close; si closed=false, close debe ser mayor que open',
      'any.required': 'En exceptions[*], si no está closed=true se requieren open y close'
    })
  ).default([])
});

/* ----------------- HORARIO POR ESTILISTA ----------------- */
export const stylistScheduleSchema = Joi.object({
  stylistId: Joi.string().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  slots: Joi.array().items(
    Joi.object({
      start: Joi.string().pattern(HHMM_REGEX).required().messages({
        'string.pattern.base': 'slots[*].start debe tener formato HH:mm'
      }),
      end: Joi.string().pattern(HHMM_REGEX).required().messages({
        'string.pattern.base': 'slots[*].end debe tener formato HH:mm'
      })
    })
    .custom((v, helpers) => {
      if (toMin(v.end) <= toMin(v.start)) {
        return helpers.error('any.invalid');
      }
      return v;
    }, 'validación start < end')
    .messages({
      'any.invalid': 'En slots[*], end debe ser mayor que start'
    })
  ).min(1).required(),
  exceptions: Joi.array().items(
    Joi.object({
      date: Joi.string().pattern(YYYY_MM_DD).required(),
      closed: Joi.boolean().default(false),
      blocks: Joi.array().items(
        Joi.object({
          start: Joi.string().pattern(HHMM_REGEX).required().messages({
            'string.pattern.base': 'exceptions[*].blocks[*].start debe tener formato HH:mm'
          }),
          end: Joi.string().pattern(HHMM_REGEX).required().messages({
            'string.pattern.base': 'exceptions[*].blocks[*].end debe tener formato HH:mm'
          })
        })
        .custom((v, helpers) => {
          if (toMin(v.end) <= toMin(v.start)) {
            return helpers.error('any.invalid');
          }
          return v;
        }, 'validación block start < end')
        .messages({
          'any.invalid': 'En exceptions[*].blocks[*], end debe ser mayor que start'
        })
      ).default([])
    })
  ).default([])
});

// Para borrar un día completo del estilista
export const deleteStylistDaySchema = Joi.object({
  stylistId: Joi.string().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required()
});

// Para borrar SOLO una excepción puntual del estilista
export const deleteStylistExceptionSchema = Joi.object({
  stylistId: Joi.string().required(),
  dayOfWeek: Joi.number().integer().min(0).max(6).required(),
  date: Joi.string().pattern(YYYY_MM_DD).required()
});
