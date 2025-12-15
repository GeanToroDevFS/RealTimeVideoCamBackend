import express from 'express';
import { db } from '../config/firebase';

/**
 * Router exposing operational endpoints used by health checks, debugging tools and WebRTC helpers.
 */
const router = express.Router();

const PORT = process.env.PORT || 10001; // Video backend

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
 * Health check
 */
router.get('/', (req, res) => {
  console.log('🚀 [HEALTH] Solicitud de health check en video');
  res.header('Content-Type', 'text/plain');

  res.send(
    '🚀 Backend de video para RealTime funcionando correctamente.\n' +
    'Servicio: RealTime Video Backend\n' +
    `Puerto: ${PORT}\n` +
    'Peer.js: Disponible\n' +
    'TURN: ExpressTURN\n' +
    'CORS: Habilitado\n' +
    `Timestamp: ${new Date().toISOString()}`
  );
});

/**
 * Debug endpoint
 */
router.get('/debug', (req, res) => {
  console.log('🔍 [DEBUG] Solicitud de información de debug en video');
  res.json({
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID
      ? '✅ Configurado'
      : '❌ No configurado',
    socketIo: '✅ Inicializado',
    peerJs: '✅ Inicializado',
    peerJsPath: '/peerjs',
    turnProvider: 'ExpressTURN',
    cors: {
      enabled: true,
      origins: allowedOrigins
    }
  });
});

/**
 * PeerJS health
 */
router.get('/peerjs/health', (req, res) => {
  console.log('📡 [PEER] Health check solicitado');
  res.json({
    status: 'running',
    endpoint: 'https://realtimevideocambackend.onrender.com/peerjs',
    webSocketEndpoint: 'wss://realtimevideocambackend.onrender.com/peerjs',
    cors: 'enabled',
    turn: 'ExpressTURN',
    timestamp: new Date().toISOString()
  });
});

/**
 * ICE servers (ExpressTURN)
 */
router.get('/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      {
        urls: [
          'turn:relay1.expressturn.com:3480?transport=udp',
          'turn:relay1.expressturn.com:3480?transport=tcp',
          'turns:relay1.expressturn.com:443'
        ],
        username: '000000002081173935',
        credential: 'gWuSuOJzycRF1q2lE3W/AjLFpfU='
      }
    ]
  });
});

export default router;
