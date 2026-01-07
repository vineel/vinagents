import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AgentService } from '../services/agent.service';
import { AgentRunStatus } from '../types/agent';
import { config } from '../config/env';

export class AgentController {
  private agentService: AgentService;

  constructor() {
    this.agentService = new AgentService();
  }

  launchRun = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { agentType } = req.params;
      const { input } = req.body;
      const userId = req.user!.userId;

      const run = await this.agentService.launchRun(userId, agentType, input || {});

      res.status(202).json({
        status: 'success',
        data: {
          runId: run.agentRunId,
          status: run.status,
          pollUrl: `${config.apiPrefix}/agents/runs/${run.agentRunId}`,
          createdAt: run.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getRunStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const userId = req.user!.userId;
      const includeMessages = req.query.includeMessages === 'true';
      const messagesSince = req.query.messagesSince
        ? new Date(req.query.messagesSince as string)
        : undefined;

      const { run, messages } = await this.agentService.getRunStatus(runId, userId, {
        includeMessages,
        messagesSince,
      });

      const responseData: Record<string, unknown> = {
        runId: run.agentRunId,
        agentType: run.agentType,
        status: run.status,
        currentStep: run.currentStep,
        totalSteps: run.totalSteps,
        input: run.inputPayload,
        output: run.outputPayload,
        error: run.errorMessage,
        createdAt: run.createdAt,
        startedAt: run.startedAt,
        completedAt: run.completedAt,
      };

      if (includeMessages && messages) {
        responseData.messages = messages.map((m) => ({
          messageId: m.agentMessageId,
          level: m.level,
          message: m.message,
          stepNumber: m.stepNumber,
          details: m.details,
          createdAt: m.createdAt,
        }));
      }

      res.status(200).json({
        status: 'success',
        data: responseData,
      });
    } catch (error) {
      next(error);
    }
  };

  cancelRun = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { runId } = req.params;
      const userId = req.user!.userId;

      const run = await this.agentService.cancelRun(runId, userId);

      res.status(200).json({
        status: 'success',
        data: {
          runId: run.agentRunId,
          status: run.status,
        },
        message: 'Cancellation requested. Run will stop after current step.',
      });
    } catch (error) {
      next(error);
    }
  };

  listRuns = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.userId;
      const { status, agentType, limit, offset } = req.query;

      const { runs, total } = await this.agentService.listRuns(userId, {
        status: status as AgentRunStatus | undefined,
        agentType: agentType as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
      });

      res.status(200).json({
        status: 'success',
        data: {
          runs: runs.map((run) => ({
            runId: run.agentRunId,
            agentType: run.agentType,
            status: run.status,
            currentStep: run.currentStep,
            totalSteps: run.totalSteps,
            createdAt: run.createdAt,
            startedAt: run.startedAt,
            completedAt: run.completedAt,
          })),
          pagination: {
            total,
            limit: limit ? parseInt(limit as string, 10) : 20,
            offset: offset ? parseInt(offset as string, 10) : 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
