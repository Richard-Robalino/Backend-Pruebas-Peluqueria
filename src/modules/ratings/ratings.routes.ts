import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { validateBody, validateQuery } from '../../middlewares/validate.js';
import { createRatingSchema, updateRatingSchema, listRatingsQuerySchema } from './ratings.schemas.js';
import { createRating,
  listMyRatingsClient, listMyRatingsStylist, listRatingsByStylistId,
  getRatingById, updateRating, deleteRating } from './ratings.controller.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';

const router = Router();

router.use(authenticate);

/** Crear (cliente) */
router.post('/',
  requireRoles(ROLES.CLIENTE),
  validateBody(createRatingSchema),
  createRating
);

/** Mis calificaciones (cliente) */
router.get('/my',
  requireRoles(ROLES.CLIENTE),
  validateQuery(listRatingsQuerySchema),
  listMyRatingsClient
);

/** Mis calificaciones recibidas (estilista) */
router.get('/received',
  requireRoles(ROLES.ESTILISTA),
  validateQuery(listRatingsQuerySchema),
  listMyRatingsStylist
);

/** Calificaciones de un estilista específico (admin/gerente) */
router.get('/stylist/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateQuery(listRatingsQuerySchema),
  listRatingsByStylistId
);

/** Obtener / actualizar / eliminar por id */
router.get('/:id', getRatingById);

router.put('/:id',
  requireRoles(ROLES.CLIENTE, ROLES.ADMIN, ROLES.GERENTE),
  validateBody(updateRatingSchema),
  updateRating
);

router.delete('/:id',
  requireRoles(ROLES.CLIENTE, ROLES.ADMIN, ROLES.GERENTE),
  deleteRating
);

export default router;
