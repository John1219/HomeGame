import type { GameState } from './PokerEngine';
import { realtimeGameService } from '../services/realtimeGameService';
import { supabase } from '../lib/supabaseClient';

export interface PlayerAction {
    type: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
    amount?: number;
    playerId: string;
}

/**
 * Game Client Controller - Runs on each player's browser
 * Receives game state from Supabase Realtime and sends actions via database
 */
export class GameClientController {
    private gameId: string;
    private userId: string;
    private currentGameState: GameState | null = null;
    private connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

    // Callbacks
    private onGameStateUpdateCallback: ((gameState: GameState) => void) | null = null;
    private onSystemMessageCallback: ((message: string) => void) | null = null;
    private onConnectionStatusCallback: ((status: string) => void) | null = null;

    constructor(gameId: string, userId: string) {
        this.gameId = gameId;
        this.userId = userId;
        console.log('[Client] Game Client Controller initialized');
    }

    /**
     * Connect to the game via Realtime
     */
    async connect(_hostUserId: string): Promise<void> {
        this.setConnectionStatus('connecting');

        try {
            console.log('[Client] Connecting to game via Realtime:', this.gameId);

            // Fetch initial game state
            const initialState = await realtimeGameService.fetchGameState(this.gameId);
            if (initialState) {
                this.handleGameStateUpdate(initialState);
            }

            // Subscribe to game state updates
            await realtimeGameService.subscribeToGameState(
                this.gameId,
                (gameState: GameState) => {
                    this.handleGameStateUpdate(gameState);
                }
            );

            this.setConnectionStatus('connected');
            console.log('[Client] Connected to game via Realtime');

        } catch (error) {
            console.error('[Client] Connection error:', error);
            this.setConnectionStatus('disconnected');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            this.onSystemMessageCallback?.(
                `Failed to connect: ${errorMessage}\n` +
                'Please try:\n' +
                '1. Refreshing the page\n' +
                '2. Checking your internet connection'
            );

            throw error;
        }
    }

    /**
     * Handle game state update from Realtime
     */
    private handleGameStateUpdate(gameState: GameState): void {
        console.log('[Client] Received game state update, phase:', gameState.phase);
        this.currentGameState = gameState;
        this.onGameStateUpdateCallback?.(gameState);
    }

    /**
     * Send player action via database
     */
    async sendAction(action: Omit<PlayerAction, 'playerId'>): Promise<void> {
        if (this.connectionStatus !== 'connected') {
            console.warn('[Client] Cannot send action - not connected');
            return;
        }

        try {
            await realtimeGameService.submitPlayerAction({
                game_id: this.gameId,
                user_id: this.userId,
                action_type: action.type,
                amount: action.amount,
            });

            console.log('[Client] Submitted action:', action.type);
        } catch (error) {
            console.error('[Client] Error sending action:', error);
            this.onSystemMessageCallback?.('Failed to send action. Please try again.');
        }
    }

    /**
     * Join table - inserts player into game_participants table
     */
    async joinTable(_username: string, seatPosition: number, buyIn: number): Promise<void> {
        console.log('[Client] Joining table at seat', seatPosition, 'with buy-in', buyIn);

        try {
            const { error } = await supabase
                .from('game_participants')
                .insert({
                    game_id: this.gameId,
                    user_id: this.userId,
                    seat_position: seatPosition,
                    starting_chips: buyIn,
                });

            if (error) {
                console.error('[Client] Error joining table:', error);
                this.onSystemMessageCallback?.('Failed to join table. Please try again.');
                throw error;
            }

            console.log('[Client] Successfully joined table');
        } catch (error) {
            console.error('[Client] Error in joinTable:', error);
            throw error;
        }
    }

    /**
     * Fold action
     */
    fold(): void {
        this.sendAction({ type: 'fold' });
    }

    /**
     * Check action
     */
    check(): void {
        this.sendAction({ type: 'check' });
    }

    /**
     * Call action
     */
    call(): void {
        this.sendAction({ type: 'call' });
    }

    /**
     * Raise action
     */
    raise(amount: number): void {
        this.sendAction({ type: 'raise', amount });
    }

    /**
     * All-in action
     */
    allIn(): void {
        this.sendAction({ type: 'all-in' });
    }

    /**
     * Get current game state
     */
    getGameState(): GameState | null {
        return this.currentGameState;
    }

    /**
     * Get connection status
     */
    getConnectionStatus(): string {
        return this.connectionStatus;
    }

    /**
     * Set connection status and notify
     */
    private setConnectionStatus(status: 'disconnected' | 'connecting' | 'connected'): void {
        this.connectionStatus = status;
        this.onConnectionStatusCallback?.(status);
    }

    /**
     * Set callback for game state updates
     */
    onGameStateUpdate(callback: (gameState: GameState) => void): void {
        this.onGameStateUpdateCallback = callback;
    }

    /**
     * Set callback for system messages
     */
    onSystemMessage(callback: (message: string) => void): void {
        this.onSystemMessageCallback = callback;
    }

    /**
     * Set callback for connection status changes
     */
    onConnectionStatus(callback: (status: string) => void): void {
        this.onConnectionStatusCallback = callback;
    }

    /**
     * Cleanup
     */
    cleanup(): void {
        realtimeGameService.cleanup();
        this.currentGameState = null;
        this.setConnectionStatus('disconnected');
        console.log('[Client] Cleaned up');
    }
}
