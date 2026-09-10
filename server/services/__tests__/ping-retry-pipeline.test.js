import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------
const mockClient = {
  query: vi.fn(),
  release: vi.fn(),
};

vi.mock('../../db/index.js', () => ({
  pool: {
    connect: vi.fn(),
  },
  query: vi.fn(),
}));

// BullMQ Queue simulation that enforces jobId deduplication
const queueStore = new Map();

vi.mock('../../queue/index.js', () => ({
  pingQueueName: 'monitor-pings',
  alertQueueName: 'alerts',
  alertQueue: { add: vi.fn().mockResolvedValue({ id: 'alert-1' }) },
  pingQueue: {
    add: vi.fn().mockImplementation(async (name, data, opts) => {
      const jobId = opts?.jobId;
      if (jobId && queueStore.has(jobId)) {
        // BullMQ deduplication: returns null or existing job, does not enqueue a new job
        return null;
      }
      const job = { id: jobId || `auto-${Date.now()}`, name, data, opts };
      if (jobId) queueStore.set(jobId, job);
      return job;
    }),
    addBulk: vi.fn().mockImplementation(async (jobs) => {
      return jobs.map((j) => {
        const jobId = j.opts?.jobId;
        if (jobId && queueStore.has(jobId)) {
          return null;
        }
        const job = { id: jobId || `auto-${Date.now()}`, name: j.name, data: j.data, opts: j.opts };
        if (jobId) queueStore.set(jobId, job);
        return job;
      });
    }),
  },
}));

vi.mock('../../config/index.js', () => ({
  config: {
    pingRetryCount: 3,
    pingRetryDelaySec: 5,
  },
}));

import { handleCheckResult } from '../monitor-service.js';
import { createMonitor, updateMonitor } from '../../controllers/monitor-controller.js';
import { pool, query } from '../../db/index.js';
import { pingQueue } from '../../queue/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const makeMonitor = (overrides = {}) => ({
  id: 'monitor-uuid-123',
  user_id: 'user-uuid-1',
  name: 'Production API',
  url: 'https://api.example.com',
  status: 'up',
  interval_minutes: 5,
  timeout_seconds: 10,
  consecutive_failures: 0,
  last_status_change_at: null,
  ...overrides,
});

const transientFailure = {
  isUp: false,
  responseTimeMs: 0,
  statusCode: 0,
  cause: 'ECONNRESET',
};

const successCheck = {
  isUp: true,
  responseTimeMs: 145,
  statusCode: 200,
  cause: null,
};

