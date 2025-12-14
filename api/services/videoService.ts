/**
 * Video service using Socket.IO and Peer.js for real-time video transmission in meetings.
 *
 * This service handles Peer.js connections for WebRTC video calls, integrated with Socket.IO
 * for signaling and room management. It validates meetings via Firestore and manages peer connections.
 * Supports 2-10 users per meeting with real-time video.
 */

import { Server as SocketIOServer } from 'socket.io';
import { ExpressPeerServer } from 'peer';
import { db, isFirebaseEnabled } from '../config/firebase';

type MeetingPeer = {
    peerId: string;
    socketId: string;
    userId: string;
    displayName: string;
};

/**
 * Map to track active peer connections per meeting.
 * Key: meetingId, Value: Map of peer IDs to participant metadata.
 */
const activePeers = new Map<string, Map<string, MeetingPeer>>();

/**
 * Maps a socket identifier to the last Peer.js identifier announced by the client.
 * Used to make sure disconnections propagate correctly to Peer.js participants.
 */
const socketToPeer = new Map<string, { meetingId: string; peerId: string }>();

/**
 * Initialize video service with Socket.IO and Peer.js.
 *
 * @param {SocketIOServer} io - The Socket.IO server instance.
 * @param {any} peerServer - The Peer.js server instance.
 */
/**
 * Wires Socket.IO and Peer.js to coordinate room membership, signaling and clean-up.
 *
 * @param io Socket.IO server shared across the application.
 * @param peerServer Peer.js middleware instance attached to the HTTP server.
 */
