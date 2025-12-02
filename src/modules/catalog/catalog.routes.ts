import { Router } from 'express'
import { authenticate } from '../../middlewares/auth.js'
import { requireRoles } from '../../middlewares/requireRole.js'
import { ROLES } from '../../constants/roles.js'
import { validateBody, validateQuery } from '../../middlewares/validate.js'

import {
  createCategory, listCategories, getCategory, updateCategory, deleteCategory,
  replaceCategoryServices, addCategoryServices, removeCategoryServices, listCategoryServices,
  activateCategory, deactivateCategory
} from './catalog.controller.js'

import {
  createCategorySchema, updateCategorySchema, setCategoryServicesSchema,
  addRemoveServicesSchema, listCategoriesQuery
} from './catalog.schemas.js'

const router = Router()

// Públicos (si prefieres, puedes protegerlos)
router.get('/', validateQuery(listCategoriesQuery), listCategories)
router.get('/:id', getCategory)
router.get('/:id/services', listCategoryServices)

// Protegidos
router.use(authenticate)

router.post('/',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(createCategorySchema),
  createCategory
)

router.put('/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(updateCategorySchema),
  updateCategory
)

router.delete('/:id',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  deleteCategory
)

// Asociaciones de servicios
router.put('/:id/services',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(setCategoryServicesSchema),
  replaceCategoryServices
)

router.post('/:id/services/add',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(addRemoveServicesSchema),
  addCategoryServices
)

router.post('/:id/services/remove',
  requireRoles(ROLES.ADMIN, ROLES.GERENTE),
  validateBody(addRemoveServicesSchema),
  removeCategoryServices
)


router.patch('/:id/activate',  requireRoles(ROLES.ADMIN, ROLES.GERENTE), activateCategory);
router.patch('/:id/deactivate',requireRoles(ROLES.ADMIN, ROLES.GERENTE), deactivateCategory);

export default router
