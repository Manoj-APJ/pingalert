import { Queue } from 'bullmq';
import { config } from '../config/index.js';

export const pingQueueName = 'monitor-pings';
export const alertQueueName = 'alerts';

const connectionOpts = {
  url: config.redisUrl
};

// Queue for scheduling and executing website checks
export const pingQueue = new Queue(pingQueueName, {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100
  }
});

// Queue for formatting and sending out alerts (emails)
export const alertQueue = new Queue(alertQueueName, {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: true,
    removeOnFail: 100
  }
});
