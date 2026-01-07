import { Router } from 'express';
import { z } from 'zod';
import { AgentController } from '../controllers/agent.controller';
import { validate } from '../middleware/validate.middleware';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const agentController = new AgentController();

// All agent routes require authentication
router.use(authenticate);

// POST /api/agents/:agentType/run - Launch a new agent run
const launchSchema = z.object({
  params: z.object({
    agentType: z.string().min(1, 'Agent type is required'),
  }),
  body: z.object({
    input: z.record(z.unknown()).default({}),
  }),
});
router.post('/:agentType/run', validate(launchSchema), agentController.launchRun);

// GET /api/agents/runs - List user's runs
const listSchema = z.object({
  query: z.object({
    status: z
      .enum(['pending', 'running', 'completed', 'failed', 'cancelled', 'cancel_requested'])
      .optional(),
    agentType: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});
router.get('/runs', validate(listSchema), agentController.listRuns);

// GET /api/agents/runs/:runId - Get run status
const getStatusSchema = z.object({
  params: z.object({
    runId: z.string().uuid('Invalid run ID'),
  }),
  query: z.object({
    includeMessages: z.string().optional(),
    messagesSince: z.string().datetime().optional(),
  }),
});
router.get('/runs/:runId', validate(getStatusSchema), agentController.getRunStatus);

// POST /api/agents/runs/:runId/cancel - Cancel a run
const cancelSchema = z.object({
  params: z.object({
    runId: z.string().uuid('Invalid run ID'),
  }),
});
router.post('/runs/:runId/cancel', validate(cancelSchema), agentController.cancelRun);

export default router;
