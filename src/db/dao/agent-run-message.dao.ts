import { BaseDAO } from './base.dao';
import { AgentRunMessage, CreateAgentRunMessageDto } from '../../types/agent';
import { PoolClient } from 'pg';

export class AgentRunMessageDAO extends BaseDAO {
  async create(
    data: CreateAgentRunMessageDto,
    client?: PoolClient
  ): Promise<AgentRunMessage> {
    const query = `
      INSERT INTO app.agent_run_messages (agent_run_id, step_number, level, message, details)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const params = [
      data.agentRunId,
      data.stepNumber ?? null,
      data.level || 'info',
      data.message,
      data.details ? JSON.stringify(data.details) : null,
    ];
    const result = await this.executeQuerySingle<AgentRunMessage>(query, params, client);
    if (!result) {
      throw new Error('Failed to create agent run message');
    }
    return result;
  }

  async findByRunId(
    agentRunId: string,
    since?: Date,
    client?: PoolClient
  ): Promise<AgentRunMessage[]> {
    let query: string;
    let params: unknown[];

    if (since) {
      query = `
        SELECT * FROM app.agent_run_messages
        WHERE agent_run_id = $1 AND created_at > $2
        ORDER BY created_at ASC
      `;
      params = [agentRunId, since];
    } else {
      query = `
        SELECT * FROM app.agent_run_messages
        WHERE agent_run_id = $1
        ORDER BY created_at ASC
      `;
      params = [agentRunId];
    }

    return this.executeQuery<AgentRunMessage>(query, params, client);
  }
}
