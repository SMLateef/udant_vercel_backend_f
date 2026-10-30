import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listCommodities = asyncHandler(async (req, res) => {
  const result = await query(`
    SELECT c.id, c.name, c.default_unit, cat.name AS category
    FROM commodities c
    JOIN commodity_categories cat ON cat.id = c.category_id
    ORDER BY cat.name, c.name
  `);
  res.json({ commodities: result.rows });
});

export const getCommodityVarieties = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name FROM commodity_varieties WHERE commodity_id = $1 ORDER BY name`,
    [req.params.id]
  );
  res.json({ varieties: result.rows });
});
