import { query } from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const listStates = asyncHandler(async (req, res) => {
  const result = await query(`SELECT id, name, code FROM states ORDER BY name`);
  res.json({ states: result.rows });
});

export const listDistricts = asyncHandler(async (req, res) => {
  const { stateId } = req.query;
  const result = await query(
    `SELECT id, state_id, name FROM districts WHERE state_id = $1 ORDER BY name`,
    [stateId]
  );
  res.json({ districts: result.rows });
});
