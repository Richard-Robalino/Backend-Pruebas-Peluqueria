import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { requireRoles } from '../../middlewares/requireRole.js';
import { ROLES } from '../../constants/roles.js';
import { validateQuery } from '../../middlewares/validate.js';

import {
  summaryReports,
  revenueReport,
  stylistRevenueReport,
  downloadReportsPdf
} from './reports.controller.js';
import { reportsRangeQuery } from './reports.schemas.js';

const router = Router();

// Solo ADMIN y GERENTE pueden ver reportes
router.use(authenticate, requireRoles(ROLES.ADMIN, ROLES.GERENTE));

// Resumen completo (JSON)
router.get('/summary', validateQuery(reportsRangeQuery), summaryReports);

// Ingresos del local (JSON)
router.get('/revenue', validateQuery(reportsRangeQuery), revenueReport);

// Ingresos por estilista (JSON)
router.get('/stylists-revenue', validateQuery(reportsRangeQuery), stylistRevenueReport);

// Reporte PDF profesional
router.get('/pdf', validateQuery(reportsRangeQuery), downloadReportsPdf);

export default router;
