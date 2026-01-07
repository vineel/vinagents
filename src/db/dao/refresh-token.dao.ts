import { BaseDAO } from './base.dao';
import { RefreshToken, CreateRefreshTokenDto } from '../../types';
import { PoolClient } from 'pg';

export class RefreshTokenDAO extends BaseDAO {
  async findByToken(token: string, client?: PoolClient): Promise<RefreshToken | null> {
    const query = `
      SELECT refresh_token_id, token, user_id, expires_at, created_at
      FROM app.refresh_tokens
      WHERE token = $1
    `;
    return this.executeQuerySingle<RefreshToken>(query, [token], client);
  }

  async findByUserId(userId: string, client?: PoolClient): Promise<RefreshToken[]> {
    const query = `
      SELECT refresh_token_id, token, user_id, expires_at, created_at
      FROM app.refresh_tokens
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    return this.executeQuery<RefreshToken>(query, [userId], client);
  }

  async create(data: CreateRefreshTokenDto, client?: PoolClient): Promise<RefreshToken> {
    const query = `
      INSERT INTO app.refresh_tokens (token, user_id, expires_at)
      VALUES ($1, $2, $3)
      RETURNING refresh_token_id, token, user_id, expires_at, created_at
    `;
    const params = [data.token, data.userId, data.expiresAt];
    const result = await this.executeQuerySingle<RefreshToken>(query, params, client);
    if (!result) {
      throw new Error('Failed to create refresh token');
    }
    return result;
  }

  async delete(token: string, client?: PoolClient): Promise<boolean> {
    const query = 'DELETE FROM app.refresh_tokens WHERE token = $1';
    const result = await (client || this.pool).query(query, [token]);
    return (result.rowCount ?? 0) > 0;
  }

  async deleteByUserId(userId: string, client?: PoolClient): Promise<number> {
    const query = 'DELETE FROM app.refresh_tokens WHERE user_id = $1';
    const result = await (client || this.pool).query(query, [userId]);
    return result.rowCount ?? 0;
  }

  async deleteExpired(client?: PoolClient): Promise<number> {
    const query = 'DELETE FROM app.refresh_tokens WHERE expires_at < NOW()';
    const result = await (client || this.pool).query(query);
    return result.rowCount ?? 0;
  }
}
