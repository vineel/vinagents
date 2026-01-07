# Agent Runner - Technical Plan

## Overview

A system for running AI agents that combine LLM calls with TypeScript code execution. Built for learning production-ready patterns around job queuing, status tracking, and multi-step agent orchestration.

---

## 1. Database Schema

### 1.1 AgentRuns Table

The primary business record for each agent execution.

```sql
CREATE TYPE app.agent_run_status AS ENUM (
    'pending',      -- Queued, not yet picked up by worker
    'running',      -- Worker is actively processing
    'completed',    -- Finished successfully
    'failed',       -- Terminated with error
    'cancelled',    -- User requested cancellation
    'cancel_requested'  -- Cancellation pending (worker will pick up)
);

CREATE TABLE app.agent_runs (
    run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES app.users(user_id),
    
    -- Agent identification
    agent_type TEXT NOT NULL,  -- e.g., 'simple', 'multi-step', 'analysis'
    agent_version TEXT NOT NULL DEFAULT '1.0.0',
    
    -- Input/Output
    input_payload JSONB NOT NULL DEFAULT '{}',
    output_payload JSONB,  -- NULL until completed
    
    -- Status tracking
    status app.agent_run_status NOT NULL DEFAULT 'pending',
    current_step INTEGER NOT NULL DEFAULT 0,
    total_steps INTEGER,  -- NULL if unknown ahead of time
    
    -- Error handling
    error_message TEXT,
    error_details JSONB,  -- Stack trace, context, etc.
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    
    -- Timing
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Graphile Worker reference (for debugging/correlation)
    graphile_job_id BIGINT
);

-- Indexes for common queries
CREATE INDEX idx_agent_runs_user_status ON app.agent_runs(user_id, status);
CREATE INDEX idx_agent_runs_status ON app.agent_runs(status) WHERE status IN ('pending', 'running', 'cancel_requested');
CREATE INDEX idx_agent_runs_created ON app.agent_runs(created_at DESC);
```

### 1.2 AgentRunSteps Table

Tracks each step in a multi-step agent execution. Enables resumability and debugging.

```sql
CREATE TYPE app.step_status AS ENUM (
    'pending',
    'running', 
    'completed',
    'failed',
    'skipped'
);

CREATE TABLE app.agent_run_steps (
    step_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES app.agent_runs(run_id) ON DELETE CASCADE,
    
    step_number INTEGER NOT NULL,
    step_name TEXT NOT NULL,  -- e.g., 'llm_call_1', 'parse_response', 'llm_call_2'
    step_type TEXT NOT NULL,  -- 'llm', 'code', 'external_api'
    
    -- Step I/O (enables replay/debugging)
    input_data JSONB,
    output_data JSONB,
    
    status app.step_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,  -- Computed on completion
    
    -- LLM-specific metadata (when step_type = 'llm')
    llm_model TEXT,
    llm_prompt_tokens INTEGER,
    llm_completion_tokens INTEGER,
    llm_cost_usd NUMERIC(10, 6),
    
    UNIQUE(run_id, step_number)
);

CREATE INDEX idx_agent_run_steps_run ON app.agent_run_steps(run_id);
```

### 1.3 AgentRunMessages Table

Granular status messages for UI updates and debugging.

```sql
CREATE TYPE app.message_level AS ENUM ('debug', 'info', 'warn', 'error');

CREATE TABLE app.agent_run_messages (
    message_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES app.agent_runs(run_id) ON DELETE CASCADE,
    
    step_number INTEGER,  -- NULL for run-level messages
    level app.message_level NOT NULL DEFAULT 'info',
    message TEXT NOT NULL,
    details JSONB,  -- Optional structured data
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_run_messages_run ON app.agent_run_messages(run_id, created_at);
```

### 1.4 Graphile Worker Schema

Graphile Worker manages its own schema (`graphile_worker` by default). It creates tables for jobs, job queues, and known crontabs automatically on first run. No manual setup needed.

