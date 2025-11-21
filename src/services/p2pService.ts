import Peer from 'simple-peer';
import type { Instance, SignalData } from 'simple-peer';
import { supabase } from '../lib/supabaseClient';

export interface P2PMessage {
    type: 'game_state' | 'player_action' | 'chat' | 'system';
    data: any;
    from: string;
    timestamp: number;
}

export interface PeerConnection {
    peerId: string;
    peer: Instance;
    connected: boolean;
}

/**
 * P2P Service for WebRTC peer-to-peer communication
 * Handles both data channels (game state) and media streams (video/voice)
 */
class P2PService {
    private peers: Map<string, PeerConnection> = new Map();
    private localStream: MediaStream | null = null;
    private isHost: boolean = false;
    private roomId: string | null = null;
    private userId: string | null = null;

    // Callbacks
    private onMessageCallback: ((message: P2PMessage) => void) | null = null;
    private onPeerConnectedCallback: ((peerId: string) => void) | null = null;
    private onPeerDisconnectedCallback: ((peerId: string) => void) | null = null;
    private onStreamCallback: ((peerId: string, stream: MediaStream) => void) | null = null;

    /**
     * Initialize as host
     */
    async initializeAsHost(roomId: string, userId: string): Promise<void> {
        this.isHost = true;
        this.roomId = roomId;
        this.userId = userId;
        console.log(`[P2P] Initialized as HOST for room ${roomId}`);
    }

    /**
     * Initialize as client and connect to host
     */
    async initializeAsClient(roomId: string, userId: string): Promise<void> {
        this.isHost = false;
        this.roomId = roomId;
        this.userId = userId;
        console.log(`[P2P] Initialized as CLIENT for room ${roomId}`);
    }

    /**
     * Create a peer connection to another user
     */
    createPeerConnection(peerId: string, initiator: boolean): void {
        if (this.peers.has(peerId)) {
            console.log(`[P2P] Peer ${peerId} already exists`);
            return;
        }

        const config = {
            initiator,
            stream: this.localStream || undefined,
            trickle: true,
            config: {
                iceServers: [
                    {
                        urls: import.meta.env.VITE_STUN_SERVER_URL || 'stun:stun.l.google.com:19302',
                    },
                ],
            },
        };

        const peer = new Peer(config);

        // Handle signaling data
        peer.on('signal', (signal: SignalData) => {
            this.sendSignal(peerId, signal);
        });

        // Handle connection
        peer.on('connect', () => {
            console.log(`[P2P] Connected to peer ${peerId}`);
            const connection = this.peers.get(peerId);
            if (connection) {
                connection.connected = true;
            }
            this.onPeerConnectedCallback?.(peerId);
        });

        // Handle incoming data
        peer.on('data', (data: ArrayBuffer) => {
            try {
                const message: P2PMessage = JSON.parse(new TextDecoder().decode(data));
                this.onMessageCallback?.(message);
            } catch (error) {
                console.error('[P2P] Error parsing message:', error);
            }
        });

        // Handle incoming stream
        peer.on('stream', (stream: MediaStream) => {
            console.log(`[P2P] Received stream from peer ${peerId}`);
            this.onStreamCallback?.(peerId, stream);
        });

        // Handle errors
        peer.on('error', (err: Error) => {
            console.error(`[P2P] Peer error with ${peerId}:`, err);
        });

        // Handle close
        peer.on('close', () => {
            console.log(`[P2P] Peer ${peerId} disconnected`);
            this.peers.delete(peerId);
            this.onPeerDisconnectedCallback?.(peerId);
        });

        this.peers.set(peerId, {
            peerId,
            peer,
            connected: false,
        });
    }

    /**
     * Signal another peer
     */
    async signalPeer(peerId: string, signal: SignalData): Promise<void> {
        const connection = this.peers.get(peerId);
        if (!connection) {
            console.error(`[P2P] No peer connection found for ${peerId}`);
            return;
        }

        try {
            connection.peer.signal(signal);
        } catch (error) {
            console.error(`[P2P] Error signaling peer ${peerId}:`, error);
        }
    }

