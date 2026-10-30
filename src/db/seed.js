// Populates realistic DEMO DATA (spec §27). Safe to re-run: it clears
// application tables (not schema) before inserting.
// Usage: npm run seed
import { pool, query } from '../config/db.js';
import { hashPassword } from '../utils/password.js';

const DEMO_PASSWORD = 'Demo@1234';

async function clear() {
  await query(`
    TRUNCATE commodity_listings, verification_records, business_profiles, farmer_profiles,
             auth_tokens, audit_logs, commodity_varieties, commodities, commodity_categories,
             districts, states, users
    RESTART IDENTITY CASCADE
  `);
}

async function seedLocations() {
  const states = ['Telangana', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Punjab'];
  const stateIds = {};
  for (const name of states) {
    const r = await query(`INSERT INTO states (name) VALUES ($1) RETURNING id`, [name]);
    stateIds[name] = r.rows[0].id;
  }
  const districts = {
    Telangana: ['Hyderabad', 'Warangal', 'Nizamabad'],
    'Andhra Pradesh': ['Guntur', 'Krishna', 'Kurnool'],
    Karnataka: ['Bengaluru Rural', 'Belagavi'],
    Maharashtra: ['Nashik', 'Pune'],
    Punjab: ['Ludhiana', 'Amritsar'],
  };
  const districtIds = {};
  for (const [state, list] of Object.entries(districts)) {
    for (const name of list) {
      const r = await query(`INSERT INTO districts (state_id, name) VALUES ($1,$2) RETURNING id`, [stateIds[state], name]);
      districtIds[name] = r.rows[0].id;
    }
  }
  return { stateIds, districtIds };
}

async function seedCommodities() {
  const categories = {
    Cereals: ['Rice', 'Wheat', 'Maize'],
    Vegetables: ['Tomato', 'Onion', 'Potato'],
    Spices: ['Chilli', 'Turmeric'],
    'Fiber Crops': ['Cotton'],
    Pulses: ['Soybean', 'Chickpea'],
  };
  const commodityIds = {};
  for (const [cat, items] of Object.entries(categories)) {
    const catRow = await query(`INSERT INTO commodity_categories (name) VALUES ($1) RETURNING id`, [cat]);
    for (const item of items) {
      const unit = item === 'Cotton' ? 'bale' : 'MT';
      const r = await query(
        `INSERT INTO commodities (category_id, name, default_unit) VALUES ($1,$2,$3) RETURNING id`,
        [catRow.rows[0].id, item, unit]
      );
      commodityIds[item] = r.rows[0].id;
    }
  }
  const varieties = {
    Tomato: ['Hybrid', 'Desi'],
    Rice: ['Basmati 1121', 'Sona Masoori'],
    Chilli: ['Teja', 'Byadgi'],
    Cotton: ['Shankar-6'],
  };
  const varietyIds = {};
  for (const [commodity, list] of Object.entries(varieties)) {
    varietyIds[commodity] = {};
    for (const v of list) {
      const r = await query(
        `INSERT INTO commodity_varieties (commodity_id, name) VALUES ($1,$2) RETURNING id`,
        [commodityIds[commodity], v]
      );
      varietyIds[commodity][v] = r.rows[0].id;
    }
  }
  return { commodityIds, varietyIds };
}

async function seedUsers(stateIds, districtIds) {
  const pwHash = await hashPassword(DEMO_PASSWORD);
  const users = [];

  async function createUser({ name, email, role, businessOrFarmName, businessType, state, district, verified }) {
    const u = await query(
      `INSERT INTO users (name, email, password_hash, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role`,
      [name, email, pwHash, role]
    );
    const user = u.rows[0];
    if (role === 'farmer') {
      await query(
        `INSERT INTO farmer_profiles (user_id, farm_name, state_id, district_id, production_capacity_mt, verification_status, rating_avg, rating_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [user.id, businessOrFarmName, stateIds[state], districtIds[district], 50, verified ? 'verified' : 'pending', 4.2, 18]
      );
    } else if (role === 'supplier' || role === 'buyer') {
      await query(
        `INSERT INTO business_profiles (user_id, business_name, business_type, state_id, district_id, annual_trading_capacity_mt, verification_status, rating_avg, rating_count)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [user.id, businessOrFarmName, businessType, stateIds[state], districtIds[district], 500, verified ? 'verified' : 'pending', 4.5, 32]
      );
    }
    users.push(user);
    return user;
  }

  const farmer1 = await createUser({ name: 'Ramesh Reddy', email: 'farmer1@udant.demo', role: 'farmer', businessOrFarmName: 'Reddy Farms', state: 'Telangana', district: 'Warangal', verified: true });
  const farmer2 = await createUser({ name: 'Lakshmi Devi', email: 'farmer2@udant.demo', role: 'farmer', businessOrFarmName: 'Devi Agro', state: 'Andhra Pradesh', district: 'Guntur', verified: false });
  const supplier1 = await createUser({ name: 'Venkatesh Traders', email: 'supplier1@udant.demo', role: 'supplier', businessOrFarmName: 'Venkatesh Agro Traders', businessType: 'trader', state: 'Telangana', district: 'Hyderabad', verified: true });
  const buyer1 = await createUser({ name: 'FreshMart Wholesale', email: 'buyer1@udant.demo', role: 'buyer', businessOrFarmName: 'FreshMart Wholesale Pvt Ltd', businessType: 'wholesaler', state: 'Karnataka', district: 'Bengaluru Rural', verified: true });
  await createUser({ name: 'Udant Admin', email: 'admin@udant.demo', role: 'admin', businessOrFarmName: null, state: 'Telangana', district: 'Hyderabad', verified: true });
  await createUser({ name: 'Speedy Logistics', email: 'logistics1@udant.demo', role: 'logistics_provider', businessOrFarmName: null, state: 'Telangana', district: 'Hyderabad', verified: true });

  return { farmer1, farmer2, supplier1, buyer1 };
}

async function seedListings({ stateIds, districtIds }, { commodityIds, varietyIds }, { farmer1, farmer2, supplier1 }) {
  const listings = [
    {
      seller: farmer1.id, commodity: 'Tomato', variety: 'Hybrid', grade: 'A', quantity: 10, unit: 'MT',
      price: 22, priceUnit: 'per_kg', priceType: 'negotiable', state: 'Telangana', district: 'Hyderabad',
      availableFrom: '2026-09-20', description: 'Farm-fresh hybrid tomatoes, harvested weekly.',
    },
    {
      seller: farmer1.id, commodity: 'Chilli', variety: 'Teja', grade: 'A', quantity: 15, unit: 'MT',
      price: 185, priceUnit: 'per_kg', priceType: 'negotiable', state: 'Telangana', district: 'Warangal',
      availableFrom: '2026-09-25', description: 'High-pungency Teja chilli, sun-dried.',
    },
    {
      seller: farmer2.id, commodity: 'Onion', grade: 'B', quantity: 25, unit: 'MT',
      price: 18, priceUnit: 'per_kg', priceType: 'fixed', state: 'Andhra Pradesh', district: 'Guntur',
      availableFrom: '2026-09-18', description: 'Medium-size onions, good storage quality.',
    },
    {
      seller: supplier1.id, commodity: 'Rice', variety: 'Sona Masoori', grade: 'Premium', quantity: 100, unit: 'MT',
      price: 42, priceUnit: 'per_kg', priceType: 'negotiable', state: 'Telangana', district: 'Nizamabad',
      availableFrom: '2026-10-01', description: 'Bulk Sona Masoori rice, mill-direct.',
    },
    {
      seller: supplier1.id, commodity: 'Cotton', variety: 'Shankar-6', grade: 'A', quantity: 50, unit: 'bale',
      price: 7200, priceUnit: 'per_bale', priceType: 'negotiable', state: 'Telangana', district: 'Hyderabad',
      availableFrom: '2026-11-01', description: 'Machine-picked Shankar-6 cotton bales.',
    },
    {
      seller: farmer2.id, commodity: 'Turmeric', grade: 'A', quantity: 8, unit: 'MT',
      price: 145, priceUnit: 'per_kg', priceType: 'negotiable', state: 'Andhra Pradesh', district: 'Guntur',
      availableFrom: '2026-09-30', description: 'High-curcumin turmeric fingers.',
    },
  ];

  for (const l of listings) {
    await query(
      `INSERT INTO commodity_listings
        (seller_id, commodity_id, variety_id, grade, quantity, unit, price_amount, price_unit, price_type,
         state_id, district_id, available_from, description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        l.seller, commodityIds[l.commodity], l.variety ? varietyIds[l.commodity]?.[l.variety] : null,
        l.grade, l.quantity, l.unit, l.price, l.priceUnit, l.priceType,
        stateIds[l.state], districtIds[l.district], l.availableFrom, l.description,
      ]
    );
  }
}

async function run() {
  console.log('[seed] clearing existing data ...');
  await clear();
  console.log('[seed] seeding locations ...');
  const locations = await seedLocations();
  console.log('[seed] seeding commodities ...');
  const commodities = await seedCommodities();
  console.log('[seed] seeding demo users ...');
  const demoUsers = await seedUsers(locations.stateIds, locations.districtIds);
  console.log('[seed] seeding demo listings ...');
  await seedListings(locations, commodities, demoUsers);
  console.log('[seed] done.');
  console.log(`[seed] Demo login password for all demo accounts: ${DEMO_PASSWORD}`);
  console.log('[seed] Demo accounts: farmer1@udant.demo, farmer2@udant.demo, supplier1@udant.demo, buyer1@udant.demo, admin@udant.demo, logistics1@udant.demo');
  await pool.end();
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
