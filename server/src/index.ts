import express from 'express';
import cors from 'cors';
import path from 'path';
import './db/database'; // initialize DB on startup

import dashboardRouter from './routes/dashboard';
import deliveriesRouter from './routes/deliveries';
import packagesRouter from './routes/packages';
import inventoryRouter from './routes/inventory';
import discrepanciesRouter from './routes/discrepancies';
import settingsRouter from './routes/settings';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

// API Routes
app.use('/api/dashboard', dashboardRouter);
app.use('/api/deliveries', deliveriesRouter);
app.use('/api/packages', packagesRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/discrepancies', discrepanciesRouter);
app.use('/api/settings', settingsRouter);

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`\n🚀 Warenannahme Server läuft auf http://localhost:${PORT}`);
  console.log(`📦 API verfügbar unter http://localhost:${PORT}/api\n`);
});
