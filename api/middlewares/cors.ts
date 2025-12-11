import { Request, Response, NextFunction } from 'express';

const allowedOrigins = [
  'https://frontend-real-time.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://realtime-frontend.vercel.app'
];

export const corsOptions = {
  origin: (origin: string | undefined, callback: Function) => {  // Corregido: Agregado 'undefined'
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1 || origin.includes('vercel.app')) {
      callback(null, true);
    } else {
      console.log('🚫 Origen bloqueado por CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  if (origin && (allowedOrigins.includes(origin) || origin.includes('vercel.app'))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};