Key Graphile Worker tables (created automatically):
- `graphile_worker.jobs` - The job queue
- `graphile_worker.job_queues` - Queue definitions  
- `graphile_worker.known_crontabs` - For scheduled jobs (not used initially)

---

## 2. API Endpoints

### 2.1 Launch Agent

```
POST /api/agents/:agentType/run
```

**Request Body:**
```json
{
  "input": {
    "prompt": "Analyze this text...",
    "options": {}
  }
}
```

**Response (202 Accepted):**
```json
{
  "runId": "uuid",
  "status": "pending",
  "pollUrl": "/api/agents/runs/uuid",
  "createdAt": "2025-01-06T..."
}
```

**Implementation:**
1. Validate user authentication
2. Validate agent type exists
3. Insert row into `agent_runs`
4. Enqueue job with Graphile Worker (using `quickAddJob` or SQL function)
5. Update `graphile_job_id` in agent_runs
6. Return run_id to client

### 2.2 Get Run Status

```
GET /api/agents/runs/:runId
```

**Query Params:**
- `includeMessages=true` - Include status messages
- `messagesSince=timestamp` - Only messages after this time (for efficient polling)

**Response:**
```json
{
  "runId": "uuid",
  "agentType": "simple",
  "status": "running",
  "currentStep": 2,
  "totalSteps": 3,
  "input": {},
  "output": null,
  "error": null,
  "createdAt": "...",
  "startedAt": "...",
  "completedAt": null,
  "messages": [
    {
      "messageId": "uuid",
      "level": "info",
      "message": "Starting LLM call to GPT-4.1-nano",
      "stepNumber": 1,
      "createdAt": "..."
    }
  ]
}
```

### 2.3 Cancel Run

```
POST /api/agents/runs/:runId/cancel
```

**Response (200 OK):**
```json
{
  "runId": "uuid",
  "status": "cancel_requested",
  "message": "Cancellation requested. Run will stop after current step."
}
```

**Implementation:**
1. Check run belongs to user
2. Check run is in `pending` or `running` status
3. Update status to `cancel_requested`
4. If `pending`, also remove the job from Graphile Worker queue directly
5. Return acknowledgment

### 2.4 List User Runs

```
GET /api/agents/runs
```

**Query Params:**
- `status` - Filter by status
- `agentType` - Filter by agent type
- `limit` - Default 20, max 100
- `offset` - For pagination

**Response:**
```json
{
  "runs": [...],
  "total": 47,
  "limit": 20,
  "offset": 0
}
```

---

## 3. Worker Architecture

### 3.1 Graphile Worker Setup

```typescript
// src/worker/tasks/agent-run.ts
import { Task } from 'graphile-worker';
import { AgentExecutor } from '../executor';
import { getDb } from '../../db';

interface AgentRunPayload {
  runId: string;
}

export const agentRun: Task = async (payload, helpers) => {
  const { runId } = payload as AgentRunPayload;
  const db = getDb();
  const executor = new AgentExecutor(runId, db);
  
  try {
    await executor.execute();
  } catch (error) {
    // AgentExecutor handles its own error recording
    // Re-throw so Graphile Worker marks job as failed
    helpers.logger.error(`Agent run ${runId} failed: ${error.message}`);
    throw error;
  }
};
```

### 3.2 Task List Export

```typescript
// src/worker/tasks/index.ts
import { agentRun } from './agent-run';

export const taskList = {
  'agent-run': agentRun,
};
```

### 3.3 Worker Process

```typescript
// src/worker/index.ts
import { run, Runner } from 'graphile-worker';
import { taskList } from './tasks';
import { getDbPool } from '../db';

let runner: Runner | null = null;

async function startWorker() {
  const pool = getDbPool();
  
  runner = await run({
    pgPool: pool,
    taskList,
    concurrency: 5,  // Process up to 5 concurrent jobs
    noHandleSignals: false,  // Let Graphile Worker handle SIGTERM/SIGINT
    pollInterval: 1000,  // Check for new jobs every 1s
  });
  
  console.log('Worker started, listening for jobs...');
  
  // Wait for runner to finish (will block until shutdown signal)
  await runner.promise;
}

startWorker().catch((err) => {
  console.error('Worker failed to start:', err);
  process.exit(1);
});
```

