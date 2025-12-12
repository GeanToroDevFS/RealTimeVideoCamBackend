import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import cors from 'cors';
import { initializeVideo } from './services/videoService';
import { corsOptions, corsMiddleware } from './middlewares/cors';
import videoRoutes from './routes/videoRoutes';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 10001;

// 🔥 Aplicar middleware de CORS antes de cualquier otra ruta
app.use(cors(corsOptions));
app.use(corsMiddleware);

// 🔥 Configurar body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ===========================================================
   SOCKET.IO CONFIGURACIÓN MEJORADA
   =========================================================== */
const io = new SocketIOServer(server, {
  cors: {
    origin: corsOptions.origin,
    methods: ['GET', 'POST'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization']
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

/* ===========================================================
   PEER.JS CONFIGURACIÓN MEJORADA
   =========================================================== */
const peerOptions: any = {
  path: '/',
  debug: true,
  proxied: true,
  ssl: process.env.NODE_ENV === 'production',
  // Configuración para WebRTC
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' }
    ],
    iceTransportPolicy: 'all',
    rtcpMuxPolicy: 'require',
    bundlePolicy: 'max-bundle'
  }
};

console.log('🔧 [PEER] Configurando Peer.js con opciones:', peerOptions);

const peerServer = ExpressPeerServer(server, peerOptions);

/* ===========================================================
   RUTA PRINCIPAL
   =========================================================== */
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Servidor de Video RealTime</title>
    </head>
    <body>
      <h1>✅ Servidor de video funcionando</h1>
      <p>Peer.js disponible en: <code>/peerjs</code></p>
      <p>Socket.IO conectado</p>
      <p>Health check: <a href="/api/health">/api/health</a></p>
    </body>
    </html>
  `);
});

/* ===========================================================
   EVENTOS PEER.JS MEJORADOS
   =========================================================== */
peerServer.on('connection', (client: any) => {
  console.log(`🔗 [PEER] Cliente conectado: ${client.getId()}`);
  
  // Enviar ICE servers al cliente
  try {
    const iceServers = peerOptions.config?.iceServers || [];
    client.send({
      type: 'ice-servers',
      iceServers: iceServers
    });
  } catch (error) {
    console.error('Error enviando ICE servers:', error);
  }
});

peerServer.on('disconnect', (client: any) => {
  console.log(`🔌 [PEER] Cliente desconectado: ${client.getId()}`);
});

peerServer.on('error', (error: Error) => {
  console.error('💥 [PEER] Error:', error);
});

peerServer.on('call', (call: any) => {
  console.log(`📞 [PEER] Llamada iniciada entre ${call.origin} y ${call.peer}`);
});

/* ===========================================================
   MONTAR PEER SERVER Y RUTAS
   =========================================================== */
app.use('/', corsMiddleware, peerServer);
app.use('/api', videoRoutes);

/* ===========================================================
   MIDDLEWARE PARA HEADERS WEBRTC EN TODAS LAS RUTAS
   =========================================================== */
app.use('*', (req, res, next) => {
  // Headers adicionales para WebRTC
  res.header('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.header('Cross-Origin-Embedder-Policy', 'unsafe-none');
  res.header('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

/* ===========================================================
   MANEJO GLOBAL DE ERRORES
   =========================================================== */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 [ERROR] Error no manejado en video:', err.message);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

/* ===========================================================
   INICIALIZAR LÓGICA DE VIDEO
   =========================================================== */
initializeVideo(io, peerServer);

/* ===========================================================
   START SERVER
   =========================================================== */
server.listen(PORT, () => {
  console.log(`🌐 [STARTUP] Servidor de video corriendo en puerto ${PORT}`);
  console.log(`🔗 [STARTUP] Peer.js disponible en: https://realtimevideocambackend.onrender.com/`);
  console.log(`🚀 [STARTUP] Health check: https://realtimevideocambackend.onrender.com/api/health`); // 🔥 CAMBIADO
  console.log(`🌍 [STARTUP] CORS habilitado para:`, [
    'https://frontend-real-time.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://realtime-frontend.vercel.app'
  ]);
  console.log(`🎥 [STARTUP] WebRTC configurado con headers COOP/COEP`);
});