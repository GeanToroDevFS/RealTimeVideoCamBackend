import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('⚠️ [AUTH] Token no proporcionado');
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      console.error('❌ [AUTH] Token inválido:', err.message);
      return res.status(403).json({ error: 'Token inválido' });
    }

    (req as any).user = user;
    next();
  });
};