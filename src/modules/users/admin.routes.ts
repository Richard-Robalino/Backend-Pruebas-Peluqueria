import { Router } from 'express';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { authenticate } from '../../middlewares/auth.js';
import { validateBody } from '../../middlewares/validate.js';
import { createUser, deleteUser, getUser, listUsers, updateOwnProfile, updateUser, getOwnProfile ,sendVerificationEmail, resendVerification, verifyEmailLink, verifyEmailJSON } from './admin.controller.js';
import { createUserSchema, updateUserSchema, updateProfileSchema,sendVerificationSchema, resendVerificationSchema, verifyEmailSchema } from './user.schemas.js';
import { setUserActiveStatus, activateUser, deactivateUser } from './admin.controller.js';
import { updateUserStatusSchema } from './user.schemas.js';
const router = Router();

router.use(authenticate);

router.get('/me', getOwnProfile);
router.put('/me', validateBody(updateProfileSchema), updateOwnProfile);

// Admin only
router.post('/', requireRoles(ROLES.ADMIN), validateBody(createUserSchema), createUser);
router.get('/', requireRoles(ROLES.ADMIN), listUsers);
router.get('/:id', requireRoles(ROLES.ADMIN), getUser);
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.GERENTE), validateBody(updateUserSchema), updateUser);
router.delete('/:id', requireRoles(ROLES.ADMIN), deleteUser);

// Enviar verificación manual (sin login)

router.post('/send-verification-email', validateBody(sendVerificationSchema), sendVerificationEmail)

// Reenviar verificación (puedes exigir login si quieres)
router.post('/resend-verification', /* authenticate, */ validateBody(resendVerificationSchema), resendVerification)

// Confirmar por LINK (HTML)
router.get('/verify-email', verifyEmailLink)

// Confirmar por JSON (Postman / móvil)
router.post('/verify-email', validateBody(verifyEmailSchema), verifyEmailJSON)

// ✅ NUEVO: activar/desactivar (ADMIN o GERENTE)
router.patch('/:id/status',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(updateUserStatusSchema),
  setUserActiveStatus
);

// (Opcional) Alias semánticos
router.patch('/:id/activate',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  activateUser
);

router.patch('/:id/deactivate',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  deactivateUser
);

export default router;
