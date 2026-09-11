import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('dns/promises', () => ({
  default: {
    lookup: vi.fn(),
  },
}));

import dns from 'dns/promises';
import { performPing } from '../monitor-service.js';

describe('B1 — performPing Latency Stopwatch & DNS Pre-Resolution', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('measures only HTTP request duration and excludes slow DNS pre-resolution time', async () => {
    // Mock slow DNS lookup: takes 200ms
    dns.lookup.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return [{ address: '93.184.216.34', family: 4 }];
    });

    // Mock fast HTTP fetch: takes 10ms
    globalThis.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { status: 200 };
    });

    const monitor = {
      url: 'https://example.com',
      timeout_seconds: 5,
    };

    const result = await performPing(monitor);

    expect(result.isUp).toBe(true);
    expect(result.statusCode).toBe(200);

    // If DNS time (200ms) were included, responseTimeMs would be >= 210ms.
    // Because the timer starts AFTER DNS resolution, responseTimeMs should reflect only the ~10ms fetch.
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(5);
    expect(result.responseTimeMs).toBeLessThan(50);
  });

  it('measures elapsed time on HTTP failure without crashing', async () => {
    dns.lookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

    globalThis.fetch = vi.fn().mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 15));
      throw new Error('Connection reset by peer');
    });

    const monitor = {
      url: 'https://example.com',
      timeout_seconds: 5,
    };

    const result = await performPing(monitor);

    expect(result.isUp).toBe(false);
    expect(result.cause).toBe('Connection reset by peer');
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(10);
    expect(result.responseTimeMs).toBeLessThan(100);
  });
});
