import { Router } from 'express';
import { validateBody } from '../../middlewares/validate.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';
import { registerClientSchema, loginSchema, refreshSchema, googleSignInSchema, forgotPasswordSchema, resetPasswordSchema } from './auth.schemas.js';
import { register, login, refresh, logout, googleSignIn, forgotPassword, resetPassword} from './auth.controller.js';
import { authenticate } from '../../middlewares/auth.js';

import { resendVerification, verifyEmailLink, verifyEmailJSON } from './auth.controller.js';

import { resendVerificationSchema, verifyEmailSchema } from './auth.schemas.js';
import { sendVerificationEmail } from './auth.controller.js';

import Joi from 'joi';

const sendVerificationSchema = Joi.object({
  email: Joi.string().email().required()
});


const router = Router();
router.use(authLimiter);

router.post('/register', validateBody(registerClientSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/refresh', validateBody(refreshSchema), refresh);
router.post('/logout', authenticate, logout);
router.post('/google', validateBody(googleSignInSchema), googleSignIn);


router.post('/forgot-password', validateBody(forgotPasswordSchema), forgotPassword);
router.post('/reset-password', validateBody(resetPasswordSchema), resetPassword);

router.post('/send-verification-email',validateBody(sendVerificationSchema),sendVerificationEmail);


router.post('/resend-verification', authenticate, validateBody(resendVerificationSchema), resendVerification);

// 2) Verificar por LINK (para correos)
router.get('/verify-email', verifyEmailLink);

// 3) Verificar por JSON (para Postman / apps móviles)
router.post('/verify-email', validateBody(verifyEmailSchema), verifyEmailJSON);

export default router;
