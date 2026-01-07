import Anthropic from '@anthropic-ai/sdk';

export interface AgentStep {
  name: string;
  type: 'llm' | 'code' | 'external_api';
  execute: (input: unknown, context: AgentContext) => Promise<StepResult>;
  transformInput?: (previousOutput: unknown) => unknown;
  shouldSkip?: (previousOutput: unknown, context: AgentContext) => boolean;
}

export interface StepResult {
  output: unknown;
  metadata?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface AgentContext {
  runId: string;
  userId: string;
  input: Record<string, unknown>;
  currentStep: number;
  anthropic: Anthropic;
  stepOutputs: Map<string, unknown>;
  log: (
    message: string,
    level?: 'debug' | 'info' | 'warn' | 'error',
    details?: Record<string, unknown>
  ) => Promise<void>;
  checkCancellation: () => Promise<boolean>;
}
