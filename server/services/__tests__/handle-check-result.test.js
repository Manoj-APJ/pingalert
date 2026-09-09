/**
 * Tests for handleCheckResult (monitor-service.js)
 *
 * Specifically verifies that pool client.release() is called EXACTLY ONCE
 * regardless of which execution path is taken:
 *   - Monitor not found (early-return path)
 *   - Normal success path
 *   - Error thrown mid-transaction
 *
 * No real database or Redis connection is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Build a reusable mock factory for the pg pool client
// ---------------------------------------------------------------------------
const makeMockClient = (overrides = {}) => ({
  query: vi.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
  release: vi.fn(),
  ...overrides,
});

// ---------------------------------------------------------------------------
// Mock all external dependencies BEFORE importing the module under test.
// vi.mock() calls are hoisted to the top of the file by Vitest.
// ---------------------------------------------------------------------------

// Mock the pg pool — return a controlled client object
vi.mock('../../db/index.js', () => {
  // pool and query are set per-test via the testState object
  return {
    pool: {
      connect: vi.fn(),
    },
    query: vi.fn(),
  };
});

// Mock both queues — we don't need real Redis for these tests
vi.mock('../../queue/index.js', () => ({
  pingQueue: { add: vi.fn().mockResolvedValue(null) },
  alertQueue: { add: vi.fn().mockResolvedValue(null) },
}));

// Mock the config module
vi.mock('../../config/index.js', () => ({
  config: {
    pingRetryCount: 3,
    pingRetryDelaySec: 5,
  },
}));

// ---------------------------------------------------------------------------
// Import the module under test AFTER mocks are in place
// ---------------------------------------------------------------------------
import { handleCheckResult } from '../monitor-service.js';
import { pool } from '../../db/index.js';

// ---------------------------------------------------------------------------
// Helper: a minimal monitor row as returned by the DB
// ---------------------------------------------------------------------------
const fakeMonitor = () => ({
  id: 'monitor-uuid-1',
  user_id: 'user-uuid-1',
  name: 'Test Monitor',
  url: 'https://example.com',
  status: 'up',
  interval_minutes: 5,
  timeout_seconds: 10,
  consecutive_failures: 0,
  last_status_change_at: null,
});

// ---------------------------------------------------------------------------
// A successful check result
// ---------------------------------------------------------------------------
const successResult = {
  isUp: true,
  responseTimeMs: 123,
  statusCode: 200,
  cause: null,
};

// ---------------------------------------------------------------------------
// A failed check result (enough to cross the retry threshold: failure #3 of 3)
// ---------------------------------------------------------------------------
const failResult = {
  isUp: false,
  responseTimeMs: 10000,
  statusCode: 0,
  cause: 'Timeout after 10s',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('handleCheckResult — client.release() call count', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TEST 1: Monitor not found → early-return path
  // -------------------------------------------------------------------------
  it('calls client.release() EXACTLY ONCE when monitor is not found (early-return path)', async () => {
    const client = makeMockClient({
      query: vi.fn().mockImplementation((sql) => {
        // BEGIN, ROLLBACK — both succeed
        return Promise.resolve({ rowCount: 0, rows: [] });
      }),
    });

    pool.connect.mockResolvedValue(client);

    await handleCheckResult('nonexistent-id', successResult);

    // ROLLBACK must have been called
    const calls = client.query.mock.calls.map(c => c[0]);
    expect(calls).toContain('BEGIN');
    expect(calls.some(q => q.includes('ROLLBACK'))).toBe(true);

    // release must be called exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // TEST 2: Normal success path — monitor found, check is up
  // -------------------------------------------------------------------------
  it('calls client.release() EXACTLY ONCE on a normal successful check', async () => {
    const monitor = fakeMonitor();

    const client = makeMockClient({
      query: vi.fn().mockImplementation((sql) => {
        // Return the monitor row for the SELECT ... FOR UPDATE
        if (sql.includes('SELECT * FROM monitors')) {
          return Promise.resolve({ rowCount: 1, rows: [monitor] });
        }
        // COMMIT, hourly_stats upsert, monitors UPDATE — all succeed
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    });

    pool.connect.mockResolvedValue(client);

    await handleCheckResult(monitor.id, successResult);

    // COMMIT must have been called (not ROLLBACK)
    const calls = client.query.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('COMMIT'))).toBe(true);
    expect(calls.some(q => q.includes('ROLLBACK'))).toBe(false);

    // release must be called exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Error thrown mid-transaction → catch + ROLLBACK path
  // -------------------------------------------------------------------------
  it('calls client.release() EXACTLY ONCE and issues ROLLBACK when an error is thrown mid-transaction', async () => {
    const monitor = fakeMonitor();

    const client = makeMockClient({
      query: vi.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM monitors')) {
          return Promise.resolve({ rowCount: 1, rows: [monitor] });
        }
        // Simulate a DB error on the monitors UPDATE statement
        if (sql.includes('UPDATE monitors')) {
          return Promise.reject(new Error('Simulated DB write failure'));
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    });

    pool.connect.mockResolvedValue(client);

    // handleCheckResult catches internally and does not rethrow
    await expect(handleCheckResult(monitor.id, successResult)).resolves.toBeUndefined();

    // ROLLBACK must have been called in the catch block
    const calls = client.query.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('ROLLBACK'))).toBe(true);

    // release must be called exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // TEST 4: pool.connect() itself throws — client is never assigned.
  //         The catch block must not crash on client.query('ROLLBACK')
  //         because client is null; the if(client) guard prevents that.
  //         The function must resolve (not reject) — it swallows the error
  //         and logs it, consistent with every other error path.
  // -------------------------------------------------------------------------
  it('resolves cleanly and does NOT crash if pool.connect() throws (client was never assigned)', async () => {
    pool.connect.mockRejectedValue(new Error('Connection pool exhausted'));

    // Must resolve, NOT reject — the null-client guard in catch prevents
    // a secondary TypeError from propagating.
    await expect(handleCheckResult('any-id', successResult)).resolves.toBeUndefined();

    // pool.connect was called once; after it threw, nothing else happened
    expect(pool.connect).toHaveBeenCalledTimes(1);
  });

  // -------------------------------------------------------------------------
  // TEST 5: Full failure path — monitor found, check fails, retries exhausted
  // -------------------------------------------------------------------------
  it('calls client.release() EXACTLY ONCE on a confirmed-down failure path', async () => {
    const monitor = {
      ...fakeMonitor(),
      status: 'up',
      consecutive_failures: 2, // already at retry threshold - 1
    };

    const client = makeMockClient({
      query: vi.fn().mockImplementation((sql) => {
        if (sql.includes('SELECT * FROM monitors')) {
          return Promise.resolve({ rowCount: 1, rows: [monitor] });
        }
        if (sql.includes('INSERT INTO incidents')) {
          return Promise.resolve({ rowCount: 1, rows: [{ id: 'incident-uuid' }] });
        }
        return Promise.resolve({ rowCount: 1, rows: [] });
      }),
    });

    pool.connect.mockResolvedValue(client);

    await handleCheckResult(monitor.id, failResult);

    // COMMIT must have been reached (failure recorded, not thrown)
    const calls = client.query.mock.calls.map(c => c[0]);
    expect(calls.some(q => q.includes('COMMIT'))).toBe(true);

    // release must be called exactly once
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
