import { BaseAgent } from './base-agent';
import { AgentContext } from './types';

type AgentConstructor = new (context: AgentContext) => BaseAgent;

const registry = new Map<string, AgentConstructor>();

export const AgentRegistry = {
  register(agentType: string, AgentClass: AgentConstructor): void {
    registry.set(agentType, AgentClass);
  },

  get(agentType: string): AgentConstructor {
    const AgentClass = registry.get(agentType);
    if (!AgentClass) {
      throw new Error(`Unknown agent type: ${agentType}`);
    }
    return AgentClass;
  },

  has(agentType: string): boolean {
    return registry.has(agentType);
  },
};
