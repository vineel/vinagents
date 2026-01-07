import { quickAddJob } from 'graphile-worker';
import { pool } from '../db/pool';

export async function enqueueAgentRun(runId: string): Promise<string> {
  const job = await quickAddJob(
    { pgPool: pool },
    'agent-run',
    { runId },
    { maxAttempts: 1 } // We handle retries ourselves in agent_runs table
  );
  return job.id;
}

export async function cancelPendingJob(jobId: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM graphile_worker.jobs
     WHERE id = $1 AND locked_at IS NULL
     RETURNING id`,
    [jobId]
  );
  return (result.rowCount ?? 0) > 0;
}
