import { describe, it, expect } from 'vitest';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

describe('Express Trust Proxy & Rate Limiter Integration', () => {
  it('configures trustProxy with default value 1', () => {
    expect(config.trustProxy).toBeDefined();
    expect(config.trustProxy).toEqual(1);
  });

  it('correctly reads client IP from X-Forwarded-For when trust proxy is enabled', async () => {
    const app = express();
    app.set('trust proxy', config.trustProxy);

    let recordedIp = null;
    app.get('/test-ip', (req, res) => {
      recordedIp = req.ip;
      res.json({ ip: req.ip });
    });

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const clientIp = '203.0.113.195';
      const response = await fetch(`http://127.0.0.1:${port}/test-ip`, {
        headers: {
          'X-Forwarded-For': clientIp
        }
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.ip).toBe(clientIp);
      expect(recordedIp).toBe(clientIp);
    } finally {
      server.close();
    }
  });

  it('allows express-rate-limit to process X-Forwarded-For requests without throwing ERR_ERL_UNEXPECTED_X_FORWARDED_FOR', async () => {
    const app = express();
    app.set('trust proxy', config.trustProxy);

    const limiter = rateLimit({
      windowMs: 60000,
      max: 2,
      standardHeaders: true,
      legacyHeaders: false
    });

    app.use('/api', limiter);
    app.get('/api/resource', (req, res) => {
      res.json({ success: true, ip: req.ip });
    });

    const server = app.listen(0);
    const { port } = server.address();

    try {
      const userA = '198.51.100.1';
      const userB = '198.51.100.2';

      // User A request 1 -> OK
      const resA1 = await fetch(`http://127.0.0.1:${port}/api/resource`, {
        headers: { 'X-Forwarded-For': userA }
      });
      expect(resA1.status).toBe(200);

      // User A request 2 -> OK
      const resA2 = await fetch(`http://127.0.0.1:${port}/api/resource`, {
        headers: { 'X-Forwarded-For': userA }
      });
      expect(resA2.status).toBe(200);

      // User A request 3 -> Rate limited (429)
      const resA3 = await fetch(`http://127.0.0.1:${port}/api/resource`, {
        headers: { 'X-Forwarded-For': userA }
      });
      expect(resA3.status).toBe(429);

      // User B request 1 -> Still OK (rate limit is isolated per client IP)
      const resB1 = await fetch(`http://127.0.0.1:${port}/api/resource`, {
        headers: { 'X-Forwarded-For': userB }
      });
      expect(resB1.status).toBe(200);
    } finally {
      server.close();
    }
  });
});