    /**
     * Send a message to a specific peer
     */
    sendMessage(peerId: string, message: P2PMessage): void {
        const connection = this.peers.get(peerId);
        if (!connection || !connection.connected) {
            console.warn(`[P2P] Cannot send message to ${peerId} - not connected`);
            return;
        }

        try {
            const data = JSON.stringify(message);
            connection.peer.send(data);
        } catch (error) {
            console.error(`[P2P] Error sending message to ${peerId}:`, error);
        }
    }

    /**
     * Broadcast a message to all connected peers
     */
    broadcastMessage(message: P2PMessage): void {
        this.peers.forEach((connection, peerId) => {
            if (connection.connected) {
                this.sendMessage(peerId, message);
            }
        });
    }

    /**
     * Send signaling data through Supabase Realtime
     */
    private async sendSignal(peerId: string, signal: SignalData): Promise<void> {
        if (!this.roomId || !this.userId) return;

        try {
            await supabase
                .from('webrtc_signals')
                .insert({
                    room_id: this.roomId,
                    from_user_id: this.userId,
                    to_user_id: peerId,
                    signal: signal,
                });
        } catch (error) {
            console.error('[P2P] Error sending signal:', error);
        }
    }

    /**
     * Enable video/audio streaming
     */
    async enableMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream | null> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: video ? { width: 640, height: 480 } : false,
                audio: audio,
            });

            this.localStream = stream;

            // Add stream to all existing peers
            this.peers.forEach(connection => {
                if (this.localStream) {
                    connection.peer.addStream(this.localStream);
                }
            });

            return stream;
        } catch (error) {
            console.error('[P2P] Error accessing media devices:', error);
            return null;
        }
    }

    /**
     * Disable video/audio streaming
     */
    disableMedia(): void {
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }
    }

    /**
     * Toggle video on/off
     */
    toggleVideo(enabled: boolean): void {
        if (!this.localStream) return;

        this.localStream.getVideoTracks().forEach(track => {
            track.enabled = enabled;
        });
    }

    /**
     * Toggle audio on/off
     */
    toggleAudio(enabled: boolean): void {
        if (!this.localStream) return;

        this.localStream.getAudioTracks().forEach(track => {
            track.enabled = enabled;
        });
    }

    /**
     * Get local media stream
     */
    getLocalStream(): MediaStream | null {
        return this.localStream;
    }

    /**
     * Disconnect from a peer
     */
    disconnectPeer(peerId: string): void {
        const connection = this.peers.get(peerId);
        if (connection) {
            connection.peer.destroy();
            this.peers.delete(peerId);
        }
    }

    /**
     * Disconnect from all peers and cleanup
     */
    disconnectAll(): void {
        this.peers.forEach(connection => {
            connection.peer.destroy();
        });
        this.peers.clear();

        this.disableMedia();

        this.isHost = false;
        this.roomId = null;
        this.userId = null;
    }

    /**
     * Get all connected peers
     */
    getConnectedPeers(): string[] {
        const connected: string[] = [];
        this.peers.forEach((connection, peerId) => {
            if (connection.connected) {
                connected.push(peerId);
            }
        });
        return connected;
    }

    /**
     * Check if connected to a specific peer
     */
    isConnectedTo(peerId: string): boolean {
        const connection = this.peers.get(peerId);
        return connection?.connected || false;
    }

    /**
     * Set callback for incoming messages
     */
    onMessage(callback: (message: P2PMessage) => void): void {
        this.onMessageCallback = callback;
    }

    /**
     * Set callback for peer connected
     */
    onPeerConnected(callback: (peerId: string) => void): void {
        this.onPeerConnectedCallback = callback;
    }

    /**
     * Set callback for peer disconnected
     */
    onPeerDisconnected(callback: (peerId: string) => void): void {
        this.onPeerDisconnectedCallback = callback;
    }

    /**
     * Set callback for incoming media stream
     */
    onStream(callback: (peerId: string, stream: MediaStream) => void): void {
        this.onStreamCallback = callback;
    }

    /**
     * Get connection stats for monitoring
     */
    async getConnectionStats(peerId: string): Promise<RTCStatsReport | null> {
        const connection = this.peers.get(peerId);
        if (!connection) return null;

        try {
            // Access the internal RTCPeerConnection
            const pc = (connection.peer as any)._pc as RTCPeerConnection;
            if (pc && pc.getStats) {
                return await pc.getStats();
            }
        } catch (error) {
            console.error('[P2P] Error getting stats:', error);
        }

        return null;
    }
}

export const p2pService = new P2PService();
