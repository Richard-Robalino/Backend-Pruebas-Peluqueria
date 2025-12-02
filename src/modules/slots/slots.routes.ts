import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateBody, validateQuery } from '../../middlewares/validate.js';

import {
  createDaySlots,
  listSlots,
  getSlot,
  updateSlot,
  deleteSlot
} from './slots.controller.js';

import {
  createDaySlotsSchema,
  updateSlotSchema,
  listSlotsQuery
} from './slots.schemas.js';

const router = Router();

// Públicos
router.get('/', validateQuery(listSlotsQuery), listSlots);
router.get('/:id', getSlot);

// Protegidos
router.use(authenticate);

router.post(
  '/day',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(createDaySlotsSchema),
  createDaySlots
);

router.put(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(updateSlotSchema),
  updateSlot
);

router.delete(
  '/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  deleteSlot
);

export default router;