### 3.4 Adding Jobs from API Server

```typescript
// src/lib/queue.ts
import { quickAddJob } from 'graphile-worker';
import { getDbPool } from '../db';

export async function enqueueAgentRun(runId: string): Promise<bigint> {
  const pool = getDbPool();
  
  const job = await quickAddJob(
    { pgPool: pool },
    'agent-run',
    { runId },
    {
      maxAttempts: 1,  // We handle retries ourselves in agent_runs table
    }
  );
  
  return BigInt(job.id);
}
```

Alternative: Use SQL function directly for more control:

```typescript
// src/lib/queue.ts
import { getDbPool } from '../db';

export async function enqueueAgentRun(runId: string): Promise<bigint> {
  const pool = getDbPool();
  
  const result = await pool.query(
    `SELECT graphile_worker.add_job('agent-run', $1::json, max_attempts := 1) as job_id`,
    [JSON.stringify({ runId })]
  );
  
  return BigInt(result.rows[0].job_id);
}
```

### 3.5 Cancelling Pending Jobs

```typescript
// src/lib/queue.ts
export async function cancelPendingJob(jobId: bigint): Promise<boolean> {
  const pool = getDbPool();
  
  // Remove job if it hasn't started yet
  const result = await pool.query(
    `DELETE FROM graphile_worker.jobs 
     WHERE id = $1 AND locked_at IS NULL
     RETURNING id`,
    [jobId.toString()]
  );
  
  return result.rowCount > 0;
}
```

### 3.6 Worker Health Check

For Docker/orchestration, expose a simple health endpoint:

```typescript
// src/worker/health.ts
import express from 'express';

const healthApp = express();
let isHealthy = true;

healthApp.get('/health', (req, res) => {
  if (isHealthy) {
    res.status(200).json({ status: 'healthy' });
  } else {
    res.status(503).json({ status: 'unhealthy' });
  }
});

healthApp.listen(process.env.WORKER_HEALTH_PORT || 3001);

export function setUnhealthy() {
  isHealthy = false;
}
```

### 3.7 Shared Database Pool

Since both API server and worker need database access, and Graphile Worker needs a pool:

```typescript
// src/db/index.ts
import { Pool } from 'pg';

let pool: Pool | null = null;

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,  // Adjust based on concurrency needs
    });
  }
  return pool;
}

export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
```

---

## 4. Agent Class Design

### 4.1 Base Agent Class

```typescript
// src/agents/base-agent.ts
import { AgentContext, AgentStep, StepResult } from './types';

export abstract class BaseAgent {
  protected context: AgentContext;
  protected steps: AgentStep[] = [];
  
  constructor(context: AgentContext) {
    this.context = context;
  }
  
  // Subclasses define their steps
  abstract defineSteps(): AgentStep[];
  
  // Called before execution starts
  async initialize(): Promise<void> {}
  
  // Called after all steps complete (success or failure)
  async cleanup(): Promise<void> {}
  
  // Check if cancellation was requested
  protected async checkCancellation(): Promise<boolean> {
    const run = await this.context.db.getAgentRun(this.context.runId);
    return run.status === 'cancel_requested';
  }
  
  // Log a status message
  protected async log(
    message: string, 
    level: 'debug' | 'info' | 'warn' | 'error' = 'info',
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.context.db.insertRunMessage({
      runId: this.context.runId,
      stepNumber: this.context.currentStep,
      level,
      message,
      details,
    });
  }
}
```

### 4.2 Agent Step Definition

