import { Router } from 'express';
import { listCommodities, getCommodityVarieties } from '../controllers/commodity.controller.js';

const router = Router();

router.get('/', listCommodities);
router.get('/:id/varieties', getCommodityVarieties);

export default router;
