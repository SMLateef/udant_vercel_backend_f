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
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

dotenv.config();

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.use('/auth', authRoutes);
app.use('/commodities', commodityRoutes);
app.use('/listings', listingRoutes);
app.use('/profiles', profileRoutes);
app.use('/locations', locationRoutes);

// Phase 2+ routes to be added here: /rfqs, /offers, /orders, /shipments, /prices, /dashboard, /messages, /notifications

app.use(notFoundHandler);
app.use(errorHandler);
