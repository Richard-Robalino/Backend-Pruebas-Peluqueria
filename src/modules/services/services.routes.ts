import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateBody } from '../../middlewares/validate.js';
import { createServiceSchema, updateServiceSchema } from './services.schemas.js';
import { createService, deleteService, getService, listServices, updateService } from './services.controller.js';

const router = Router();

router.get('/', listServices);
router.get('/:id', getService);

router.use(authenticate);
router.post('/', requireRoles(ROLES.ADMIN, ROLES.GERENTE), validateBody(createServiceSchema), createService);
router.put('/:id', requireRoles(ROLES.ADMIN, ROLES.GERENTE), validateBody(updateServiceSchema), updateService);
router.delete('/:id', requireRoles(ROLES.ADMIN, ROLES.GERENTE), deleteService);

export default router;
