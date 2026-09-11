import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db/index.js', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}));

import { computeOverallStatus, getPublicStatusPage } from '../status-page-controller.js';
import { query } from '../../db/index.js';

describe('B4 — Public Status Page Overall Status Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // -------------------------------------------------------------------------
  // TEST 1: All monitors 'unknown' → pending (not operational)
  // -------------------------------------------------------------------------
  it('returns "pending" when all monitors have "unknown" status', () => {
    const monitors = [
      { id: '1', name: 'API Server', status: 'unknown' },
      { id: '2', name: 'Web Frontend', status: 'unknown' },
    ];
    expect(computeOverallStatus(monitors)).toBe('pending');
  });

  // -------------------------------------------------------------------------
  // TEST 2: Mix of 'up' and 'unknown', zero 'down' → pending
  // -------------------------------------------------------------------------
  it('returns "pending" when there is a mix of "up" and "unknown" monitors with no down monitors', () => {
    const monitors = [
      { id: '1', name: 'API Server', status: 'up' },
      { id: '2', name: 'Web Frontend', status: 'unknown' },
    ];
    expect(computeOverallStatus(monitors)).toBe('pending');
  });

  // -------------------------------------------------------------------------
  // TEST 3: Mix of 'unknown' and 'down' → outage status wins
  // -------------------------------------------------------------------------
  it('returns "partial_outage" when some monitors are down even if others are unknown', () => {
    const monitors = [
      { id: '1', name: 'API Server', status: 'down' },
      { id: '2', name: 'Web Frontend', status: 'unknown' },
    ];
    expect(computeOverallStatus(monitors)).toBe('partial_outage');
  });

  it('returns "major_outage" when all monitors are down', () => {
    const monitors = [
      { id: '1', name: 'API Server', status: 'down' },
      { id: '2', name: 'Web Frontend', status: 'down' },
    ];
    expect(computeOverallStatus(monitors)).toBe('major_outage');
  });

  // -------------------------------------------------------------------------
  // TEST 4: All 'up' → operational (no regression)
  // -------------------------------------------------------------------------
  it('returns "operational" when all monitors are "up"', () => {
    const monitors = [
      { id: '1', name: 'API Server', status: 'up' },
      { id: '2', name: 'Web Frontend', status: 'up' },
    ];
    expect(computeOverallStatus(monitors)).toBe('operational');
  });

  // -------------------------------------------------------------------------
  // TEST 5: getPublicStatusPage HTTP endpoint integration
  // -------------------------------------------------------------------------
  it('getPublicStatusPage endpoint includes overallStatus="pending" for unknown monitors', async () => {
    const mockReq = { params: { slug: 'status-demo' } };
    const mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    // 1. SELECT status_page
    query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [{ id: 'page-1', title: 'Demo Page', slug: 'status-demo' }],
    });

    // 2. SELECT associated monitors (all unknown)
    query.mockResolvedValueOnce({
      rowCount: 2,
      rows: [
        { id: 'm1', name: 'Service A', status: 'unknown' },
        { id: 'm2', name: 'Service B', status: 'unknown' },
      ],
    });

    // 3. SELECT hourly stats aggregates
    query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    // 4. SELECT recent incidents
    query.mockResolvedValueOnce({
      rowCount: 0,
      rows: [],
    });

    await getPublicStatusPage(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        overallStatus: 'pending',
      })
    );
  });
});
