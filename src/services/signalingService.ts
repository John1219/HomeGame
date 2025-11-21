import { supabase } from '../lib/supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { SignalData } from 'simple-peer';
import { p2pService } from './p2pService';

export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate' | 'join' | 'leave';
    from: string;
    to?: string;
    signal?: SignalData;
    username?: string;
}

/**
 * WebRTC Signaling Service using Supabase Realtime
 * Facilitates WebRTC connection establishment between peers
 */
class SignalingService {
    private channel: RealtimeChannel | null = null;
    private roomId: string | null = null;
    private userId: string | null = null;
    private username: string | null = null;
    private isHost: boolean = false;

    private onUserJoinedCallback: ((userId: string, username: string) => void) | null = null;
    private onUserLeftCallback: ((userId: string) => void) | null = null;

    /**
     * Join a room as host
     */
    async joinAsHost(roomId: string, userId: string, username: string): Promise<void> {
        this.roomId = roomId;
        this.userId = userId;
        this.username = username;
        this.isHost = true;

        await this.setupChannel();
        await this.announcePresence('join');

        console.log(`[Signaling] Joined room ${roomId} as HOST`);
    }

    /**
     * Join a room as client
     */
    async joinAsClient(roomId: string, userId: string, username: string): Promise<void> {
        this.roomId = roomId;
        this.userId = userId;
        this.username = username;
        this.isHost = false;

        await this.setupChannel();
        await this.announcePresence('join');

        console.log(`[Signaling] Joined room ${roomId} as CLIENT`);
    }

    /**
     * Set up Supabase Realtime channel
     */
    private async setupChannel(): Promise<void> {
        if (!this.roomId) return;

        // Subscribe to the room channel
        this.channel = supabase.channel(`room:${this.roomId}`, {
            config: {
                broadcast: { self: false },
                presence: { key: this.userId || '' },
            },
        });

        // Handle presence sync (when someone joins/leaves)
        this.channel
            .on('presence', { event: 'sync' }, () => {
                const state = this.channel!.presenceState();
                console.log('[Signaling] Presence sync:', state);
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                console.log('[Signaling] User joined:', key, newPresences);

                const presence = newPresences[0];
                if (presence && key !== this.userId) {
                    this.onUserJoinedCallback?.(key, presence.username);

                    // If we're the host, initiate connection
                    if (this.isHost) {
                        p2pService.createPeerConnection(key, true);
                    }
                }
            })
            .on('presence', { event: 'leave' }, ({ key }) => {
                console.log('[Signaling] User left:', key);
                if (key !== this.userId) {
                    this.onUserLeftCallback?.(key);
                    p2pService.disconnectPeer(key);
                }
            });

        // Handle broadcast messages (WebRTC signaling)
        this.channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
            this.handleSignalMessage(payload as SignalingMessage);
        });

        // Subscribe to the channel
        await this.channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                console.log('[Signaling] Subscribed to channel');

                // Track presence
                await this.channel!.track({
                    user_id: this.userId,
                    username: this.username,
                    online_at: new Date().toISOString(),
                });
            }
        });
    }

    /**
     * Handle incoming signaling messages
     */
    private handleSignalMessage(message: SignalingMessage): void {
        console.log('[Signaling] Received signal:', message.type, 'from:', message.from);

        // Ignore messages from self
        if (message.from === this.userId) return;

        // Ignore messages not meant for us
        if (message.to && message.to !== this.userId) return;

        switch (message.type) {
            case 'offer':
            case 'answer':
            case 'ice-candidate':
                if (message.signal) {
                    // Create peer if doesn't exist (client receiving offer from host)
                    if (!p2pService.isConnectedTo(message.from)) {
                        p2pService.createPeerConnection(message.from, false);
                    }

                    // Signal the peer
                    p2pService.signalPeer(message.from, message.signal);
                }
                break;

            case 'join':
                // Another user joined
                if (message.from !== this.userId) {
                    this.onUserJoinedCallback?.(message.from, message.username || 'Unknown');
                }
                break;

            case 'leave':
                // Another user left
                if (message.from !== this.userId) {
                    this.onUserLeftCallback?.(message.from);
                }
                break;
        }
    }

    /**
     * Send a signaling message
     */
    async sendSignal(to: string, signal: SignalData, type: 'offer' | 'answer' | 'ice-candidate'): Promise<void> {
        if (!this.channel) {
            console.error('[Signaling] No channel available');
            return;
        }

        const message: SignalingMessage = {
            type,
            from: this.userId!,
            to,
            signal,
        };

        await this.channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: message,
        });
    }

    /**
     * Announce presence (join/leave)
     */
    private async announcePresence(type: 'join' | 'leave'): Promise<void> {
        if (!this.channel) return;

        const message: SignalingMessage = {
            type,
            from: this.userId!,
            username: this.username!,
        };

        await this.channel.send({
            type: 'broadcast',
            event: 'signal',
            payload: message,
        });
    }

    /**
     * Get all users in the room
     */
    getOnlineUsers(): { userId: string; username: string }[] {
        if (!this.channel) return [];

        const state = this.channel.presenceState();
        const users: { userId: string; username: string }[] = [];

        Object.entries(state).forEach(([userId, presences]) => {
            if (presences.length > 0) {
                const presence = presences[0] as any;
                users.push({
                    userId,
                    username: presence.username || 'Unknown',
                });
            }
        });

        return users;
    }

    /**
     * Leave the room
     */
    async leave(): Promise<void> {
        if (this.channel) {
            await this.announcePresence('leave');
            await this.channel.untrack();
            await this.channel.unsubscribe();
            this.channel = null;
        }

        // Disconnect all P2P connections
        p2pService.disconnectAll();

        this.roomId = null;
        this.userId = null;
        this.username = null;
        this.isHost = false;

        console.log('[Signaling] Left room');
    }

    /**
     * Set callback for when a user joins
     */
    onUserJoined(callback: (userId: string, username: string) => void): void {
        this.onUserJoinedCallback = callback;
    }

    /**
     * Set callback for when a user leaves
     */
    onUserLeft(callback: (userId: string) => void): void {
        this.onUserLeftCallback = callback;
    }

    /**
     * Check if currently in a room
     */
    isInRoom(): boolean {
        return this.roomId !== null && this.channel !== null;
    }

    /**
     * Get current room ID
     */
    getRoomId(): string | null {
        return this.roomId;
    }

    /**
     * Check if user is host
     */
    isUserHost(): boolean {
        return this.isHost;
    }
}

export const signalingService = new SignalingService();
