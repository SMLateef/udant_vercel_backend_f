import { Router } from 'express';
import {
  searchListings, getListing, createListing, updateListingStatus, createListingSchema,
} from '../controllers/listing.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

const router = Router();

router.get('/', searchListings);
router.get('/:id', getListing);
router.post('/', requireAuth, validateBody(createListingSchema), createListing);
router.patch('/:id/status', requireAuth, updateListingStatus);

export default router;