export const initializeVideo = (io: SocketIOServer, peerServer: ReturnType<typeof ExpressPeerServer>) => {
    // Peer.js server events
    peerServer.on('connection', (client: any) => {
        console.log(`🔗 [VIDEO] Peer connected: ${client.id}`);
    });

    peerServer.on('disconnect', (client: any) => {
        console.log(`🔌 [VIDEO] Peer disconnected: ${client.id}`);
        // Remove from all meetings
        for (const [meetingId, peers] of activePeers) {
            if (peers.delete(client.id)) {
                io.to(meetingId).emit('peer-disconnected', client.id);
                console.log(`🚪 [VIDEO] Peer ${client.id} removed from meeting ${meetingId}`);

                if (peers.size === 0) {
                    activePeers.delete(meetingId);
                }

                for (const [socketId, mapping] of socketToPeer) {
                    if (mapping.peerId === client.id && mapping.meetingId === meetingId) {
                        socketToPeer.delete(socketId);
                    }
                }
            }
        }
    });

    // Socket.IO events for video signaling
    io.on('connection', (socket) => {
        console.log(`🔗 [VIDEO] Socket connected: ${socket.id}`);

        /**
         * Optional hook to authenticate a socket before joining rooms. At the moment the
         * event only logs activity, but it allows future integration with custom auth flows.
         */
        socket.on('authenticate', (data: { token: string }) => {
            console.log(`🔐 [VIDEO] Socket ${socket.id} autenticado`);
        });

        /**
         * Handles a user joining the video room. Optionally validates the meeting in Firestore,
         * limits the room to ten peers and notifies existing participants about the newcomer.
         *
         * @param data.meetingId Meeting identifier shared across the frontend.
         * @param data.peerId Peer.js identifier for WebRTC media exchange.
         * @param data.userId Internal user identifier, used only for logging at the moment.
         */
        socket.on('join-video-room', async (data: { meetingId: string; peerId: string; userId: string; displayName?: string }) => {
            const { meetingId, peerId, userId, displayName } = data;
            console.log(`🔹 [VIDEO] User ${socket.id} (${userId}) joining video in meeting: ${meetingId}`);

            try {
                if (isFirebaseEnabled) {
                    // Validate meeting exists and is active when Firestore is available
                    const meetingDoc = await db!.collection('meetings').doc(meetingId).get();
                    if (!meetingDoc.exists || meetingDoc.data()?.status !== 'active') {
                        socket.emit('video-error', 'Meeting not found or inactive');
                        return;
                    }
                } else {
                    console.warn(`⚠️ [VIDEO] Skipping Firestore validation for meeting ${meetingId}.`);
                }

                // Limit to 10 users
                if (!activePeers.has(meetingId)) {
                    activePeers.set(meetingId, new Map());
                }
                const peers = activePeers.get(meetingId)!;

                if (peers.size >= 10) {
                    socket.emit('video-error', 'Meeting full (maximum 10 users)');
                    return;
                }

                // Replace stale entry when the same peer rejoins (e.g. reconnection)
                if (peers.has(peerId)) {
                    console.warn(`♻️ [VIDEO] Replacing existing peer ${peerId} in meeting ${meetingId}`);
                    peers.delete(peerId);
                }

                socket.join(meetingId);

                const fallbackTag = userId ? userId.slice(-4).toUpperCase() : 'INVIT';
                const safeDisplayName = (displayName || '').trim() || `Participante ${fallbackTag}`;

                peers.set(peerId, {
                    peerId,
                    socketId: socket.id,
                    userId,
                    displayName: safeDisplayName,
                });
                socketToPeer.set(socket.id, { meetingId, peerId });

                console.log(`✅ [VIDEO] Peer ${peerId} joined video room: ${meetingId}`);

                // Notify others in the room to connect via Peer.js
                socket.to(meetingId).emit('peer-joined', peerId);

                // Send existing peers to the new user for connection
                socket.emit('video-joined', {
                    peers: Array.from(peers.keys()).filter(p => p !== peerId),
                    meetingId
                });

                // Send current participants when the user joins the room
                const peersInRoom = Array.from(activePeers.get(meetingId)?.values() || []);
                socket.emit('room-participants', {
                    participants: peersInRoom
                        .filter(p => p.peerId !== peerId)
                        .map(p => ({
                            socketId: p.socketId,
                            odiserId: p.peerId,
                            userId: p.userId,
                            displayName: p.displayName,
                        }))
                });

                socket.to(meetingId).emit('participant-joined', {
                    socketId: socket.id,
                    odiserId: peerId,
                    userId,
                    displayName: safeDisplayName,
                });

            } catch (error) {
                console.error('❌ [VIDEO] Error joining video room:', error);
                socket.emit('video-error', 'Internal server error');
            }
        });

        /**
         * Removes a peer from the specified meeting and notifies the remaining participants.
         *
         * @param data.meetingId Meeting identifier to leave.
         * @param data.peerId Peer.js identifier that should be removed from the room.
         */
        socket.on('leave-video-room', (data: { meetingId: string; peerId: string }) => {
            const { meetingId, peerId } = data;
            console.log(`🚪 [VIDEO] User ${peerId} leaving video in meeting: ${meetingId}`);

            socket.leave(meetingId);
            const peers = activePeers.get(meetingId);

            if (peers) {
                if (peers.delete(peerId)) {
                    io.to(meetingId).emit('peer-disconnected', peerId);

                    if (peers.size === 0) {
                        activePeers.delete(meetingId);
                    }
                }
            }

            // ✅ NUEVO
            socketToPeer.delete(socket.id);
        });

        /**
         * Ends a meeting by requesting all connected clients to disconnect.
         *
         * @param data.meetingId Meeting identifier that should be terminated for everyone.
         */
        socket.on('end-meeting', (data: { meetingId: string }) => {
            const { meetingId } = data;

            console.log(`🔴 [VIDEO] Meeting ${meetingId} finalizada por el host`);

            // Forzar desconexión
            io.to(meetingId).emit('force-disconnect');
        });

        // WebRTC signaling events
        /**
         * Forwards a WebRTC offer to the target socket to initiate the peer connection.
         *
         * @param data.targetSocketId Socket identifier that should receive the offer.
         * @param data.offer Session description being proposed by the sender.
         */
        socket.on('webrtc-offer', (data: { targetSocketId: string; offer: RTCSessionDescriptionInit }) => {
            const { targetSocketId, offer } = data;
            console.log(`📞 [VIDEO] Forwarding offer from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('webrtc-offer', { senderSocketId: socket.id, offer });
        });

        /**
         * Forwards a WebRTC answer to complete the SDP exchange with the original offer sender.
         *
         * @param data.targetSocketId Socket identifier that emitted the offer.
         * @param data.answer Session description answering the offer.
         */
        socket.on('webrtc-answer', (data: { targetSocketId: string; answer: RTCSessionDescriptionInit }) => {
            const { targetSocketId, answer } = data;
            console.log(`📞 [VIDEO] Forwarding answer from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('webrtc-answer', { senderSocketId: socket.id, answer });
        });

        /**
         * Relays ICE candidates between peers to help them discover a working network path.
         *
         * @param data.targetSocketId Socket identifier that should receive the candidate.
         * @param data.candidate ICE candidate discovered by the sender.
         */
        socket.on('ice-candidate', (data: { targetSocketId: string; candidate: RTCIceCandidateInit }) => {
            const { targetSocketId, candidate } = data;
            console.log(`🧊 [VIDEO] Forwarding ICE candidate from ${socket.id} to ${targetSocketId}`);
            io.to(targetSocketId).emit('ice-candidate', { senderSocketId: socket.id, candidate });
        });

        /**
         * Broadcasts changes in local media state (for example, video muted/unmuted) to peers.
         *
         * @param data.roomId Meeting identifier where the change occurred.
         * @param data.isVideoEnabled Whether the sender keeps the video track enabled.
         */
        socket.on('media-state-change', (data: { roomId: string; isVideoEnabled: boolean }) => {
            const { roomId, isVideoEnabled } = data;
            socket.to(roomId).emit('media-state-changed', { socketId: socket.id, isVideoEnabled });
        });

        /**
         * Cleans up room membership when the socket disconnects unexpectedly.
         *
         * @param reason Socket.IO disconnect reason string.
         */
        socket.on('disconnect', (reason) => {
            console.log(`🔌 [VIDEO] Socket disconnected: ${socket.id}, reason: ${reason}`);

            const details = socketToPeer.get(socket.id);

            if (details) {
                const { meetingId, peerId } = details;
                const peers = activePeers.get(meetingId);

                if (peers && peers.delete(peerId)) {
                    io.to(meetingId).emit('peer-disconnected', peerId);

                    if (peers.size === 0) {
                        activePeers.delete(meetingId);
                    }
                }

                socketToPeer.delete(socket.id);
            }
        });

        /**
         * Captures socket-level errors to help troubleshoot unexpected runtime failures.
         *
         * @param error Error value emitted by Socket.IO.
         */
        socket.on('error', (error) => {
            console.error(`💥 [VIDEO] Socket error for ${socket.id}:`, error);
        });
    });
};