import { Router } from 'express';
import { listStates, listDistricts } from '../controllers/location.controller.js';

const router = Router();

router.get('/states', listStates);
router.get('/districts', listDistricts);

export default router;
