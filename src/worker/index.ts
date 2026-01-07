import { run } from 'graphile-worker';
import { pool } from '../db/pool';
import { taskList } from './tasks';
import { logger } from '../utils/logger';

async function startWorker() {
  logger.info('Starting Graphile Worker...');

  const runner = await run({
    pgPool: pool,
    taskList,
    concurrency: 5,
    pollInterval: 1000,
  });

  logger.info('Worker started, listening for jobs...');

  // Wait for runner to finish (blocks until shutdown signal)
  await runner.promise;
}

startWorker().catch((err) => {
  logger.error('Worker failed to start', { error: err.message, stack: err.stack });
  process.exit(1);
});
