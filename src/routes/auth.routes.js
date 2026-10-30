import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requestOtp, verifyOtp, me, requestOtpSchema, verifyOtpSchema } from '../controllers/auth.controller.js';
import { validateBody } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Tighter rate limit on auth endpoints to slow down credential stuffing / brute force.
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 30 });

router.post('/request-otp', authLimiter, validateBody(requestOtpSchema), requestOtp);
router.post('/verify-otp', authLimiter, validateBody(verifyOtpSchema), verifyOtp);
router.get('/me', requireAuth, me);

export default router;