```typescript
// src/agents/types.ts
export interface AgentStep {
  name: string;
  type: 'llm' | 'code' | 'external_api';
  execute: (input: unknown, context: AgentContext) => Promise<StepResult>;
  // Optional: transform previous step's output before passing to this step
  transformInput?: (previousOutput: unknown) => unknown;
  // Optional: skip this step based on conditions
  shouldSkip?: (previousOutput: unknown, context: AgentContext) => boolean;
}

export interface StepResult {
  output: unknown;
  metadata?: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    costUsd?: number;
  };
}

export interface AgentContext {
  runId: string;
  userId: string;
  input: Record<string, unknown>;
  currentStep: number;
  db: DatabaseClient;
  openai: OpenAIClient;
  // Accumulated outputs from previous steps
  stepOutputs: Map<string, unknown>;
}
```

### 4.3 Agent Executor

Orchestrates running an agent with step tracking and cancellation.

```typescript
// src/worker/executor.ts
import { BaseAgent } from '../agents/base-agent';
import { AgentRegistry } from '../agents/registry';

export class AgentExecutor {
  private runId: string;
  private db: DatabaseClient;
  
  constructor(runId: string, db: DatabaseClient) {
    this.runId = runId;
    this.db = db;
  }
  
  async execute(): Promise<void> {
    // 1. Load run from database
    const run = await this.db.getAgentRun(this.runId);
    
    // 2. Update status to running
    await this.db.updateAgentRun(this.runId, {
      status: 'running',
      startedAt: new Date(),
    });
    
    // 3. Instantiate the correct agent class
    const AgentClass = AgentRegistry.get(run.agentType);
    const context = this.buildContext(run);
    const agent = new AgentClass(context);
    
    try {
      await agent.initialize();
      
      const steps = agent.defineSteps();
      await this.db.updateAgentRun(this.runId, { totalSteps: steps.length });
      
      let lastOutput: unknown = run.inputPayload;
      
      // 4. Execute each step
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        context.currentStep = i + 1;
        
        // Check for cancellation between steps
        if (await agent.checkCancellation()) {
          await this.handleCancellation();
          return;
        }
        
        // Check if step should be skipped
        if (step.shouldSkip?.(lastOutput, context)) {
          await this.recordStepSkipped(i + 1, step.name);
          continue;
        }
        
        // Transform input if needed
        const stepInput = step.transformInput 
          ? step.transformInput(lastOutput) 
          : lastOutput;
        
        // Execute step with error handling
        const result = await this.executeStep(i + 1, step, stepInput, context);
        
        lastOutput = result.output;
        context.stepOutputs.set(step.name, result.output);
        
        // Update progress
        await this.db.updateAgentRun(this.runId, { currentStep: i + 1 });
      }
      
      // 5. Mark as completed
      await this.db.updateAgentRun(this.runId, {
        status: 'completed',
        outputPayload: lastOutput,
        completedAt: new Date(),
      });
      
    } catch (error) {
      await this.handleError(error);
      throw error;  // Re-throw for Graphile Worker
    } finally {
      await agent.cleanup();
    }
  }
  
  private async executeStep(
    stepNumber: number,
    step: AgentStep,
    input: unknown,
    context: AgentContext
  ): Promise<StepResult> {
    // Record step start
    await this.db.insertRunStep({
      runId: this.runId,
      stepNumber,
      stepName: step.name,
      stepType: step.type,
      inputData: input,
      status: 'running',
      startedAt: new Date(),
    });
    
    const startTime = Date.now();
    
    try {
      const result = await step.execute(input, context);
      
      // Record step completion
      await this.db.updateRunStep(this.runId, stepNumber, {
        status: 'completed',
        outputData: result.output,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
        ...result.metadata,
      });
      
      return result;
      
    } catch (error) {
      await this.db.updateRunStep(this.runId, stepNumber, {
        status: 'failed',
        errorMessage: error.message,
        completedAt: new Date(),
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  }
  
  private async handleCancellation(): Promise<void> {
    await this.db.updateAgentRun(this.runId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
    await this.db.insertRunMessage({
      runId: this.runId,
      level: 'info',
      message: 'Run cancelled by user request',
    });
  }
  
  private async handleError(error: Error): Promise<void> {
    const run = await this.db.getAgentRun(this.runId);
    
    // Check if we should retry
    if (this.isRetryableError(error) && run.retryCount < run.maxRetries) {
      await this.db.updateAgentRun(this.runId, {
        status: 'pending',
        retryCount: run.retryCount + 1,
      });
      await this.db.insertRunMessage({
        runId: this.runId,
        level: 'warn',
        message: `Retrying after error: ${error.message}`,
        details: { retryCount: run.retryCount + 1 },
      });
      // Re-enqueue with Graphile Worker
      await this.requeue();
    } else {
      await this.db.updateAgentRun(this.runId, {
        status: 'failed',
        errorMessage: error.message,
        errorDetails: { stack: error.stack },
        completedAt: new Date(),
      });
    }
  }
  
  private async requeue(): Promise<void> {
    const pool = this.db.getPool();
    const run = await this.db.getAgentRun(this.runId);
    
    // Graphile Worker supports run_at for delayed execution
    const delaySeconds = this.getRetryDelay(run.retryCount);
    
    await pool.query(
      `SELECT graphile_worker.add_job(
        'agent-run', 
        $1::json, 
        run_at := now() + interval '1 second' * $2,
        max_attempts := 1
      )`,
      [JSON.stringify({ runId: this.runId }), delaySeconds]
    );
  }
  
  private getRetryDelay(retryCount: number): number {
    // Exponential backoff: 1s, 5s, 15s
    const delays = [1, 5, 15];
    return delays[Math.min(retryCount, delays.length - 1)];
  }
  
  private isRetryableError(error: Error): boolean {
    // Retry on network/rate limit errors
    const retryablePatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'rate_limit',
      '429',
      '503',
      '502',
    ];
    return retryablePatterns.some(p => 
      error.message.includes(p) || error.name.includes(p)
    );
  }
}
```

