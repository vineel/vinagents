import { Task } from 'graphile-worker';
import { AgentExecutor } from '../executor';
import { logger } from '../../utils/logger';

// Import agents to register them
import '../../agents/simple-agent';

interface AgentRunPayload {
  runId: string;
}

export const agentRun: Task = async (payload, _helpers) => {
  const { runId } = payload as AgentRunPayload;

  logger.info('Processing agent run', { runId });

  const executor = new AgentExecutor(runId);
  await executor.execute();
};
