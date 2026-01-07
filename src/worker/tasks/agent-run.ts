import { Task } from 'graphile-worker';
import { AgentRunDAO } from '../../db/dao/agent-run.dao';
import { AgentRunMessageDAO } from '../../db/dao/agent-run-message.dao';
import { logger } from '../../utils/logger';

interface AgentRunPayload {
  runId: string;
}

export const agentRun: Task = async (payload, _helpers) => {
  const { runId } = payload as AgentRunPayload;
  const agentRunDAO = new AgentRunDAO();
  const messageDAO = new AgentRunMessageDAO();

  logger.info('Processing agent run', { runId });

  // Update status to running
  await agentRunDAO.update(runId, {
    status: 'running',
    startedAt: new Date(),
  });

  await messageDAO.create({
    agentRunId: runId,
    level: 'info',
    message: 'Agent run started',
  });

  try {
    // Check for cancellation before starting work
    const run = await agentRunDAO.findById(runId);
    if (run?.status === 'cancel_requested') {
      await agentRunDAO.update(runId, {
        status: 'cancelled',
        completedAt: new Date(),
      });
      await messageDAO.create({
        agentRunId: runId,
        level: 'info',
        message: 'Agent run cancelled by user request',
      });
      return;
    }

    // TODO: Step 4 - Actual agent execution goes here
    // For now, just simulate work and complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    await agentRunDAO.update(runId, {
      status: 'completed',
      completedAt: new Date(),
      outputPayload: { result: 'placeholder - agent execution not yet implemented' },
    });

    await messageDAO.create({
      agentRunId: runId,
      level: 'info',
      message: 'Agent run completed',
    });

    logger.info('Agent run completed', { runId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    logger.error('Agent run failed', { runId, error: errorMessage });

    await agentRunDAO.update(runId, {
      status: 'failed',
      completedAt: new Date(),
      errorMessage,
    });

    await messageDAO.create({
      agentRunId: runId,
      level: 'error',
      message: `Agent run failed: ${errorMessage}`,
    });

    throw error;
  }
};
