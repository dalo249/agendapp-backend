import { Router, Request, Response } from 'express';
import authRouter from './auth.router';
import sessionRouter from './session.router';


const apiRouter = Router();

// Health
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    },
  });
});

// Modulos
apiRouter.use('/auth', authRouter);
apiRouter.use('/sessions', sessionRouter);

export default apiRouter;