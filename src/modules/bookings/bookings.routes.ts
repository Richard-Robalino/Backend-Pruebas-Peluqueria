import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateBody, validateQuery } from '../../middlewares/validate.js';
import { availabilityQuerySchema, cancelSchema, createBookingSchema, rescheduleSchema } from './bookings.schemas.js';
import { cancelBooking, createBooking, getAvailability, rescheduleBooking, stylistComplete, stylistConfirm } from './bookings.controller.js';

import {
  listAllBookings,
  listMyBookingsClient,
  listMyBookingsStylist,
  listBookingsByStylistId,
  getBookingById
} from './bookings.query.controller.js'

import { listAllBookingsQuery, pagedQuery } from './bookings.query.schemas.js'

const router = Router();

router.get('/availability', validateQuery(availabilityQuerySchema), getAvailability);

router.use(authenticate);
router.post('/', requireRoles(ROLES.CLIENTE, ROLES.ADMIN, ROLES.GERENTE), validateBody(createBookingSchema), createBooking);
router.put('/:id/reschedule', validateBody(rescheduleSchema), rescheduleBooking);
router.post('/:id/cancel', validateBody(cancelSchema), cancelBooking);

router.post('/:id/confirm', requireRoles(ROLES.ESTILISTA), stylistConfirm);
router.post('/:id/complete', requireRoles(ROLES.ESTILISTA), stylistComplete);



// 1) Todas las citas (ADMIN/GERENTE)
router.get('/',requireRoles(ROLES.ADMIN, ROLES.GERENTE),validateQuery(listAllBookingsQuery),listAllBookings)

// 2) Mis citas (cliente)
router.get('/me',requireRoles(ROLES.CLIENTE),validateQuery(pagedQuery),listMyBookingsClient)

// 3) Mis citas (estilista autenticado)
router.get('/mystyle',requireRoles(ROLES.ESTILISTA),validateQuery(pagedQuery),listMyBookingsStylist)

// 4) Citas de un estilista específico (ADMIN/GERENTE)
router.get('/stylist/:id',requireRoles(ROLES.ADMIN, ROLES.GERENTE),validateQuery(pagedQuery),listBookingsByStylistId)

// 5) Una cita específica (con autorización por rol)
router.get('/:id', getBookingById)

export default router;
