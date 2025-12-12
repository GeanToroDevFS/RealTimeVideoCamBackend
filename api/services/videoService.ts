import { Server as SocketIOServer } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { db } from '../config/firebase';

/**
 * Map to track active peer connections per meeting.
 */
const activePeers = new Map<string, Set<string>>();
const socketToPeer = new Map<string, string>();
const peerToSocket = new Map<string, string>(); // 🔥 NUEVO: para búsqueda inversa
const peerInfo = new Map<string, { userId: string, displayName: string }>(); // 🔥 NUEVO: info de peer

/**
 * Initialize video service with Socket.IO and Peer.js.
 */
export const initializeVideo = (io: SocketIOServer, peerServer: any) => {
    // Peer.js server events
    peerServer.on('connection', (client: any) => {
        console.log(`🔗 [VIDEO] Peer connected: ${client.id}`);
        
        // 🔥 ENVIAR ICE SERVERS AL CLIENTE
        try {
            client.send({
                type: 'ice-servers',
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            });
        } catch (error) {
            console.error('Error enviando ICE servers:', error);
        }
    });

    peerServer.on('disconnect', (client: any) => {
        console.log(`🔌 [VIDEO] Peer disconnected: ${client.id}`);
        
        // Buscar socket asociado
        const socketId = peerToSocket.get(client.id);
        if (socketId) {
            peerToSocket.delete(client.id);
            socketToPeer.delete(socketId);
        }
        
        // Eliminar de todas las reuniones
        for (const [meetingId, peers] of activePeers) {
            if (peers.has(client.id)) {
                peers.delete(client.id);
                peerInfo.delete(client.id);
                
                // Notificar a todos en la sala
                io.to(meetingId).emit('peer-disconnected', { 
                    peerId: client.id,
                    participants: Array.from(peers).map(p => ({
                        peerId: p,
                        ...peerInfo.get(p)
                    }))
                });
                
                console.log(`🚪 [VIDEO] Peer ${client.id} removed from meeting ${meetingId}`);
                
                if (peers.size === 0) {
                    activePeers.delete(meetingId);
                }
            }
        }
    });

    // Socket.IO events
    io.on('connection', (socket) => {
        console.log(`🔗 [VIDEO] Socket connected: ${socket.id}`);

        socket.on('authenticate', (data: { token: string }) => {
            console.log(`🔐 [VIDEO] Socket ${socket.id} autenticado`);
        });

        // 🔥 EVENTO MEJORADO: Unirse a sala de video
        socket.on('join-video-room', async (data: { 
            meetingId: string; 
            peerId: string; 
            userId: string;
            displayName?: string;
        }) => {
            const { meetingId, peerId, userId, displayName = 'Usuario' } = data;
            console.log(`🔹 [VIDEO] User ${userId} (${socket.id}) joining video as peer ${peerId} in meeting: ${meetingId}`);

            try {
                // Validar reunión
                const meetingDoc = await db.collection('meetings').doc(meetingId).get();
                if (!meetingDoc.exists || meetingDoc.data()?.status !== 'active') {
                    socket.emit('video-error', { 
                        code: 'MEETING_INACTIVE', 
                        message: 'Reunión no encontrada o inactiva' 
                    });
                    return;
                }

                // Limitar a 10 usuarios
                if (!activePeers.has(meetingId)) {
                    activePeers.set(meetingId, new Set());
                }
                const peers = activePeers.get(meetingId)!;

                if (peers.size >= 10) {
                    socket.emit('video-error', { 
                        code: 'MEETING_FULL', 
                        message: 'Reunión llena (máximo 10 usuarios)' 
                    });
                    return;
                }

                // Unirse a la sala
                socket.join(meetingId);
                
                // Guardar relaciones
                peers.add(peerId);
                socketToPeer.set(socket.id, peerId);
                peerToSocket.set(peerId, socket.id);
                peerInfo.set(peerId, { userId, displayName });

                console.log(`✅ [VIDEO] Peer ${peerId} joined video room: ${meetingId}`);
                console.log(`👥 [VIDEO] Participants in room ${meetingId}:`, Array.from(peers));

                // 🔥 NOTIFICAR A OTROS SOBRE NUEVO PARTICIPANTE
                const existingPeers = Array.from(peers).filter(p => p !== peerId);
                socket.to(meetingId).emit('peer-joined', {
                    peerId: peerId,
                    userId: userId,
                    displayName: displayName,
                    socketId: socket.id
                });

                // 🔥 ENVIAR LISTA COMPLETA DE PARTICIPANTES AL NUEVO USUARIO
                const participants = existingPeers.map(peerId => {
                    const info = peerInfo.get(peerId);
                    const socketId = peerToSocket.get(peerId);
                    return {
                        peerId,
                        socketId: socketId || peerId,
                        userId: info?.userId || peerId,
                        displayName: info?.displayName || 'Usuario',
                        isAudioEnabled: true, // Por defecto
                        isVideoEnabled: false // Por defecto (según logs)
                    };
                });

                socket.emit('video-joined', {
                    success: true,
                    meetingId,
                    peerId,
                    participants: participants
                });

                // 🔥 ENVIAR LISTA ACTUALIZADA A TODOS
                const allParticipants = Array.from(peers).map(p => {
                    const info = peerInfo.get(p);
                    const sId = peerToSocket.get(p);
                    return {
                        peerId: p,
                        socketId: sId || p,
                        userId: info?.userId || p,
                        displayName: info?.displayName || 'Usuario',
                        isVideoEnabled: false // 🔥 ESTO ES IMPORTANTE: inicializar como false
                    };
                });

                // Enviar al nuevo usuario
                socket.emit('room-participants', {
                    participants: allParticipants.filter(p => p.peerId !== peerId)
                });

                // Enviar a todos los demás sobre el nuevo usuario
                socket.to(meetingId).emit('participant-joined', {
                    peerId: peerId,
                    socketId: socket.id,
                    userId: userId,
                    displayName: displayName,
                    isVideoEnabled: false // 🔥 INICIALIZAR COMO FALSE
                });

                io.to(meetingId).emit('room-participants', {
                    participants: allParticipants
                });

            } catch (error) {
                console.error('❌ [VIDEO] Error joining video room:', error);
                socket.emit('video-error', { 
                    code: 'INTERNAL_ERROR', 
                    message: 'Error interno del servidor' 
                });
            }
        });

        // 🔥 EVENTO MEJORADO: Salir de sala
        socket.on('leave-video-room', (data: { meetingId: string; peerId: string }) => {
            const { meetingId, peerId } = data;
            console.log(`🚪 [VIDEO] Peer ${peerId} leaving video in meeting: ${meetingId}`);

            socket.leave(meetingId);
            
            // Limpiar relaciones
            socketToPeer.delete(socket.id);
            peerToSocket.delete(peerId);
            peerInfo.delete(peerId);
            
            const peers = activePeers.get(meetingId);
            if (peers) {
                peers.delete(peerId);
                
                // Notificar a los demás
                io.to(meetingId).emit('peer-disconnected', {
                    peerId: peerId,
                    participants: Array.from(peers).map(p => ({
                        peerId: p,
                        ...peerInfo.get(p)
                    }))
                });

                if (peers.size === 0) {
                    activePeers.delete(meetingId);
                }
            }
        });

        // 🔥 EVENTO NUEVO: Actualizar estado de medios
        socket.on('update-media-state', (data: {
            meetingId: string;
            peerId: string;
            isAudioEnabled?: boolean;
            isVideoEnabled?: boolean;
        }) => {
            const { meetingId, peerId, isAudioEnabled, isVideoEnabled } = data;
            
            socket.to(meetingId).emit('media-state-changed', {
                peerId,
                isAudioEnabled,
                isVideoEnabled,
                timestamp: new Date().toISOString()
            });
            
            console.log(`🎚️ [VIDEO] Media state updated for ${peerId}:`, {
                audio: isAudioEnabled,
                video: isVideoEnabled
            });
        });

        // WebRTC signaling
        socket.on('webrtc-offer', (data: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
            const { targetSocketId, offer } = data;
            console.log(`📞 [VIDEO] Forwarding offer from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('webrtc-offer', { 
                senderSocketId: socket.id, 
                senderPeerId: socketToPeer.get(socket.id),
                offer 
            });
        });

        socket.on('webrtc-answer', (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
            const { targetSocketId, answer } = data;
            console.log(`📞 [VIDEO] Forwarding answer from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('webrtc-answer', { 
                senderSocketId: socket.id,
                senderPeerId: socketToPeer.get(socket.id),
                answer 
            });
        });

        socket.on('ice-candidate', (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
            const { targetSocketId, candidate } = data;
            console.log(`🧊 [VIDEO] Forwarding ICE candidate from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('ice-candidate', { 
                senderSocketId: socket.id,
                senderPeerId: socketToPeer.get(socket.id),
                candidate 
            });
        });

        socket.on('disconnect', (reason) => {
            console.log(`🔌 [VIDEO] Socket disconnected: ${socket.id}, reason: ${reason}`);

            const peerId = socketToPeer.get(socket.id);
            
            if (peerId) {
                // Limpiar todas las reuniones donde este peer estaba
                for (const [meetingId, peers] of activePeers) {
                    if (peers.has(peerId)) {
                        peers.delete(peerId);
                        peerInfo.delete(peerId);
                        peerToSocket.delete(peerId);
                        
                        io.to(meetingId).emit('peer-disconnected', {
                            peerId: peerId,
                            participants: Array.from(peers).map(p => ({
                                peerId: p,
                                ...peerInfo.get(p)
                            }))
                        });

                        if (peers.size === 0) {
                            activePeers.delete(meetingId);
                        }
                    }
                }
                
                socketToPeer.delete(socket.id);
            }
        });

        socket.on('error', (error) => {
            console.error(`💥 [VIDEO] Socket error for ${socket.id}:`, error);
        });
    });
};