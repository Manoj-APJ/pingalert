import { Worker } from 'bullmq';
import { config } from '../config/index.js';
import { query } from '../db/index.js';
import { performPing, handleCheckResult } from '../services/monitor-service.js';
import { pingQueueName } from '../queue/index.js';

/**
 * Initializes and starts the Ping Worker pulling from 'monitor-pings'
 */
export const startPingWorker = () => {
  console.log(`[Ping Worker] Launching queue processor (concurrency: ${config.pingConcurrency})...`);

  const worker = new Worker(
    pingQueueName,
    async (job) => {
      const { monitorId } = job.data;

      // 1. Fetch live monitor data
      const monitorRes = await query('SELECT * FROM monitors WHERE id = $1', [monitorId]);
      if (monitorRes.rowCount === 0) {
        console.log(`[Ping Worker] Monitor ${monitorId} not found in database. Skipping.`);
        return;
      }
      const monitor = monitorRes.rows[0];

      // If monitor was paused in the meantime, abort the execution
      if (!monitor.is_active) {
        console.log(`[Ping Worker] Monitor "${monitor.name}" is disabled. Skipping.`);
        return;
      }

      // 2. Perform network request check
      const checkResult = await performPing(monitor);

      // 3. Process status, update metrics and trigger incident/retries
      await handleCheckResult(monitor.id, checkResult);
    },
    {
      connection: {
        url: config.redisUrl
      },
      concurrency: config.pingConcurrency
    }
  );

  worker.on('error', (err) => {
    console.error('[Ping Worker] Queue connection error:', err);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Ping Worker] Job ${job?.id} failed:`, err);
  });

  return worker;
};
