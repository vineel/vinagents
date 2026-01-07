import { Task } from 'graphile-worker';
import { agentRun } from './agent-run';

export const taskList: { [name: string]: Task } = {
  'agent-run': agentRun,
};
