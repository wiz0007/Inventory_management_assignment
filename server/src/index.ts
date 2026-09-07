import express from 'express';
import cors from 'cors';
import { config } from './config';
import { errorHandler } from './middleware/error';

import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.routes';
import { locationsRouter } from './routes/locations.routes';
import { categoriesRouter } from './routes/categories.routes';
import { itemsRouter } from './routes/items.routes';
import { movementsRouter } from './routes/movements.routes';
import { csvRouter } from './routes/csv.routes';
import { alertsRouter } from './routes/alerts.routes';

const app = express();

app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ type: ['text/csv', 'text/plain'], limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/locations', locationsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/items', itemsRouter);
app.use('/api/movements', movementsRouter);
app.use('/api/csv', csvRouter);
app.use('/api/alerts', alertsRouter);

// Global error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`🚀 Inventory Control Server running on http://localhost:${config.port}`);
});

export default app;
