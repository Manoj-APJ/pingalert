import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import { config } from './server/config/index.js';
import { connectWithRetry, runMigrations } from './server/db/index.js';
import authRoutes from './server/routes/auth.js';
import monitorRoutes from './server/routes/monitors.js';
import statusPageRoutes from './server/routes/status-pages.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Set up cross-origin sharing & parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply general API rate limits
const globalApiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMaxReq,
  message: { error: 'Too many requests. Please slow down and try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', globalApiLimiter);

// Bind Modular API routes
app.use('/api/auth', authRoutes);
app.use('/api/monitors', monitorRoutes);
app.use('/api/status-pages', statusPageRoutes);

// Host compiled production frontend files
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Direct non-API HTTP requests to the single-page application entry HTML
app.get('*', (req, res) => {
  if (req.originalUrl.startsWith('/api')) {
    return res.status(404).json({ error: 'API endpoint not found.' });
  }
  res.sendFile(path.join(distPath, 'index.html'));
});

// Startup sequence
const init = async () => {
  try {
    // 1. Wait for database and apply SQL tables
    await connectWithRetry(10, 3000);
    await runMigrations();

    // 2. Open network listener
    app.listen(config.port, () => {
      console.log('===================================================');
      console.log(`   PingAlert Express API listening on port ${config.port}   `);
      console.log(`   Node Mode: ${config.nodeEnv}                        `);
      console.log('===================================================');
    });
  } catch (error) {
    console.error('[API Server] Fatal error during initialization:', error);
    process.exit(1);
  }
};

init();
