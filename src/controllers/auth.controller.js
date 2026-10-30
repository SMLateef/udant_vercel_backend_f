import { z } from 'zod';
import twilio from 'twilio';
import { query, withTransaction } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../middleware/errorHandler.js';

// Schemas for the new OTP flow
export const requestOtpSchema = z.object({
  phone: z.string().min(10).max(20),
  name: z.string().optional(),
});

export const verifyOtpSchema = z.object({
  phone: z.string().min(10).max(20),
  otp: z.string().length(6),
});

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    createdAt: row.created_at,
  };
}

// Generate a random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

export const requestOtp = asyncHandler(async (req, res) => {
  const { phone, name } = req.body;
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 10 * 60000); // 10 minutes

  const existingResult = await query(
    `SELECT id FROM users WHERE phone = $1 AND deleted_at IS NULL`,
    [phone]
  );

  if (existingResult.rowCount === 0) {
    // New user -> create account and farmer profile shell
    await withTransaction(async (client) => {
      const userResult = await client.query(
        `INSERT INTO users (name, phone, role, otp, otp_expires_at)
         VALUES ($1, $2, 'farmer', $3, $4)
         RETURNING id`,
        [name || 'New User', phone, otp, expiresAt]
      );
      const newUser = userResult.rows[0];

      await client.query(
        `INSERT INTO farmer_profiles (user_id) VALUES ($1)`,
        [newUser.id]
      );

      // Separated parameters: $1 for UUID (actor_id), $2 for TEXT (entity_id)
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata)
         VALUES ($1, 'user.registered', 'user', $2, $3)`,
        [newUser.id, newUser.id, JSON.stringify({ role: 'farmer', method: 'otp' })]
      );
    });
  } else {
    // Existing user -> update OTP and refresh name if provided
    if (name && name.trim()) {
      await query(
        `UPDATE users SET name = $1, otp = $2, otp_expires_at = $3 WHERE phone = $4`,
        [name.trim(), otp, expiresAt, phone]
      );
    } else {
      await query(
        `UPDATE users SET otp = $1, otp_expires_at = $2 WHERE phone = $3`,
        [otp, expiresAt, phone]
      );
    }
  }

  // --- SMS DELIVERY LOGIC ---
  // Format phone number for India if it doesn't already have a country code
  const formattedPhone = phone.startsWith('+') ? phone : `+91${phone}`;

  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    try {
      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
      await client.messages.create({
        body: `Your Udant B2B Agri login OTP is: ${otp}. Do not share this with anyone.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: formattedPhone,
      });
      console.log(`[SMS SUCCESS] OTP sent to real device: ${formattedPhone}`);
    } catch (smsError) {
      console.error(`[SMS ERROR] Failed to send to ${formattedPhone}:`, smsError.message);
      // Fallback to console if Twilio fails (e.g., trial restrictions)
      console.log(`YOUR FALLBACK OTP IS: ${otp}`);
    }
  } else {
    // Development Mode Fallback
    console.log(`\n=======================`);
    console.log(`MOCK SMS TO: ${formattedPhone}`);
    console.log(`YOUR OTP IS: ${otp}`);
    console.log(`=======================\n`);
  }

  res.json({ message: 'OTP sent successfully' });
});

export const verifyOtp = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;

  const result = await query(
    `SELECT * FROM users WHERE phone = $1 AND deleted_at IS NULL`,
    [phone]
  );
  const user = result.rows[0];

  if (!user || !user.is_active) {
    throw new ApiError(401, 'User not found or inactive');
  }

  if (user.otp !== otp || new Date() > new Date(user.otp_expires_at)) {
    throw new ApiError(401, 'Invalid or expired OTP');
  }

  // OTP valid: Clear the OTP, update login time, log the action, and sign token
  await query(
    `UPDATE users SET otp = NULL, otp_expires_at = NULL, last_login_at = now() WHERE id = $1`,
    [user.id]
  );

  // Separated parameters: $1 for UUID (actor_id), $2 for TEXT (entity_id)
  await query(
    `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'user.login', 'user', $2)`,
    [user.id, user.id]
  );

  const token = signToken({ sub: user.id, role: user.role });
  res.json({ user: toPublicUser(user), token });
});

export const me = asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT id, name, email, phone, role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [req.user.id]
  );
  if (result.rowCount === 0) throw new ApiError(404, 'User not found');
  res.json({ user: toPublicUser(result.rows[0]) });
});