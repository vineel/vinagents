import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserDAO } from '../db/dao/user.dao';
import { RefreshTokenDAO } from '../db/dao/refresh-token.dao';
import { config } from '../config/env';
import {
  UnauthorizedError,
  ConflictError,
} from '../utils/errors';

export class AuthService {
  private userDAO: UserDAO;
  private refreshTokenDAO: RefreshTokenDAO;

  constructor() {
    this.userDAO = new UserDAO();
    this.refreshTokenDAO = new RefreshTokenDAO();
  }

  async register(email: string, password: string, firstName?: string, lastName?: string) {
    const existingUser = await this.userDAO.findByEmail(email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await this.userDAO.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async login(email: string, password: string) {
    const user = await this.userDAO.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Account is disabled');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const { accessToken, refreshToken } = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      accessToken,
      refreshToken,
    };
  }

  async refresh(refreshToken: string) {
    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch (error) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const storedToken = await this.refreshTokenDAO.findByToken(refreshToken);
    if (!storedToken) {
      throw new UnauthorizedError('Refresh token not found');
    }

    if (new Date(storedToken.expiresAt) < new Date()) {
      await this.refreshTokenDAO.delete(refreshToken);
      throw new UnauthorizedError('Refresh token expired');
    }

    const user = await this.userDAO.findById(decoded.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    await this.refreshTokenDAO.delete(refreshToken);

    const tokens = await this.generateTokens(user.id, user.email);

    return {
      user: this.sanitizeUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  async logout(refreshToken: string) {
    await this.refreshTokenDAO.delete(refreshToken);
  }

  private async generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign(
      { id: userId, email },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      { id: userId, email },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    const decoded = jwt.decode(refreshToken) as { exp: number };
    const expiresAt = new Date(decoded.exp * 1000);

    await this.refreshTokenDAO.create({
      token: refreshToken,
      userId,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  private sanitizeUser(user: any) {
    const { password, ...sanitized } = user;
    return sanitized;
  }
}