### 4.4 Example Simple Agent

```typescript
// src/agents/simple-agent.ts
import { BaseAgent } from './base-agent';
import { AgentStep, StepResult } from './types';

export class SimpleAgent extends BaseAgent {
  defineSteps(): AgentStep[] {
    return [
      {
        name: 'llm_call',
        type: 'llm',
        execute: async (input, context): Promise<StepResult> => {
          await this.log('Starting LLM call to GPT-4.1-nano');
          
          const response = await context.openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
              { role: 'user', content: input.prompt }
            ],
          });
          
          await this.log('LLM call completed', 'info', {
            tokens: response.usage?.total_tokens,
          });
          
          return {
            output: {
              text: response.choices[0].message.content,
              raw: response,
            },
            metadata: {
              model: 'gpt-4.1-nano',
              promptTokens: response.usage?.prompt_tokens,
              completionTokens: response.usage?.completion_tokens,
            },
          };
        },
      },
    ];
  }
}
```

### 4.5 Example Multi-Step Agent

```typescript
// src/agents/analysis-agent.ts
import { BaseAgent } from './base-agent';
import { AgentStep, StepResult } from './types';

export class AnalysisAgent extends BaseAgent {
  defineSteps(): AgentStep[] {
    return [
      {
        name: 'extract_entities',
        type: 'llm',
        execute: async (input, context): Promise<StepResult> => {
          await this.log('Extracting entities from text');
          
          const response = await context.openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
              { 
                role: 'system', 
                content: 'Extract all named entities. Return JSON array.' 
              },
              { role: 'user', content: input.text }
            ],
            response_format: { type: 'json_object' },
          });
          
          const entities = JSON.parse(response.choices[0].message.content);
          await this.log(`Found ${entities.length} entities`);
          
          return { output: { entities, originalText: input.text } };
        },
      },
      {
        name: 'process_entities',
        type: 'code',
        execute: async (input, context): Promise<StepResult> => {
          await this.log('Processing and deduplicating entities');
          
          // TypeScript processing step
          const unique = [...new Set(input.entities.map(e => e.name))];
          const sorted = unique.sort();
          
          return { 
            output: { 
              processedEntities: sorted,
              originalText: input.originalText,
            } 
          };
        },
      },
      {
        name: 'generate_summary',
        type: 'llm',
        execute: async (input, context): Promise<StepResult> => {
          await this.log('Generating summary with entity context');
          
          const response = await context.openai.chat.completions.create({
            model: 'gpt-4.1-nano',
            messages: [
              { 
                role: 'system', 
                content: `Summarize focusing on these entities: ${input.processedEntities.join(', ')}` 
              },
              { role: 'user', content: input.originalText }
            ],
          });
          
          return {
            output: {
              summary: response.choices[0].message.content,
              entities: input.processedEntities,
            },
          };
        },
      },
    ];
  }
}
```

