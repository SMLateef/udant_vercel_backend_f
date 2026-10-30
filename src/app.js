import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.routes.js';
import commodityRoutes from './routes/commodity.routes.js';
import listingRoutes from './routes/listing.routes.js';
import profileRoutes from './routes/profile.routes.js';
import locationRoutes from './routes/location.routes.js';

import {
  notFoundHandler,
  errorHandler
} from './middleware/errorHandler.js';

dotenv.config();

export const app = express();

// ================================
// MIDDLEWARE
// ================================

app.use(helmet());

app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

app.use(morgan(
  process.env.NODE_ENV === 'production' ? 'combined' : 'dev'
));

// ================================
// ROOT ROUTE
// ================================

app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Udant API is running successfully 🚀'
  });
});

// ================================
// HEALTH CHECK
// ================================

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'udant-api',
    timestamp: new Date().toISOString()
  });
});

// ================================
// API ROUTES
// ================================

app.use('/auth', authRoutes);

app.use('/commodities', commodityRoutes);

app.use('/listings', listingRoutes);

app.use('/profiles', profileRoutes);

app.use('/locations', locationRoutes);

// Future routes:
// /rfqs
// /offers
// /orders
// /shipments
// /prices
// /dashboard
// /messages
// /notifications

// ================================
// ERROR HANDLING
// Keep these at the bottom
// ================================

app.use(notFoundHandler);

app.use(errorHandler);

export default app;