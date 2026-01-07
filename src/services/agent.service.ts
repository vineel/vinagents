import { AgentRunDAO } from '../db/dao/agent-run.dao';
import { AgentRunMessageDAO } from '../db/dao/agent-run-message.dao';
import {
  AgentRun,
  AgentRunMessage,
  ListAgentRunsFilters,
  GetRunStatusOptions,
} from '../types/agent';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { enqueueAgentRun, cancelPendingJob } from '../lib/queue';

export class AgentService {
  private agentRunDAO: AgentRunDAO;
  private agentRunMessageDAO: AgentRunMessageDAO;

  constructor() {
    this.agentRunDAO = new AgentRunDAO();
    this.agentRunMessageDAO = new AgentRunMessageDAO();
  }

  async launchRun(
    userId: string,
    agentType: string,
    input: Record<string, unknown>
  ): Promise<AgentRun> {
    // For now, accept any agent type - validation will come when we have a registry
    const run = await this.agentRunDAO.create({
      userId,
      agentType,
      inputPayload: input,
    });

    // Enqueue job with Graphile Worker
    const jobId = await enqueueAgentRun(run.agentRunId);
    const updatedRun = await this.agentRunDAO.update(run.agentRunId, {
      graphileJobId: jobId,
    });

    return updatedRun || run;
  }

  async getRunStatus(
    runId: string,
    userId: string,
    options: GetRunStatusOptions = {}
  ): Promise<{ run: AgentRun; messages?: AgentRunMessage[] }> {
    const run = await this.agentRunDAO.findByIdAndUserId(runId, userId);

    if (!run) {
      throw new NotFoundError('Agent run not found');
    }

    const result: { run: AgentRun; messages?: AgentRunMessage[] } = { run };

    if (options.includeMessages) {
      result.messages = await this.agentRunMessageDAO.findByRunId(
        runId,
        options.messagesSince
      );
    }

    return result;
  }

  async cancelRun(runId: string, userId: string): Promise<AgentRun> {
    const run = await this.agentRunDAO.findByIdAndUserId(runId, userId);

    if (!run) {
      throw new NotFoundError('Agent run not found');
    }

    // Can only cancel runs that are pending or running
    if (!['pending', 'running'].includes(run.status)) {
      throw new BadRequestError(
        `Cannot cancel run with status '${run.status}'. Only 'pending' or 'running' runs can be cancelled.`
      );
    }

    const updatedRun = await this.agentRunDAO.updateStatus(runId, 'cancel_requested');

    if (!updatedRun) {
      throw new NotFoundError('Agent run not found');
    }

    // If pending, also remove from Graphile Worker queue
    if (run.status === 'pending' && run.graphileJobId) {
      await cancelPendingJob(run.graphileJobId);
    }

    return updatedRun;
  }

  async listRuns(
    userId: string,
    filters: ListAgentRunsFilters = {}
  ): Promise<{ runs: AgentRun[]; total: number }> {
    const [runs, total] = await Promise.all([
      this.agentRunDAO.findByUserId(userId, filters),
      this.agentRunDAO.countByUserId(userId, {
        status: filters.status,
        agentType: filters.agentType,
      }),
    ]);

    return { runs, total };
  }
}
