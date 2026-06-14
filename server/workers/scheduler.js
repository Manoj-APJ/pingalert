import { query } from '../db/index.js';
import { pingQueue } from '../queue/index.js';
import { pruneEmailLogs } from '../services/monitor-service.js';

/**
 * Checks database for monitors that are active and past their check time,
 * locks them by updating next_check_at forward, and pushes them onto BullMQ.
 */
export const scheduleDueMonitors = async () => {
  try {
    // Select monitors due for checking
    const dueRes = await query(
      `SELECT id, name, url, interval_minutes 
       FROM monitors 
       WHERE is_active = true AND (next_check_at <= NOW() OR next_check_at IS NULL)`
    );

    if (dueRes.rowCount === 0) return;

    console.log(`[Scheduler] Found ${dueRes.rowCount} monitors due for check.`);

    for (const monitor of dueRes.rows) {
      // Prevent double scheduling by immediately moving next_check_at forward (temporary lock)
      const temporaryNextCheck = new Date(Date.now() + monitor.interval_minutes * 60 * 1000);
      await query(
        'UPDATE monitors SET next_check_at = $1 WHERE id = $2',
        [temporaryNextCheck, monitor.id]
      );

      // Add to BullMQ ping execution queue
      await pingQueue.add(
        'ping-check',
        { monitorId: monitor.id },
        {
          jobId: `ping-${monitor.id}`,
          removeOnComplete: true,
          removeOnFail: true
        }
      );
    }
  } catch (error) {
    console.error('[Scheduler] Error scanning and queueing monitors:', error);
  }
};

let checkIntervalId = null;
let cleanupIntervalId = null;

/**
 * Starts the scheduling timers
 */
export const startScheduler = () => {
  console.log('[Scheduler] Initializing monitor check daemon...');
  // Run checks every 10 seconds
  checkIntervalId = setInterval(scheduleDueMonitors, 10000);
  scheduleDueMonitors(); // Run first check immediately

  console.log('[Scheduler] Initializing database cleanup daemon...');
  // Run pruning cleanup every 24 hours
  cleanupIntervalId = setInterval(pruneEmailLogs, 24 * 60 * 60 * 1000);
  pruneEmailLogs(); // Run first cleanup immediately
};

/**
 * Stops the scheduling timers
 */
export const stopScheduler = () => {
  if (checkIntervalId) {
    clearInterval(checkIntervalId);
    checkIntervalId = null;
  }
  if (cleanupIntervalId) {
    clearInterval(cleanupIntervalId);
    cleanupIntervalId = null;
  }
  console.log('[Scheduler] Daemon services stopped.');
};
