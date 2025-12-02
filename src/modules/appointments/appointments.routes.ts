import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateBody, validateQuery } from '../../middlewares/validate.js';

import {
  createAppointment,
  listAppointments,
  getAppointment,
  updateAppointment,
  cancelAppointment
} from './appointments.controller.js';

import {
  createAppointmentSchema,
  updateAppointmentSchema,
  listAppointmentsQuery
} from './appointments.schemas.js';

const router = Router();

// Listado y detalle podrían ser públicos o protegidos según tu necesidad;
// aquí los dejo PROTEGIDOS porque es info sensible.
router.use(authenticate);

// Listar
router.get('/',
  validateQuery(listAppointmentsQuery),
  listAppointments
);

// Ver una cita
router.get('/:id', getAppointment);

// Crear cita: ADMIN, GERENTE o ESTILISTA
router.post('/',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(createAppointmentSchema),
  createAppointment
);

// Actualizar cita
router.put('/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(updateAppointmentSchema),
  updateAppointment
);

// Cancelar cita
router.delete('/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  cancelAppointment
);

export default router;
