import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock external dependencies before importing module under test
// ---------------------------------------------------------------------------

vi.mock('../../db/index.js', () => ({
  query: vi.fn(),
  pool: { connect: vi.fn() },
}));

vi.mock('../../queue/index.js', () => ({
  alertQueueName: 'alerts',
  alertQueue: { add: vi.fn().mockResolvedValue(null) },
  pingQueue: { add: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../config/index.js', () => ({
  config: {
    alertConcurrency: 10,
    redisUrl: 'redis://localhost:6379',
    alertRetryCount: 3,
    alertRetryDelaySec: 5,
    smtp: {
      host: 'smtp.example.com',
      port: 587,
      user: 'test-user',
      pass: 'test-pass',
      from: 'alerts@pingalert.com',
    },
  },
}));

vi.mock('bullmq', () => ({
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
    close: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Import module under test AFTER mocks
// ---------------------------------------------------------------------------
import { processAlertJob } from '../alert-worker.js';
import { query } from '../../db/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const fakeUser = {
  id: 'user-uuid-1',
  name: 'Test Admin',
  email: 'admin@example.com',
};

const fakeDownJob = {
  data: {
    monitorId: 'monitor-uuid-1',
    monitorName: 'Production API',
    monitorUrl: 'https://api.example.com',
    userId: 'user-uuid-1',
    type: 'DOWN',
    startedAt: new Date('2026-09-09T10:00:00Z').toISOString(),
    cause: 'HTTP 502 Bad Gateway',
  },
};

const fakeUpJob = {
  data: {
    monitorId: 'monitor-uuid-1',
    monitorName: 'Production API',
    monitorUrl: 'https://api.example.com',
    userId: 'user-uuid-1',
    type: 'UP',
    startedAt: new Date('2026-09-09T10:00:00Z').toISOString(),
    endedAt: new Date('2026-09-09T10:05:00Z').toISOString(),
    durationSec: 300,
  },
};

describe('Alert Worker — BUG-007 Regression & Delivery Status Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: user found
    query.mockImplementation((sql) => {
      if (sql.includes('SELECT email, name FROM users')) {
        return Promise.resolve({ rowCount: 1, rows: [fakeUser] });
      }
      return Promise.resolve({ rowCount: 1, rows: [] });
    });
  });

  // -------------------------------------------------------------------------
  // TEST 1: Terminal failure → recorded as "failed" in email_logs and error re-thrown
  // -------------------------------------------------------------------------
  it('records alert status as "failed" with error message on terminal failure attempt', async () => {
    const smtpError = new Error('535 5.7.8 Authentication credentials invalid');
    const mockTransporter = {
      sendMail: vi.fn().mockRejectedValue(smtpError),
    };

    const terminalJob = {
      ...fakeDownJob,
      attemptsMade: 2,
      opts: { attempts: 3 },
    };

    // processAlertJob must reject with the error so BullMQ marks job as failed
    await expect(processAlertJob(terminalJob, mockTransporter)).rejects.toThrow(
      '535 5.7.8 Authentication credentials invalid'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

    // Verify DB insert recorded the terminal failure
    const insertCall = query.mock.calls.find((call) =>
      call[0].includes('INSERT INTO email_logs')
    );
    expect(insertCall).toBeDefined();

    const [sql, params] = insertCall;
    expect(sql).toContain('status');
    expect(sql).toContain('error');

    // Assert status is 'failed', NOT 'sent'
    expect(params).toContain('failed');
    expect(params).not.toContain('sent');
    expect(params).toContain('535 5.7.8 Authentication credentials invalid');
    expect(params).toContain(fakeDownJob.data.monitorId);
    expect(params).toContain(fakeUser.email);
  });

  // -------------------------------------------------------------------------
  // TEST 1b: Transient retry failure → re-throws but does NOT record to email_logs yet
  // -------------------------------------------------------------------------
  it('does NOT record to email_logs on transient failure when retries remain', async () => {
    const smtpError = new Error('421 4.4.2 Connection timed out');
    const mockTransporter = {
      sendMail: vi.fn().mockRejectedValue(smtpError),
    };

    const transientJob = {
      ...fakeDownJob,
      attemptsMade: 0,
      opts: { attempts: 3 }, // attempt 1 of 3: retries remain
    };

    // Must still rethrow so BullMQ initiates backoff
    await expect(processAlertJob(transientJob, mockTransporter)).rejects.toThrow(
      '421 4.4.2 Connection timed out'
    );

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

    // Must NOT write to email_logs yet on intermediate retry
    const insertCall = query.mock.calls.find((call) =>
      call[0].includes('INSERT INTO email_logs')
    );
    expect(insertCall).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // TEST 2: Normal success path → status recorded as "sent" only AFTER sendMail resolves
  // -------------------------------------------------------------------------
  it('records status as "sent" only AFTER sendMail promise resolves successfully', async () => {
    let sendMailResolved = false;
    let insertHappenedAfterSendMail = false;

    const mockTransporter = {
      sendMail: vi.fn().mockImplementation(async () => {
        // Small delay to verify sequence
        await new Promise((res) => setTimeout(res, 10));
        sendMailResolved = true;
        return { messageId: 'msg-123' };
      }),
    };

    query.mockImplementation((sql, params) => {
      if (sql.includes('SELECT email, name FROM users')) {
        return Promise.resolve({ rowCount: 1, rows: [fakeUser] });
      }
      if (sql.includes('INSERT INTO email_logs')) {
        insertHappenedAfterSendMail = sendMailResolved;
        return Promise.resolve({ rowCount: 1, rows: [] });
      }
      return Promise.resolve({ rowCount: 0, rows: [] });
    });

    await expect(processAlertJob(fakeUpJob, mockTransporter)).resolves.toBeUndefined();

    expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);
    expect(insertHappenedAfterSendMail).toBe(true);

    // Verify DB insert call
    const insertCall = query.mock.calls.find((call) =>
      call[0].includes('INSERT INTO email_logs')
    );
    expect(insertCall).toBeDefined();

    const [sql, params] = insertCall;
    expect(params).toContain('sent');
    expect(params).not.toContain('failed');
    expect(params).toContain(fakeUpJob.data.monitorId);
    expect(params).toContain(fakeUser.email);
  });

  // -------------------------------------------------------------------------
  // TEST 3: SMTP unconfigured → status recorded as distinct "mocked" status
  // -------------------------------------------------------------------------
  it('records status as "mocked" (not "sent") when SMTP transporter is unconfigured', async () => {
    await expect(processAlertJob(fakeDownJob, null)).resolves.toBeUndefined();

    const insertCall = query.mock.calls.find((call) =>
      call[0].includes('INSERT INTO email_logs')
    );
    expect(insertCall).toBeDefined();

    const [sql, params] = insertCall;
    expect(params).toContain('mocked');
    expect(params).not.toContain('sent');
    expect(params).not.toContain('failed');
    expect(params).toContain(fakeDownJob.data.monitorId);
    expect(params).toContain(fakeUser.email);
  });

  // -------------------------------------------------------------------------
  // TEST 4: User not found → early return without sending or inserting email_logs
  // -------------------------------------------------------------------------
  it('aborts cleanly without calling sendMail or inserting email_logs if user not found', async () => {
    query.mockResolvedValueOnce({ rowCount: 0, rows: [] }); // user lookup returns 0 rows

    const mockTransporter = {
      sendMail: vi.fn(),
    };

    await expect(processAlertJob(fakeDownJob, mockTransporter)).resolves.toBeUndefined();

    expect(mockTransporter.sendMail).not.toHaveBeenCalled();
    const insertCall = query.mock.calls.find((call) =>
      call[0].includes('INSERT INTO email_logs')
    );
    expect(insertCall).toBeUndefined();
  });
});