---

## 5. Status Polling Mechanism

### 5.1 Frontend Polling Strategy

```typescript
// Frontend: src/lib/agent-poller.ts
interface PollOptions {
  runId: string;
  onUpdate: (run: AgentRun) => void;
  onComplete: (run: AgentRun) => void;
  onError: (error: Error) => void;
  intervalMs?: number;
}

export class AgentPoller {
  private intervalId: number | null = null;
  private lastMessageTime: string | null = null;
  
  constructor(private options: PollOptions) {}
  
  start() {
    const interval = this.options.intervalMs || 1000;
    
    this.poll();  // Initial poll immediately
    this.intervalId = setInterval(() => this.poll(), interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  private async poll() {
    try {
      const params = new URLSearchParams({
        includeMessages: 'true',
        ...(this.lastMessageTime && { messagesSince: this.lastMessageTime }),
      });
      
      const response = await fetch(
        `/api/agents/runs/${this.options.runId}?${params}`
      );
      
      if (!response.ok) throw new Error('Failed to fetch status');
      
      const run = await response.json();
      
      // Track latest message time for efficient polling
      if (run.messages?.length > 0) {
        this.lastMessageTime = run.messages[run.messages.length - 1].createdAt;
      }
      
      this.options.onUpdate(run);
      
      // Stop polling on terminal states
      if (['completed', 'failed', 'cancelled'].includes(run.status)) {
        this.stop();
        this.options.onComplete(run);
      }
      
    } catch (error) {
      this.options.onError(error);
    }
  }
}
```

### 5.2 Adaptive Polling

For longer-running jobs, increase the interval over time:

```typescript
private getInterval(): number {
  const elapsed = Date.now() - this.startTime;
  
  if (elapsed < 10_000) return 500;    // First 10s: poll every 500ms
  if (elapsed < 60_000) return 1000;   // 10s-1min: every 1s
  if (elapsed < 300_000) return 3000;  // 1-5min: every 3s
  return 5000;                          // After 5min: every 5s
}
```

---

## 6. Cancellation Flow

```
┌─────────┐     POST /cancel     ┌─────────────────┐
│   FE    │ ──────────────────▶  │   API Server    │
└─────────┘                      └────────┬────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ UPDATE agent_runs     │
                              │ SET status =          │
                              │ 'cancel_requested'    │
                              └───────────┬───────────┘
                                          │
          ┌───────────────────────────────┼───────────────────────────────┐
          │                               │                               │
          ▼                               ▼                               ▼
   ┌─────────────┐               ┌─────────────┐               ┌─────────────┐
   │ If PENDING  │               │ If RUNNING  │               │ If terminal │
   │ DELETE from │               │ Worker sees │               │ Return      │
   │ graphile_   │               │ flag between│               │ error 400   │
   │ worker.jobs │               │ steps       │               │             │
   └─────────────┘               └─────────────┘               └─────────────┘
```

---

## 7. Error Handling Strategy

### 7.1 Error Categories

| Category | Examples | Retry? | User Message |
|----------|----------|--------|--------------|
| Transient | Network timeout, 429 rate limit, 503 | Yes (3x) | "Temporary issue, retrying..." |
| Permanent | Invalid input, auth failure, 400 | No | Show actual error |
| System | Out of memory, disk full | No | "System error, please try again later" |

