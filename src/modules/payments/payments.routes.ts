import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateBody } from '../../middlewares/validate.js';
import { payBookingSchema } from './payments.schemas.js';
import { requestTransferPayment, confirmTransferPayment } from './payments.controller.js';

const router = Router();

router.use(authenticate);

// Cliente/Admin/Gerente generan orden de pago (datos de cuenta + email al admin)
router.post(
  '/booking/:id/transfer-request',
  requireRoles(ROLES.CLIENTE, ROLES.ADMIN, ROLES.GERENTE),
  requestTransferPayment
);

// Solo ADMIN/GERENTE confirman la transferencia y envían factura al cliente
router.post(
  '/booking/:id/confirm-transfer',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  confirmTransferPayment
);

export default router;

