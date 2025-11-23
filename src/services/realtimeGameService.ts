import { supabase } from '../lib/supabaseClient';
import type { GameState } from '../game/PokerEngine';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface PlayerAction {
    id?: string;
    game_id: string;
    user_id: string;
    action_type: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
    amount?: number;
    created_at?: string;
    processed?: boolean;
}

/**
 * Realtime Game Service - Manages game state synchronization via Supabase Realtime
 * Replaces WebRTC P2P with reliable database-backed real-time updates
 */
class RealtimeGameService {
    private gameStateChannel: RealtimeChannel | null = null;
    private actionsChannel: RealtimeChannel | null = null;

    // Callbacks
    private onGameStateUpdateCallback: ((state: GameState) => void) | null = null;
    private onPlayerActionCallback: ((action: PlayerAction) => void) | null = null;

    /**
     * Subscribe to game state changes
     */
    async subscribeToGameState(gameId: string, callback: (state: GameState) => void): Promise<void> {
        this.onGameStateUpdateCallback = callback;

        console.log('[Realtime] Subscribing to game state for game:', gameId);

        // Subscribe to changes in the games table for this specific game
        this.gameStateChannel = supabase
            .channel(`game-state-${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'games',
                    filter: `id=eq.${gameId}`,
                },
                (payload) => {
                    console.log('[Realtime] Game state update received:', payload);
                    const game = payload.new as any;
                    if (game.game_state) {
                        this.onGameStateUpdateCallback?.(game.game_state);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Game state subscription status:', status);
            });
    }

    /**
     * Subscribe to player actions (host only)
     */
    async subscribeToPlayerActions(gameId: string, callback: (action: PlayerAction) => void): Promise<void> {
        this.onPlayerActionCallback = callback;

        console.log('[Realtime] Subscribing to player actions for game:', gameId);

        // Subscribe to new actions in the player_actions table
        this.actionsChannel = supabase
            .channel(`player-actions-${gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'player_actions',
                    filter: `game_id=eq.${gameId}`,
                },
                (payload) => {
                    console.log('[Realtime] Player action received:', payload);
                    const action = payload.new as PlayerAction;
                    if (!action.processed) {
                        this.onPlayerActionCallback?.(action);
                    }
                }
            )
            .subscribe((status) => {
                console.log('[Realtime] Player actions subscription status:', status);
            });
    }

    /**
     * Update game state (host only)
     */
    async updateGameState(gameId: string, state: GameState): Promise<void> {
        try {
            const { error } = await supabase
                .from('games')
                .update({
                    game_state: state,
                    current_hand: state.handNumber,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', gameId);

            if (error) {
                console.error('[Realtime] Error updating game state:', error);
                throw error;
            }

            console.log('[Realtime] Game state updated successfully');
        } catch (error) {
            console.error('[Realtime] Error in updateGameState:', error);
            throw error;
        }
    }

    /**
     * Submit a player action (client)
     */
    async submitPlayerAction(action: PlayerAction): Promise<void> {
        try {
            const { error } = await supabase
                .from('player_actions')
                .insert({
                    game_id: action.game_id,
                    user_id: action.user_id,
                    action_type: action.action_type,
                    amount: action.amount,
                });

            if (error) {
                console.error('[Realtime] Error submitting action:', error);
                throw error;
            }

            console.log('[Realtime] Action submitted successfully:', action.action_type);
        } catch (error) {
            console.error('[Realtime] Error in submitPlayerAction:', error);
            throw error;
        }
    }

    /**
     * Mark an action as processed (host only)
     */
    async markActionProcessed(actionId: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('player_actions')
                .update({ processed: true })
                .eq('id', actionId);

            if (error) {
                console.error('[Realtime] Error marking action as processed:', error);
            }
        } catch (error) {
            console.error('[Realtime] Error in markActionProcessed:', error);
        }
    }

    /**
     * Fetch current game state once (for initial load)
     */
    async fetchGameState(gameId: string): Promise<GameState | null> {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('game_state')
                .eq('id', gameId)
                .single();

            if (error) {
                console.error('[Realtime] Error fetching game state:', error);
                return null;
            }

            return data?.game_state || null;
        } catch (error) {
            console.error('[Realtime] Error in fetchGameState:', error);
            return null;
        }
    }

    /**
     * Cleanup and unsubscribe from all channels
     */
    cleanup(): void {
        console.log('[Realtime] Cleaning up subscriptions');

        if (this.gameStateChannel) {
            supabase.removeChannel(this.gameStateChannel);
            this.gameStateChannel = null;
        }

        if (this.actionsChannel) {
            supabase.removeChannel(this.actionsChannel);
            this.actionsChannel = null;
        }

        this.onGameStateUpdateCallback = null;
        this.onPlayerActionCallback = null;
    }
}

// Export singleton instance
export const realtimeGameService = new RealtimeGameService();
