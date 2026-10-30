import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// Fields considered sensitive enough to withhold from public profile views (spec §4).
function sanitizeBusinessProfile(row, isOwnerOrAdmin) {
  if (!row) return null;
  const { gstin, pan, ...rest } = row;
  return isOwnerOrAdmin ? row : rest;
}

export const getMyProfile = asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  if (role === 'farmer') {
    const result = await query(`SELECT * FROM farmer_profiles WHERE user_id = $1`, [id]);
    return res.json({ profile: result.rows[0] || null });
  }
  if (role === 'supplier' || role === 'buyer') {
    const result = await query(`SELECT * FROM business_profiles WHERE user_id = $1`, [id]);
    return res.json({ profile: result.rows[0] || null });
  }
  return res.json({ profile: null });
});

export const getPublicProfile = asyncHandler(async (req, res) => {
  const userResult = await query(`SELECT id, name, role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL`, [req.params.userId]);
  if (userResult.rowCount === 0) throw new ApiError(404, 'User not found');
  const user = userResult.rows[0];

  let profile = null;
  if (user.role === 'farmer') {
    const r = await query(`SELECT farm_name, state_id, district_id, production_capacity_mt, certifications, verification_status, rating_avg, rating_count FROM farmer_profiles WHERE user_id = $1`, [user.id]);
    profile = r.rows[0] || null;
  } else if (user.role === 'supplier' || user.role === 'buyer') {
    const r = await query(`SELECT business_name, business_type, state_id, district_id, annual_trading_capacity_mt, certifications, verification_status, rating_avg, rating_count FROM business_profiles WHERE user_id = $1`, [user.id]);
    profile = sanitizeBusinessProfile(r.rows[0], false);
  }

  res.json({ user, profile });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const { role, id } = req.user;
  const allowedFields = role === 'farmer'
    ? ['farm_name', 'state_id', 'district_id', 'address', 'farm_size_acres', 'production_capacity_mt', 'certifications']
    : ['business_name', 'business_type', 'gstin', 'pan', 'address', 'state_id', 'district_id', 'annual_trading_capacity_mt', 'certifications'];

  const table = role === 'farmer' ? 'farmer_profiles' : 'business_profiles';
  const updates = Object.keys(req.body).filter((k) => allowedFields.includes(k));
  if (updates.length === 0) throw new ApiError(400, 'No valid fields to update');

  const setClause = updates.map((k, i) => `${k} = $${i + 2}`).join(', ');
  const values = updates.map((k) => req.body[k]);

  const result = await query(
    `UPDATE ${table} SET ${setClause} WHERE user_id = $1 RETURNING *`,
    [id, ...values]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'Profile not found');
  res.json({ profile: result.rows[0] });
});
