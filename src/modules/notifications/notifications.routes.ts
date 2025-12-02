import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import { sendTestEmail } from './notifications.controller.js';

const router = Router();
router.use(authenticate);
router.post('/email', sendTestEmail);

export default router;
