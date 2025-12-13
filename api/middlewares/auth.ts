import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Express middleware that validates JWT tokens coming from the Authorization header.
 *
 * @param req Express request enriched with a user payload on success.
 * @param res Express response used to signal authorization failures.
 * @param next Callback that continues the middleware chain when the token is valid.
 */
export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('⚠️ [AUTH] Token not provided');
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      console.error('❌ [AUTH] Invalid token:', err.message);
      return res.status(403).json({ error: 'Invalid token' });
    }

    (req as any).user = user;
    next();
  });
};