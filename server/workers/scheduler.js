import { query } from '../db/index.js';
import { pingQueue } from '../queue/index.js';
import { pruneEmailLogs } from '../services/monitor-service.js';

/**
 * Checks database for monitors that are active and past their check time,
 * locks them by updating next_check_at forward, and pushes them onto BullMQ.
 */
export const scheduleDueMonitors = async () => {
  try {
    // Atomically select and temporarily lock due monitors by advancing their next_check_at
    const dueRes = await query(
      `UPDATE monitors 
       SET next_check_at = NOW() + (interval_minutes * interval '1 minute')
       WHERE is_active = true AND (next_check_at <= NOW() OR next_check_at IS NULL)
       RETURNING id, name, url, interval_minutes`
    );

    if (dueRes.rowCount === 0) return;

    console.log(`[Scheduler] Found ${dueRes.rowCount} monitors due for check.`);

    // Bulk enqueue jobs to BullMQ
    const jobs = dueRes.rows.map(monitor => ({
      name: 'ping-check',
      data: { monitorId: monitor.id },
      opts: {
        jobId: `ping-${monitor.id}`,
        removeOnComplete: true,
        removeOnFail: true
      }
    }));

    if (jobs.length > 0) {
      const addedJobs = await pingQueue.addBulk(jobs);
      if (Array.isArray(addedJobs)) {
        jobs.forEach((jobDef, idx) => {
          if (!addedJobs[idx]) {
            console.warn(`[Scheduler: Scheduled Ping] BullMQ deduplicated or failed to enqueue job for monitor ${jobDef.data.monitorId} (jobId: ${jobDef.opts.jobId})`);
          }
        });
      }
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
