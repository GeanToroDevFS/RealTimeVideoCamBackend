import express from 'express';
import { db } from '../config/firebase';

/**
 * Router exposing operational endpoints used by health checks, debugging tools and WebRTC helpers.
 */
const router = express.Router();

const PORT = process.env.PORT || 10001;  // Cambiado para video
const allowedOrigins = [
  'https://frontend-real-time.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://realtime-frontend.vercel.app'
];

router.use((req, res, next) => {
  const origin = req.headers.origin || '';
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }

  next();
});

/**
 * Basic health endpoint used by uptime monitoring to ensure the video backend is alive.
 *
 * @param req Express request.
 * @param res Express response returning a plaintext report.
 */
router.get('/', (req, res) => {
  console.log('🚀 [HEALTH] Solicitud de health check en video');
  res.header('Content-Type', 'text/plain');
  res.send('🚀 Backend de video para RealTime funcionando correctamente.\n' +
    'Servicio: RealTime Video Backend\n' +
    `Puerto: ${PORT}\n` +
    'Peer.js: Disponible\n' +
    'CORS: Habilitado\n' +
    `Timestamp: ${new Date().toISOString()}`);
});

/**
 * Provides an at-a-glance view of environment variables and service readiness intended for
 * debugging deployments.
 *
 * @param req Express request.
 * @param res Express response delivering diagnostic JSON.
 */
router.get('/debug', (req, res) => {
  console.log('🔍 [DEBUG] Solicitud de información de debug en video');
  res.json({
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID ? '✅ Configurado' : '❌ No configurado',
    socketIo: '✅ Inicializado',
    peerJs: '✅ Inicializado',
    peerJsPath: '/peerjs',
    cors: {
      enabled: true,
      origins: allowedOrigins
    }
  });
});

/**
 * Reports the status of the Peer.js endpoint exposed by the backend.
 *
 * @param req Express request.
 * @param res Express response containing availability data.
 */
router.get('/peerjs/health', (req, res) => {
  console.log('📡 [PEER] Health check solicitado');
  res.json({
    status: 'running',
    endpoint: 'https://realtimevideocambackend.onrender.com/peerjs',
    webSocketEndpoint: 'wss://realtimevideocambackend.onrender.com/peerjs',
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// Nuevo: Endpoint para ICE servers
/**
 * Shares STUN server configuration used by the frontend to establish WebRTC connections.
 *
 * @param req Express request.
 * @param res Express response with ICE server definitions.
 */
router.get('/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
});

export default router;