import { AgentRunDAO } from '../db/dao/agent-run.dao';
import { AgentRunMessageDAO } from '../db/dao/agent-run-message.dao';
import { AgentRegistry } from '../agents/registry';
import { AgentContext } from '../agents/types';
import { anthropic } from '../lib/anthropic';
import { logger } from '../utils/logger';

export class AgentExecutor {
  private runId: string;
  private agentRunDAO: AgentRunDAO;
  private messageDAO: AgentRunMessageDAO;

  constructor(runId: string) {
    this.runId = runId;
    this.agentRunDAO = new AgentRunDAO();
    this.messageDAO = new AgentRunMessageDAO();
  }

  async execute(): Promise<void> {
    const run = await this.agentRunDAO.findById(this.runId);
    if (!run) throw new Error(`Run not found: ${this.runId}`);

    // Check for cancellation before starting
    if (run.status === 'cancel_requested') {
      await this.handleCancellation();
      return;
    }

    await this.agentRunDAO.update(this.runId, {
      status: 'running',
      startedAt: new Date(),
    });

    await this.log('info', 'Agent run started');

    const context = this.buildContext(run);

    const AgentClass = AgentRegistry.get(run.agentType);
    const agent = new AgentClass(context);

    try {
      await agent.initialize();

      const steps = agent.defineSteps();
      await this.agentRunDAO.update(this.runId, { totalSteps: steps.length });

      let lastOutput: unknown = run.inputPayload;

      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        context.currentStep = i + 1;

        if (await context.checkCancellation()) {
          await this.handleCancellation();
          return;
        }

        if (step.shouldSkip?.(lastOutput, context)) {
          await this.log('info', `Skipping step: ${step.name}`);
          continue;
        }

        const stepInput = step.transformInput
          ? step.transformInput(lastOutput)
          : lastOutput;

        await this.log('info', `Starting step: ${step.name}`);
        const result = await step.execute(stepInput, context);

        lastOutput = result.output;
        context.stepOutputs.set(step.name, result.output);

        await this.agentRunDAO.update(this.runId, { currentStep: i + 1 });
      }

      await this.agentRunDAO.update(this.runId, {
        status: 'completed',
        outputPayload: lastOutput as Record<string, unknown>,
        completedAt: new Date(),
      });

      await this.log('info', 'Agent run completed');
    } catch (error) {
      await this.handleError(error as Error);
      throw error;
    } finally {
      await agent.cleanup();
    }
  }

  private buildContext(run: {
    agentRunId: string;
    userId: string;
    inputPayload: Record<string, unknown>;
  }): AgentContext {
    return {
      runId: run.agentRunId,
      userId: run.userId,
      input: run.inputPayload,
      currentStep: 0,
      anthropic,
      stepOutputs: new Map(),
      log: (message, level = 'info', details) => this.log(level, message, details),
      checkCancellation: () => this.checkCancellation(),
    };
  }

  private async log(
    level: 'debug' | 'info' | 'warn' | 'error',
    message: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.messageDAO.create({
      agentRunId: this.runId,
      level,
      message,
      details,
    });
    logger.info(message, { runId: this.runId, ...details });
  }

  private async checkCancellation(): Promise<boolean> {
    const run = await this.agentRunDAO.findById(this.runId);
    return run?.status === 'cancel_requested';
  }

  private async handleCancellation(): Promise<void> {
    await this.agentRunDAO.update(this.runId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
    await this.log('info', 'Run cancelled by user request');
  }

  private async handleError(error: Error): Promise<void> {
    await this.agentRunDAO.update(this.runId, {
      status: 'failed',
      errorMessage: error.message,
      completedAt: new Date(),
    });
    await this.log('error', `Agent run failed: ${error.message}`);
  }
}