### 7.2 Retry with Exponential Backoff

We handle retries ourselves rather than using Graphile Worker's built-in retry mechanism. This gives us more control over retry logic and allows us to track retry count in our `agent_runs` table.

```typescript
private async requeue(): Promise<void> {
  const pool = this.db.getPool();
  const delaySeconds = this.getRetryDelay();
  
  await pool.query(
    `SELECT graphile_worker.add_job(
      'agent-run', 
      $1::json, 
      run_at := now() + interval '1 second' * $2,
      max_attempts := 1
    )`,
    [JSON.stringify({ runId: this.runId }), delaySeconds]
  );
}

private getRetryDelay(): number {
  // Exponential backoff: 1s, 5s, 15s
  const delays = [1, 5, 15];
  return delays[Math.min(this.retryCount, delays.length - 1)];
}
```

### 7.3 Dead Letter Handling

After max retries, jobs remain in `failed` status for inspection. Consider a periodic cleanup job:

```typescript
// Clean up old failed runs (keep 30 days)
await db.query(`
  DELETE FROM app.agent_runs 
  WHERE status = 'failed' 
    AND completed_at < now() - interval '30 days'
`);
```

---

## 8. File Structure

```
agent-runner/
├── src/
│   ├── server/                    # Express API server
│   │   ├── index.ts
│   │   ├── routes/
│   │   │   ├── agents.ts          # /api/agents/* routes
│   │   │   └── health.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── error-handler.ts
│   │
│   ├── worker/                    # Worker process
│   │   ├── index.ts               # Entry point
│   │   ├── tasks/                 # Graphile Worker task definitions
│   │   │   ├── index.ts           # Task list export
│   │   │   └── agent-run.ts       # Agent run task
│   │   ├── executor.ts            # AgentExecutor
│   │   └── health.ts              # Health check endpoint
│   │
│   ├── agents/                    # Agent definitions
│   │   ├── base-agent.ts
│   │   ├── types.ts
│   │   ├── registry.ts            # Agent type registry
│   │   ├── simple-agent.ts
│   │   └── analysis-agent.ts
│   │
│   ├── db/                        # Database layer
│   │   ├── index.ts               # Connection pool
│   │   ├── agent-runs.ts          # CRUD for agent_runs
│   │   ├── run-steps.ts           # CRUD for agent_run_steps
│   │   └── run-messages.ts        # CRUD for agent_run_messages
│   │
│   ├── lib/                       # Shared utilities
│   │   ├── openai.ts              # OpenAI client setup
│   │   ├── queue.ts               # Job queue helpers (enqueue, cancel)
│   │   ├── errors.ts              # Custom error classes
│   │   └── config.ts              # Environment config
│   │
│   └── public/                    # Static frontend
│       ├── index.html
│       └── js/
│           ├── app.js
│           └── agent-poller.js
│
├── migrations/                    # Database migrations
│   ├── 001_create_agent_runs.sql
│   ├── 002_create_run_steps.sql
│   └── 003_create_run_messages.sql
│
├── docker/
│   ├── Dockerfile.server
│   ├── Dockerfile.worker
│   └── docker-compose.yml
│
├── scripts/
│   ├── start-server.sh
│   ├── start-worker.sh
│   └── migrate.sh
│
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 9. Deployment Considerations

### 9.1 Docker Compose (Development/Staging)

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:18
    environment:
      POSTGRES_DB: agent_runner
      POSTGRES_USER: app
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d agent_runner"]
      interval: 5s
      timeout: 5s
      retries: 5

  server:
    build:
      context: ..
      dockerfile: docker/Dockerfile.server
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@postgres:5432/agent_runner
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      PORT: 3000
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy

  worker:
    build:
      context: ..
      dockerfile: docker/Dockerfile.worker
    environment:
      DATABASE_URL: postgres://app:${DB_PASSWORD}@postgres:5432/agent_runner
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      WORKER_HEALTH_PORT: 3001
    ports:
      - "3001:3001"
    depends_on:
      postgres:
        condition: service_healthy
    deploy:
      replicas: 1  # Scale up for more concurrency

volumes:
  pgdata:
```

