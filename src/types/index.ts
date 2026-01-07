export interface User {
  userId: string;
  email: string;
  password: string;
  firstName: string | null;
  lastName: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RefreshToken {
  refreshTokenId: string;
  token: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface CreateUserDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

export interface UpdateUserDto {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface CreateRefreshTokenDto {
  token: string;
  userId: string;
  expiresAt: Date;
}
