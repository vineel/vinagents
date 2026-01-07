import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import agentRoutes from './agent.routes';

const router = Router();

router.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/agents', agentRoutes);

export default router;
