import { Router } from 'express';
import { register, login, me } from '../controllers/auth-controller.js';
import { authMiddleware } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

const router = Router();

// Define a stricter rate limiter for sign-up and login routes
const authRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 10, // limit each IP to 10 auth attempts per 15 mins
  message: { error: 'Too many authentication attempts from this IP. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/register', authRateLimiter, register);
router.post('/login', authRateLimiter, login);
router.get('/me', authMiddleware, me);

export default router;
