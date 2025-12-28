import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const userController = new UserController();

router.use(authenticate);

router.get('/me', userController.getMe);
router.get('/', userController.getAll);

export default router;
