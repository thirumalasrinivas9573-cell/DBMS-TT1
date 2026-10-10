const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    system: 'Smart, Connected Multi-Library Book Tracking & Discovery System'
  });
});

// Mount modular API routes per Section 12
const authRoutes = require('./routes/auth');
const booksRoutes = require('./routes/books');
const librariesRoutes = require('./routes/libraries');
const scanRoutes = require('./routes/scan');
const copiesRoutes = require('./routes/copies');
const transactionsRoutes = require('./routes/transactions');
const transfersRoutes = require('./routes/transfers');
const alertsRoutes = require('./routes/alerts');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');
const reportsRoutes = require('./routes/reports');

app.use('/api/auth', authRoutes);
app.use('/api/books', booksRoutes);
app.use('/api/libraries', librariesRoutes);
app.use('/api/scan', scanRoutes);
app.use('/api/copies', copiesRoutes);
app.use('/api/transactions', transactionsRoutes);
app.use('/api/transfers', transfersRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportsRoutes);

// Direct alias for /api/me/transactions per section 12
app.get('/api/me/transactions', (req, res, next) => {
  req.url = '/me/transactions';
  return transactionsRoutes(req, res, next);
});

const path = require('path');

// Serve static frontend assets
app.use(express.static(path.join(__dirname, '../frontend')));

// 404 handler for API routes
app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.originalUrl}`
  });
});

// SPA fallback for frontend client-side routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Library Tracking & Discovery System Backend Active`);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(` Database: ${process.env.DB_CLIENT || 'mysql'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
