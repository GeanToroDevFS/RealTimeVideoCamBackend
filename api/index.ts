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

/**
 * Entry point for the RealTime video backend. Sets up Express, Socket.IO, Peer.js, and
 * shared middleware before delegating real-time behaviour to the video service layer.
 */

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 10001;  // Cambiado a 10001 para video

app.use(cors(corsOptions));
app.use(corsMiddleware);

/* ===========================================================
   SOCKET.IO
   =========================================================== */
const io = new SocketIOServer(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

/* ===========================================================
   PEER.JS (FIX OBLIGATORIO PARA RENDER)
   =========================================================== */
/**
 * Peer.js configuration required for Render deployments. The options keep the server
 * reachable behind a proxy and expose debugging information during development.
 */
const peerOptions: any = {
  path: '/',
  debug: true,
  proxied: true
};

console.log('🔧 [PEER] Configurando Peer.js con opciones:', peerOptions);

const peerServer = ExpressPeerServer(server, peerOptions);

/* ===========================================================
   RUTA MANUAL PARA EVITAR QUE "/" MUESTRE EL JSON DE PEERJS
   =========================================================== */
/**
 * Simple health page that prevents the Peer.js server from responding to the root path.
 *
 * @param req Express request.
 * @param res Express response.
 */
app.get('/', (req, res) => {
  res.send('Servidor de video funcionando ✔');
});

/* ===========================================================
   EVENTOS PEER.JS
   =========================================================== */
peerServer.on('connection', (client: any) => {
  console.log(`🔗 [PEER] Cliente conectado: ${client.getId()}`);
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
   MONTAR PEER SERVER EN ROOT
   =========================================================== */
app.use('/', corsMiddleware, peerServer);

/* ===========================================================
   RUTAS API
   =========================================================== */
app.use(express.json());
app.use('/api', videoRoutes);

/* ===========================================================
   MANEJO GLOBAL DE ERRORES
   =========================================================== */
/**
 * Global error handler that logs any uncaught error and responds with a consistent payload.
 *
 * @param err Captured error object.
 * @param req Express request instance.
 * @param res Express response instance.
 * @param next Next middleware callback (unused, required for signature completeness).
 */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('💥 [ERROR] Error no manejado en video:', err.message);
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.status(500).json({ 
    error: 'Error interno del servidor',
    message: err.message 
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
  console.log(`🚀 [STARTUP] Health check: https://realtimevideobackend.onrender.com/api/health`);
  console.log(`🌍 [STARTUP] CORS habilitado para:`, [
    'https://frontend-real-time.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://realtime-frontend.vercel.app'
  ]);
});