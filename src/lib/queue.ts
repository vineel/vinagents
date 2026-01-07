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
  try {
    const result = await pool.query(
      `DELETE FROM graphile_worker.jobs
       WHERE id = $1 AND locked_at IS NULL
       RETURNING id`,
      [jobId]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    // Gracefully handle case where graphile_worker schema doesn't exist or is a view
    const pgError = error as { code?: string; message?: string };
    // 42P01 = undefined_table, 42501 = insufficient_privilege, 55000 = object_not_in_prerequisite_state
    // Also check for "cannot delete from view" message
    if (
      pgError.code === '42P01' ||
      pgError.code === '42501' ||
      pgError.code === '55000' ||
      pgError.message?.includes('cannot delete from view')
    ) {
      return false;
    }
    throw error;
  }
}
