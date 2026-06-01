import { connectWithRetry } from './server/db/index.js';
import { startScheduler } from './server/workers/scheduler.js';
import { startPingWorker } from './server/workers/ping-worker.js';
import { startAlertWorker } from './server/workers/alert-worker.js';

const run = async () => {
  console.log('===================================================');
  console.log('   Starting PingAlert Background Daemon Workers     ');
  console.log('===================================================');

  try {
    // 1. Establish PostgreSQL Connection
    await connectWithRetry(10, 3000);

    // 2. Start checking scheduler and pruning scheduler
    startScheduler();

    // 3. Start BullMQ consumer worker threads
    const pingWorker = startPingWorker();
    const alertWorker = startAlertWorker();

    console.log('[Daemon] All background workers successfully started.');

    // 4. Graceful shutdown handler
    const gracefulShutdown = async (signal) => {
      console.log(`[Daemon] Received ${signal}. Terminating background processes...`);
      try {
        await pingWorker.close();
        await alertWorker.close();
        console.log('[Daemon] Graceful shutdown completed. Processes closed.');
        process.exit(0);
      } catch (err) {
        console.error('[Daemon] Error during graceful shutdown:', err);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  } catch (error) {
    console.error('[Daemon] Fatal error during startup sequence:', error);
    process.exit(1);
  }
};

run();
