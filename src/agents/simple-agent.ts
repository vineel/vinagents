import { BaseAgent } from './base-agent';
import { AgentStep, StepResult } from './types';
import { AgentRegistry } from './registry';

interface SimpleAgentInput {
  prompt: string;
}

export class SimpleAgent extends BaseAgent {
  defineSteps(): AgentStep[] {
    return [
      {
        name: 'llm_call',
        type: 'llm',
        execute: async (input, context): Promise<StepResult> => {
          const { prompt } = input as SimpleAgentInput;

          await context.log('Starting Claude API call');

          const response = await context.anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          });

          const textContent = response.content.find((c) => c.type === 'text');
          const outputText = textContent?.type === 'text' ? textContent.text : '';

          await context.log('Claude API call completed', 'info', {
            inputTokens: response.usage.input_tokens,
            outputTokens: response.usage.output_tokens,
          });

          return {
            output: { text: outputText },
            metadata: {
              model: response.model,
              inputTokens: response.usage.input_tokens,
              outputTokens: response.usage.output_tokens,
            },
          };
        },
      },
    ];
  }
}

AgentRegistry.register('simple', SimpleAgent);
