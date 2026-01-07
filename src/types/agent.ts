export type AgentRunStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'cancel_requested';

export type MessageLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentRun {
  agentRunId: string;
  userId: string;
  agentType: string;
  agentVersion: string;
  inputPayload: Record<string, unknown>;
  outputPayload: Record<string, unknown> | null;
  status: AgentRunStatus;
  currentStep: number;
  totalSteps: number | null;
  errorMessage: string | null;
  errorDetails: Record<string, unknown> | null;
  retryCount: number;
  maxRetries: number;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  updatedAt: Date;
  graphileJobId: string | null;
}

export interface AgentRunMessage {
  agentMessageId: string;
  agentRunId: string;
  stepNumber: number | null;
  level: MessageLevel;
  message: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
}

export interface CreateAgentRunDto {
  userId: string;
  agentType: string;
  inputPayload?: Record<string, unknown>;
}

export interface UpdateAgentRunDto {
  status?: AgentRunStatus;
  currentStep?: number;
  totalSteps?: number;
  outputPayload?: Record<string, unknown>;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  graphileJobId?: string;
  retryCount?: number;
}

export interface CreateAgentRunMessageDto {
  agentRunId: string;
  stepNumber?: number;
  level?: MessageLevel;
  message: string;
  details?: Record<string, unknown>;
}

export interface ListAgentRunsFilters {
  status?: AgentRunStatus;
  agentType?: string;
  limit?: number;
  offset?: number;
}

export interface GetRunStatusOptions {
  includeMessages?: boolean;
  messagesSince?: Date;
}
