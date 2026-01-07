import { AgentContext, AgentStep } from './types';

export abstract class BaseAgent {
  protected context: AgentContext;

  constructor(context: AgentContext) {
    this.context = context;
  }

  abstract defineSteps(): AgentStep[];

  async initialize(): Promise<void> {}
  async cleanup(): Promise<void> {}
}