### 9.2 Bare VPS Deployment

```bash
# Systemd service for server
# /etc/systemd/system/agent-runner-server.service
[Unit]
Description=Agent Runner API Server
After=network.target postgresql.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/agent-runner
ExecStart=/usr/bin/node dist/server/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/agent-runner/.env

[Install]
WantedBy=multi-user.target
```

```bash
# Systemd service for worker
# /etc/systemd/system/agent-runner-worker.service
[Unit]
Description=Agent Runner Worker
After=network.target postgresql.service

[Service]
Type=simple
User=app
WorkingDirectory=/opt/agent-runner
ExecStart=/usr/bin/node dist/worker/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/opt/agent-runner/.env

[Install]
WantedBy=multi-user.target
```

### 9.3 SOC2 Compliance Considerations

For eventual SOC2 deployment:

1. **Logging**: Structured JSON logs with request IDs for audit trails
2. **Encryption**: TLS for all connections, encryption at rest for PII
3. **Access Control**: Service accounts with minimal privileges
4. **Secrets Management**: Use a vault (HashiCorp Vault, AWS Secrets Manager)
5. **Monitoring**: Health checks, error rate alerts, latency monitoring
6. **Data Retention**: Configurable retention policies with hard deletes
7. **Audit Trail**: The `agent_run_messages` table provides this naturally

---

## 10. Implementation Order

Recommended build sequence:

1. **Database**: Run migrations, set up connection pool
2. **Basic API**: POST `/run`, GET `/status` (no worker yet, just enqueue)
3. **Worker skeleton**: Dequeue jobs, update status, no actual agent logic
4. **Simple agent**: Single LLM call, end-to-end test
5. **Status messages**: Add logging, verify polling works
6. **Cancellation**: Implement cancel flow
7. **Error handling**: Add retry logic
8. **Multi-step agent**: Build AnalysisAgent to test step tracking
9. **Polish**: Frontend UI, Docker Compose, documentation

---

## 11. Graphile Worker Notes

### Key Differences from Other Queue Libraries

1. **Task-based model**: Define tasks as functions in a task list, not event handlers
2. **Schema auto-creation**: Graphile Worker creates its `graphile_worker` schema automatically
3. **SQL-native**: Can add jobs directly via SQL function `graphile_worker.add_job()`
4. **Shared pool**: Uses your existing pg Pool rather than managing its own connections
5. **Graceful shutdown**: Handles SIGTERM/SIGINT by default, completes in-progress jobs

### Useful SQL Functions

```sql
-- Add a job
SELECT graphile_worker.add_job('task-name', '{"key": "value"}'::json);

-- Add a delayed job
SELECT graphile_worker.add_job(
  'task-name', 
  '{"key": "value"}'::json,
  run_at := now() + interval '5 minutes'
);

-- Add a job with specific queue (for rate limiting)
SELECT graphile_worker.add_job(
  'task-name', 
  '{"key": "value"}'::json,
  queue_name := 'slow-queue'
);
```

### Monitoring Queries

```sql
-- Jobs waiting to be processed
SELECT * FROM graphile_worker.jobs 
WHERE locked_at IS NULL 
ORDER BY run_at;

-- Jobs currently being processed
SELECT * FROM graphile_worker.jobs 
WHERE locked_at IS NOT NULL;

-- Failed jobs (in last 24h)
SELECT * FROM graphile_worker.jobs 
WHERE last_error IS NOT NULL 
  AND created_at > now() - interval '24 hours';
```

---

## Open Questions (Resolved)

1. **Authentication for API**: ✅ Using existing auth middleware
2. **Rate limiting**: ✅ No per-user limits for now
3. **Cost tracking**: ✅ Will track per step and per run
4. **Webhook support**: ✅ Polling-only for now
