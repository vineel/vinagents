import { BaseDAO } from './base.dao';
import { User, CreateUserDto, UpdateUserDto } from '../../types';
import { PoolClient } from 'pg';

export class UserDAO extends BaseDAO {
  async findById(id: string, client?: PoolClient): Promise<User | null> {
    const query = `
      SELECT
        id, email, password, first_name as "firstName",
        last_name as "lastName", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE id = $1
    `;
    return this.executeQuerySingle<User>(query, [id], client);
  }

  async findByEmail(email: string, client?: PoolClient): Promise<User | null> {
    const query = `
      SELECT
        id, email, password, first_name as "firstName",
        last_name as "lastName", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      WHERE email = $1
    `;
    return this.executeQuerySingle<User>(query, [email], client);
  }

  async findAll(limit = 100, offset = 0): Promise<User[]> {
    const query = `
      SELECT
        id, email, password, first_name as "firstName",
        last_name as "lastName", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM users
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `;
    return this.executeQuery<User>(query, [limit, offset]);
  }

  async create(data: CreateUserDto, client?: PoolClient): Promise<User> {
    const query = `
      INSERT INTO users (email, password, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING
        id, email, password, first_name as "firstName",
        last_name as "lastName", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;
    const params = [
      data.email,
      data.password,
      data.firstName || null,
      data.lastName || null,
    ];
    const result = await this.executeQuerySingle<User>(query, params, client);
    if (!result) {
      throw new Error('Failed to create user');
    }
    return result;
  }

  async update(id: string, data: UpdateUserDto, client?: PoolClient): Promise<User | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.email !== undefined) {
      fields.push(`email = $${paramIndex++}`);
      values.push(data.email);
    }
    if (data.password !== undefined) {
      fields.push(`password = $${paramIndex++}`);
      values.push(data.password);
    }
    if (data.firstName !== undefined) {
      fields.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName);
    }
    if (data.lastName !== undefined) {
      fields.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName);
    }
    if (data.isActive !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(data.isActive);
    }

    if (fields.length === 0) {
      return this.findById(id, client);
    }

    values.push(id);
    const query = `
      UPDATE users
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING
        id, email, password, first_name as "firstName",
        last_name as "lastName", is_active as "isActive",
        created_at as "createdAt", updated_at as "updatedAt"
    `;

    return this.executeQuerySingle<User>(query, values, client);
  }

  async delete(id: string, client?: PoolClient): Promise<boolean> {
    const query = 'DELETE FROM users WHERE id = $1';
    const result = await (client || this.pool).query(query, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async exists(email: string, client?: PoolClient): Promise<boolean> {
    const query = 'SELECT EXISTS(SELECT 1 FROM users WHERE email = $1) as exists';
    const result = await this.executeQuerySingle<{ exists: boolean }>(query, [email], client);
    return result?.exists ?? false;
  }
}
