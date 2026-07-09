import dotenv from 'dotenv';
dotenv.config();

const nodeEnv = process.env.NODE_ENV || 'development';
const jwtSecret = process.env.JWT_SECRET;

if (nodeEnv === 'production' && !jwtSecret) {
  console.error('CRITICAL ERROR: JWT_SECRET environment variable is missing.');
  console.error('Application refuses to start in production without a secure secret. Exiting.');
  process.exit(1);
}

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv,
  jwtSecret: jwtSecret || 'pingalert-dev-secret-key-123456789',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/pingalert',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  rateLimitMaxReq: parseInt(process.env.RATE_LIMIT_MAX_REQ || '1000', 10),
  pingRetryCount: parseInt(process.env.PING_RETRY_COUNT || '3', 10),
  pingRetryDelaySec: parseInt(process.env.PING_RETRY_DELAY_SEC || '5', 10),
  pingConcurrency: parseInt(process.env.PING_CONCURRENCY || '50', 10),
  alertConcurrency: parseInt(process.env.ALERT_CONCURRENCY || '10', 10),
  dbPoolSize: parseInt(process.env.DB_POOL_SIZE || '70', 10),
  smtp: {
    host: process.env.SMTP_HOST || null,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || null,
    pass: process.env.SMTP_PASS || null,
    from: process.env.SMTP_FROM || 'alerts@pingalert.com'
  }
};
