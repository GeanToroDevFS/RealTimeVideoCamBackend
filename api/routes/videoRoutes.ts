import express from 'express';
import { db } from '../config/firebase';

const router = express.Router();

const PORT = process.env.PORT || 10001;  // Cambiado para video
const allowedOrigins = [
  'https://frontend-real-time.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'https://realtime-frontend.vercel.app'
];

router.get('/', (req, res) => {
  console.log('🚀 [HEALTH] Solicitud de health check en video');
  res.header('Content-Type', 'text/plain');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.send('🚀 Backend de video para RealTime funcionando correctamente.\n' +
    'Servicio: RealTime Video Backend\n' +
    `Puerto: ${PORT}\n` +
    'Peer.js: Disponible\n' +
    'CORS: Habilitado\n' +
    `Timestamp: ${new Date().toISOString()}`);
});

router.get('/debug', (req, res) => {
  console.log('🔍 [DEBUG] Solicitud de información de debug en video');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
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

router.get('/peerjs/health', (req, res) => {
  console.log('📡 [PEER] Health check solicitado');
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.json({
    status: 'running',
    endpoint: 'https://realtimevideocambackend.onrender.com/peerjs',
    webSocketEndpoint: 'wss://realtimevideocambackend.onrender.com/peerjs',
    cors: 'enabled',
    timestamp: new Date().toISOString()
  });
});

// Nuevo: Endpoint para ICE servers
router.get('/ice-servers', (req, res) => {
  res.json({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
});

router.get('/debug/headers', (req, res) => {
  console.log('🔍 [HEADERS] Solicitud recibida:', req.headers);

  res.json({
    method: req.method,
    origin: req.headers.origin,
    host: req.headers.host,
    userAgent: req.headers['user-agent'],
    headers: req.headers,
    yourBackendUrl: 'https://realtimevideocambackend.onrender.com',
    timestamp: new Date().toISOString()
  });
});

export default router;