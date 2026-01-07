import { Pool, PoolClient } from 'pg';
import { pool as defaultPool } from '../pool';

export abstract class BaseDAO {
  protected pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || defaultPool;
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }

  private transformRow<T>(row: Record<string, unknown>): T {
    const transformed: Record<string, unknown> = {};
    for (const key of Object.keys(row)) {
      transformed[this.snakeToCamel(key)] = row[key];
    }
    return transformed as T;
  }

  protected async executeQuery<T>(
    query: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T[]> {
    const execClient = client || this.pool;
    const result = await execClient.query(query, params);
    return result.rows.map((row) => this.transformRow<T>(row));
  }

  protected async executeQuerySingle<T>(
    query: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T | null> {
    const rows = await this.executeQuery<T>(query, params, client);
    return rows.length > 0 ? rows[0] : null;
  }

  protected async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
