import { Router } from 'express';
import { getMyProfile, getPublicProfile, updateMyProfile } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, getMyProfile);
router.patch('/me', requireAuth, updateMyProfile);
router.get('/:userId', getPublicProfile);

export default router;
