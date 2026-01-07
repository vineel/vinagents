import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { UserDAO } from '../db/dao/user.dao';
import { NotFoundError } from '../utils/errors';

export class UserController {
  private userDAO: UserDAO;

  constructor() {
    this.userDAO = new UserDAO();
  }

  getMe = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        throw new NotFoundError('User not found');
      }

      const user = await this.userDAO.findById(req.user.userId);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      const { password, ...sanitizedUser } = user;

      res.status(200).json({
        status: 'success',
        data: { user: sanitizedUser },
      });
    } catch (error) {
      next(error);
    }
  };

  getAll = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;

      const users = await this.userDAO.findAll(limit, offset);
      const sanitizedUsers = users.map(({ password, ...user }) => user);

      res.status(200).json({
        status: 'success',
        data: {
          users: sanitizedUsers,
          pagination: {
            limit,
            offset,
            count: sanitizedUsers.length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