describe('B2 & B3 Regression Tests — JobId Namespace, Defensive Checks & Outcome Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queueStore.clear();

    pool.connect.mockResolvedValue(mockClient);
    mockClient.query.mockImplementation(async (sql) => {
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor()] };
      }
      return { rowCount: 1, rows: [] };
    });
  });

  // -------------------------------------------------------------------------
  // TEST 1: Retry jobId namespace fix & coexistence with scheduled check
  // -------------------------------------------------------------------------
  it('enqueues retry jobs with distinct namespace "ping-retry-<id>-<attempt>", coexisting with scheduled job', async () => {
    const monitorId = 'monitor-uuid-123';
    
    // Simulate: A scheduled check "ping-<id>" is currently active in the queue
    queueStore.set(`ping-${monitorId}`, { id: `ping-${monitorId}`, name: 'ping-check' });

    // Handle check result on failure #1
    await handleCheckResult(monitorId, transientFailure);

    expect(pingQueue.add).toHaveBeenCalledTimes(1);
    const [jobName, jobData, jobOpts] = pingQueue.add.mock.calls[0];

    expect(jobName).toBe('ping-retry');
    expect(jobData).toEqual({ monitorId });
    // Distinct namespace includes monitorId and attempt number:
    expect(jobOpts.jobId).toBe(`ping-retry-${monitorId}-1`);

    // Proves coexistence: both scheduled check and retry job exist simultaneously in the queue
    expect(queueStore.has(`ping-${monitorId}`)).toBe(true);
    expect(queueStore.has(`ping-retry-${monitorId}-1`)).toBe(true);

    const addResult = await pingQueue.add.mock.results[0].value;
    expect(addResult).not.toBeNull();
    expect(addResult.id).toBe(`ping-retry-${monitorId}-1`);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Defensive null-check warning logging
  // -------------------------------------------------------------------------
  it('logs a descriptive warning with call site, monitorId, and jobId if pingQueue.add returns null', async () => {
    const monitorId = 'monitor-uuid-123';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Force pingQueue.add to return null (simulating BullMQ silent drop/deduplication)
    pingQueue.add.mockResolvedValueOnce(null);

    await handleCheckResult(monitorId, transientFailure);

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[Monitor Service: Retry]')
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(monitorId)
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(`ping-retry-${monitorId}-1`)
    );

    warnSpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // TEST 3: Outcome-based stats write (B3) — 2 failures then 1 success on retry
  // -------------------------------------------------------------------------
  it('only writes to hourly_stats on the final outcome: 2 failures then 1 success results in exactly 1 up_count', async () => {
    const monitorId = 'monitor-uuid-123';
    const statsQueries = [];

    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 0 })] };
      }
      return { rowCount: 1, rows: [] };
    });

    // Check 1: Failure 1 (transient)
    await handleCheckResult(monitorId, transientFailure);
    expect(statsQueries.length).toBe(0); // Mid-retry sequence: no stats write

    // Check 2: Failure 2 (transient)
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 1 })] };
      }
      return { rowCount: 1, rows: [] };
    });
    await handleCheckResult(monitorId, transientFailure);
    expect(statsQueries.length).toBe(0); // Mid-retry sequence: no stats write

    // Check 3: Success on retry
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 2 })] };
      }
      return { rowCount: 1, rows: [] };
    });
    await handleCheckResult(monitorId, successCheck);

    // Assert: Exactly ONE write occurred across the whole cycle, and it recorded an UP check
    expect(statsQueries.length).toBe(1);
    expect(statsQueries[0].sql).toContain('up_count = hourly_stats.up_count + 1');
  });

  // -------------------------------------------------------------------------
  // TEST 4: Outcome-based stats write (B3) — 3 failures (retries exhausted)
  // -------------------------------------------------------------------------
  it('only writes to hourly_stats when retries are exhausted: 3 failures result in exactly 1 down vote', async () => {
    const monitorId = 'monitor-uuid-123';
    const statsQueries = [];

    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 0 })] };
      }
      return { rowCount: 1, rows: [] };
    });

    // Check 1: Failure 1
    await handleCheckResult(monitorId, transientFailure);
    expect(statsQueries.length).toBe(0);

    // Check 2: Failure 2
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 1 })] };
      }
      return { rowCount: 1, rows: [] };
    });
    await handleCheckResult(monitorId, transientFailure);
    expect(statsQueries.length).toBe(0);

    // Check 3: Failure 3 (retries exhausted, 2 + 1 = 3 >= 3)
    mockClient.query.mockImplementation(async (sql, params) => {
      if (sql.includes('INSERT INTO hourly_stats')) {
        statsQueries.push({ sql, params });
      }
      if (sql.includes('SELECT * FROM monitors')) {
        return { rowCount: 1, rows: [makeMonitor({ consecutive_failures: 2 })] };
      }
      return { rowCount: 1, rows: [] };
    });
    await handleCheckResult(monitorId, transientFailure);

    // Assert: Exactly ONE write occurred, recording 1 down ping without up_count increment
    expect(statsQueries.length).toBe(1);
    expect(statsQueries[0].sql).toContain('ping_count = hourly_stats.ping_count + 1');
    expect(statsQueries[0].sql).not.toContain('up_count = hourly_stats.up_count + 1');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Immediate checks on creation & reactivation omit static jobId
  // -------------------------------------------------------------------------
  it('omits static jobId in createMonitor and updateMonitor, avoiding collisions with active scheduled checks', async () => {
    const monitorId = 'monitor-uuid-999';

    // Simulate active scheduled check in queue
    queueStore.set(`ping-${monitorId}`, { id: `ping-${monitorId}`, name: 'ping-check' });

    // 1. createMonitor
    const mockReqCreate = {
      user: { id: 'user-uuid-1' },
      body: { name: 'New Site', url: 'https://newsite.com', interval: 5, timeout: 10 },
    };
    const mockResCreate = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: monitorId, name: 'New Site', url: 'https://newsite.com' }],
    });

    await createMonitor(mockReqCreate, mockResCreate);

    // Verify pingQueue.add was called without static jobId
    const createCall = pingQueue.add.mock.calls.find((call) => call[0] === 'ping-check' && call[1]?.monitorId === monitorId);
    expect(createCall).toBeDefined();
    expect(createCall[2]?.jobId).toBeUndefined(); // let BullMQ auto-generate

    // 2. updateMonitor (unpausing)
    const mockReqUpdate = {
      user: { id: 'user-uuid-1' },
      params: { id: monitorId },
      body: { is_active: true },
    };
    const mockResUpdate = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // First query: SELECT current monitor (inactive)
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: monitorId, is_active: false, next_check_at: new Date() }],
    });
    // Second query: UPDATE monitor
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: monitorId, is_active: true }],
    });

    await updateMonitor(mockReqUpdate, mockResUpdate);

    const updateCalls = pingQueue.add.mock.calls.filter((call) => call[0] === 'ping-check' && call[1]?.monitorId === monitorId);
    const reactivateCall = updateCalls[updateCalls.length - 1];
    expect(reactivateCall).toBeDefined();
    expect(reactivateCall[2]?.jobId).toBeUndefined(); // let BullMQ auto-generate
  });
});
