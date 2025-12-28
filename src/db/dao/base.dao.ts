import { Pool, PoolClient } from 'pg';
import { pool as defaultPool } from '../pool';

export abstract class BaseDAO {
  protected pool: Pool;

  constructor(pool?: Pool) {
    this.pool = pool || defaultPool;
  }

  protected async executeQuery<T>(
    query: string,
    params?: any[],
    client?: PoolClient
  ): Promise<T[]> {
    const execClient = client || this.pool;
    const result = await execClient.query(query, params);
    return result.rows;
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
