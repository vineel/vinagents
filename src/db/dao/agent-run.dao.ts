import { BaseDAO } from './base.dao';
import {
  AgentRun,
  CreateAgentRunDto,
  UpdateAgentRunDto,
  ListAgentRunsFilters,
} from '../../types/agent';
import { PoolClient } from 'pg';

export class AgentRunDAO extends BaseDAO {
  async create(data: CreateAgentRunDto, client?: PoolClient): Promise<AgentRun> {
    const query = `
      INSERT INTO app.agent_runs (user_id, agent_type, input_payload)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const params = [
      data.userId,
      data.agentType,
      JSON.stringify(data.inputPayload || {}),
    ];
    const result = await this.executeQuerySingle<AgentRun>(query, params, client);
    if (!result) {
      throw new Error('Failed to create agent run');
    }
    return result;
  }

  async findById(agentRunId: string, client?: PoolClient): Promise<AgentRun | null> {
    const query = `
      SELECT * FROM app.agent_runs
      WHERE agent_run_id = $1
    `;
    return this.executeQuerySingle<AgentRun>(query, [agentRunId], client);
  }

  async findByIdAndUserId(
    agentRunId: string,
    userId: string,
    client?: PoolClient
  ): Promise<AgentRun | null> {
    const query = `
      SELECT * FROM app.agent_runs
      WHERE agent_run_id = $1 AND user_id = $2
    `;
    return this.executeQuerySingle<AgentRun>(query, [agentRunId, userId], client);
  }

  async findByUserId(
    userId: string,
    filters: ListAgentRunsFilters = {},
    client?: PoolClient
  ): Promise<AgentRun[]> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.agentType) {
      conditions.push(`agent_type = $${paramIndex++}`);
      params.push(filters.agentType);
    }

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;

    const query = `
      SELECT * FROM app.agent_runs
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(limit, offset);

    return this.executeQuery<AgentRun>(query, params, client);
  }

  async countByUserId(
    userId: string,
    filters: Omit<ListAgentRunsFilters, 'limit' | 'offset'> = {},
    client?: PoolClient
  ): Promise<number> {
    const conditions: string[] = ['user_id = $1'];
    const params: unknown[] = [userId];
    let paramIndex = 2;

    if (filters.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(filters.status);
    }

    if (filters.agentType) {
      conditions.push(`agent_type = $${paramIndex++}`);
      params.push(filters.agentType);
    }

    const query = `
      SELECT COUNT(*) as count FROM app.agent_runs
      WHERE ${conditions.join(' AND ')}
    `;

    const result = await this.executeQuerySingle<{ count: string }>(query, params, client);
    return parseInt(result?.count || '0', 10);
  }

  async update(
    agentRunId: string,
    data: UpdateAgentRunDto,
    client?: PoolClient
  ): Promise<AgentRun | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (data.status !== undefined) {
      fields.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.currentStep !== undefined) {
      fields.push(`current_step = $${paramIndex++}`);
      values.push(data.currentStep);
    }
    if (data.totalSteps !== undefined) {
      fields.push(`total_steps = $${paramIndex++}`);
      values.push(data.totalSteps);
    }
    if (data.outputPayload !== undefined) {
      fields.push(`output_payload = $${paramIndex++}`);
      values.push(JSON.stringify(data.outputPayload));
    }
    if (data.errorMessage !== undefined) {
      fields.push(`error_message = $${paramIndex++}`);
      values.push(data.errorMessage);
    }
    if (data.errorDetails !== undefined) {
      fields.push(`error_details = $${paramIndex++}`);
      values.push(JSON.stringify(data.errorDetails));
    }
    if (data.startedAt !== undefined) {
      fields.push(`started_at = $${paramIndex++}`);
      values.push(data.startedAt);
    }
    if (data.completedAt !== undefined) {
      fields.push(`completed_at = $${paramIndex++}`);
      values.push(data.completedAt);
    }
    if (data.graphileJobId !== undefined) {
      fields.push(`graphile_job_id = $${paramIndex++}`);
      values.push(data.graphileJobId);
    }
    if (data.retryCount !== undefined) {
      fields.push(`retry_count = $${paramIndex++}`);
      values.push(data.retryCount);
    }

    if (fields.length === 0) {
      return this.findById(agentRunId, client);
    }

    // Always update updated_at
    fields.push(`updated_at = NOW()`);

    values.push(agentRunId);
    const query = `
      UPDATE app.agent_runs
      SET ${fields.join(', ')}
      WHERE agent_run_id = $${paramIndex}
      RETURNING *
    `;

    return this.executeQuerySingle<AgentRun>(query, values, client);
  }

  async updateStatus(
    agentRunId: string,
    status: AgentRun['status'],
    additionalFields?: Partial<UpdateAgentRunDto>,
    client?: PoolClient
  ): Promise<AgentRun | null> {
    return this.update(agentRunId, { status, ...additionalFields }, client);
  }
}
