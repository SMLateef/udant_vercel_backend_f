import { z } from 'zod';
import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

export const createListingSchema = z.object({
  commodityId: z.number().int(),
  varietyId: z.number().int().optional(),
  grade: z.string().max(20).optional(),
  quantity: z.number().positive(),
  unit: z.string().max(20).default('MT'),
  minOrderQuantity: z.number().positive().optional(),
  priceAmount: z.number().nonnegative(),
  priceUnit: z.string().max(20).default('per_kg'),
  priceType: z.enum(['fixed', 'negotiable', 'per_unit_market_linked']).default('negotiable'),
  stateId: z.number().int(),
  districtId: z.number().int().optional(),
  availableFrom: z.string().optional(), // ISO date
  qualityParameters: z.record(z.any()).optional(),
  description: z.string().max(2000).optional(),
  images: z.array(z.string().url()).max(8).optional(),
});

const searchQuerySchema = z.object({
  commodityId: z.coerce.number().int().optional(),
  stateId: z.coerce.number().int().optional(),
  districtId: z.coerce.number().int().optional(),
  grade: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  minQuantity: z.coerce.number().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
  q: z.string().optional(), // free text over commodity/variety/description
  sort: z.enum(['price_asc', 'price_desc', 'newest', 'quantity_desc', 'rating_desc']).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export { searchQuerySchema };

const SORT_MAP = {
  price_asc: 'l.price_amount ASC',
  price_desc: 'l.price_amount DESC',
  newest: 'l.created_at DESC',
  quantity_desc: 'l.quantity DESC',
  rating_desc: 'seller_rating DESC NULLS LAST',
};

/**
 * GET /listings — the core marketplace search endpoint (spec §5, §6).
 * Builds a parameterized query dynamically; never string-concatenates
 * user input into SQL.
 */
export const searchListings = asyncHandler(async (req, res) => {
  const params = searchQuerySchema.parse(req.query);
  const where = [`l.deleted_at IS NULL`, `l.status = 'active'`];
  const values = [];

  function addFilter(clause, value) {
    values.push(value);
    where.push(clause.replace('?', `$${values.length}`));
  }

  if (params.commodityId) addFilter('l.commodity_id = ?', params.commodityId);
  if (params.stateId) addFilter('l.state_id = ?', params.stateId);
  if (params.districtId) addFilter('l.district_id = ?', params.districtId);
  if (params.grade) addFilter('l.grade = ?', params.grade);
  if (params.minPrice != null) addFilter('l.price_amount >= ?', params.minPrice);
  if (params.maxPrice != null) addFilter('l.price_amount <= ?', params.maxPrice);
  if (params.minQuantity != null) addFilter('l.quantity >= ?', params.minQuantity);
  if (params.q) {
    const like = `%${params.q}%`;
    values.push(like, like, like);
    const i1 = values.length - 2, i2 = values.length - 1, i3 = values.length;
    where.push(`(c.name ILIKE $${i1} OR v.name ILIKE $${i2} OR l.description ILIKE $${i3})`);
  }
  if (params.verifiedOnly) {
    where.push(`(seller_verification = 'verified')`);
  }

  const offset = (params.page - 1) * params.pageSize;

  const sql = `
    SELECT
      l.id, l.commodity_id, c.name AS commodity_name,
      l.variety_id, v.name AS variety_name,
      l.grade, l.quantity, l.unit, l.min_order_quantity,
      l.price_amount, l.price_unit, l.price_type,
      l.state_id, s.name AS state_name,
      l.district_id, d.name AS district_name,
      l.available_from, l.quality_parameters, l.description, l.images,
      l.status, l.created_at,
      l.seller_id,
      u.name AS seller_name,
      COALESCE(fp.verification_status, bp.verification_status, 'unverified') AS seller_verification,
      COALESCE(fp.rating_avg, bp.rating_avg, 0) AS seller_rating
    FROM commodity_listings l
    JOIN commodities c ON c.id = l.commodity_id
    LEFT JOIN commodity_varieties v ON v.id = l.variety_id
    JOIN states s ON s.id = l.state_id
    LEFT JOIN districts d ON d.id = l.district_id
    JOIN users u ON u.id = l.seller_id
    LEFT JOIN farmer_profiles fp ON fp.user_id = u.id
    LEFT JOIN business_profiles bp ON bp.user_id = u.id
    WHERE ${where.join(' AND ')}
    ORDER BY ${SORT_MAP[params.sort]}
    LIMIT ${params.pageSize} OFFSET ${offset}
  `;

  const countSql = `
    SELECT COUNT(*)::int AS total
    FROM commodity_listings l
    JOIN commodities c ON c.id = l.commodity_id
    LEFT JOIN commodity_varieties v ON v.id = l.variety_id
    LEFT JOIN farmer_profiles fp ON fp.user_id = l.seller_id
    LEFT JOIN business_profiles bp ON bp.user_id = l.seller_id
    WHERE ${where.join(' AND ')}
  `;

  const [rows, count] = await Promise.all([
    query(sql, values),
    query(countSql, values),
  ]);

  res.json({
    listings: rows.rows,
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total: count.rows[0].total,
      totalPages: Math.ceil(count.rows[0].total / params.pageSize),
    },
  });
});

export const getListing = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT l.*, c.name AS commodity_name, v.name AS variety_name,
            s.name AS state_name, d.name AS district_name,
            u.name AS seller_name, u.role AS seller_role
     FROM commodity_listings l
     JOIN commodities c ON c.id = l.commodity_id
     LEFT JOIN commodity_varieties v ON v.id = l.variety_id
     JOIN states s ON s.id = l.state_id
     LEFT JOIN districts d ON d.id = l.district_id
     JOIN users u ON u.id = l.seller_id
     WHERE l.id = $1 AND l.deleted_at IS NULL`,
    [req.params.id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Listing not found');
  res.json({ listing: result.rows[0] });
});

export const createListing = asyncHandler(async (req, res) => {
  if (!['farmer', 'supplier'].includes(req.user.role)) {
    throw new ApiError(403, 'Only farmers and suppliers can create listings');
  }
  const b = req.body;
  const result = await query(
    `INSERT INTO commodity_listings
      (seller_id, commodity_id, variety_id, grade, quantity, unit, min_order_quantity,
       price_amount, price_unit, price_type, state_id, district_id, available_from,
       quality_parameters, description, images)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
    [
      req.user.id, b.commodityId, b.varietyId || null, b.grade || null, b.quantity, b.unit,
      b.minOrderQuantity || null, b.priceAmount, b.priceUnit, b.priceType, b.stateId,
      b.districtId || null, b.availableFrom || null, b.qualityParameters || null,
      b.description || null, b.images || null,
    ]
  );
  await query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1,'listing.created','listing',$2)`,
    [req.user.id, result.rows[0].id]
  );
  res.status(201).json({ listing: result.rows[0] });
});

export const updateListingStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;
  const allowed = ['active', 'paused', 'sold_out', 'expired', 'removed'];
  if (!allowed.includes(status)) throw new ApiError(400, 'Invalid status');

  const existing = await query(`SELECT seller_id FROM commodity_listings WHERE id = $1 AND deleted_at IS NULL`, [req.params.id]);
  if (existing.rowCount === 0) throw new ApiError(404, 'Listing not found');
  if (existing.rows[0].seller_id !== req.user.id && req.user.role !== 'admin') {
    throw new ApiError(403, 'You can only modify your own listings');
  }

  const result = await query(
    `UPDATE commodity_listings SET status = $1 WHERE id = $2 RETURNING *`,
    [status, req.params.id]
  );
  res.json({ listing: result.rows[0] });
});
