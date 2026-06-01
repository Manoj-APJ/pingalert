import { Router } from 'express';
import {
  createStatusPage,
  listStatusPages,
  getStatusPage,
  updateStatusPage,
  deleteStatusPage,
  getPublicStatusPage
} from '../controllers/status-page-controller.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const router = Router();

// Public endpoint rate limiting to avoid scraper flooding
const publicStatusLimiter = rateLimit({
  windowMs: 60000, // 1 minute
  max: 60, // max 60 requests/minute per IP
  message: { error: 'Too many requests on this status page. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Public slug route (unauthenticated)
router.get('/public/:slug', publicStatusLimiter, getPublicStatusPage);

// Protected routes (require user login)
router.post('/', authMiddleware, createStatusPage);
router.get('/', authMiddleware, listStatusPages);
router.get('/:id', authMiddleware, getStatusPage);
router.put('/:id', authMiddleware, updateStatusPage);
router.delete('/:id', authMiddleware, deleteStatusPage);

export default router;
