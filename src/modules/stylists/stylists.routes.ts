import { Router } from 'express'
import {
  listStylists,
  createStylist,
  updateStylistServices,
  listStylistCatalogs,          // 🆕
  listStylistCatalogServices    // 🆕
} from './stylists.controller.js'
import { authenticate } from '../../middlewares/auth.js'
import { requireRoles } from '../../middlewares/requireRole.js'
import { ROLES } from '../../constants/roles.js'
import { validateBody } from '../../middlewares/validate.js'
import { createStylistSchema, updateStylistServicesSchema } from './stylists.schemas.js'

const router = Router()

// Públicos (o protegidos si prefieres) – lista estilistas activos
router.get('/', listStylists)

// 🆕 Ver catálogos de un estilista
router.get('/:id/catalogs', listStylistCatalogs)

// 🆕 Ver servicios de un catálogo específico de ese estilista
router.get('/:id/catalogs/:catalogId/services', listStylistCatalogServices)

// A partir de aquí, protegidos
router.use(authenticate)

// Crear estilista: solo ADMIN o GERENTE
router.post('/',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(createStylistSchema),
  createStylist
)

// Actualizar catálogos (y servicesOffered derivados):
// - ADMIN/GERENTE: cualquier estilista
// - ESTILISTA: solo su propio ID (se valida en el controller)
router.put('/:id/services',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE, ROLES.ESTILISTA),
  validateBody(updateStylistServicesSchema),
  updateStylistServices
)

export default router
