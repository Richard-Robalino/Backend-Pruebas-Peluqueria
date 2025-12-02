import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import {
  getBusinessHours, getStylistSchedules, upsertBusinessHours, upsertStylistSchedule,
  deleteBusinessHours, deleteStylistDay, deleteStylistException
} from './schedules.controller.js';
import { validateBody } from '../../middlewares/validate.js';
import {
  businessHoursSchema, stylistScheduleSchema,
  deleteStylistDaySchema, deleteStylistExceptionSchema
} from './schedules.schemas.js';

const router = Router();

router.get('/business', getBusinessHours);
router.get('/stylist/:stylistId', authenticate, getStylistSchedules);

router.use(authenticate);

// Upserts con validaciones nuevas
router.put('/business',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(businessHoursSchema),
  upsertBusinessHours
);

router.put('/stylist',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(stylistScheduleSchema),
  upsertStylistSchedule
);

// DELETEs
router.delete('/business',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  deleteBusinessHours
);

router.delete('/stylist',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(deleteStylistDaySchema),
  deleteStylistDay
);

router.delete('/stylist/exception',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(deleteStylistExceptionSchema),
  deleteStylistException
);

export default router;
