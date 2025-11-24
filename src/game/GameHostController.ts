import { PokerEngine, type GameState } from './PokerEngine';
import { realtimeGameService, type PlayerAction as RealtimePlayerAction } from '../services/realtimeGameService';
import { supabase } from '../lib/supabaseClient';

export interface GameConfig {
    gameId: string;
    smallBlind: number;
    bigBlind: number;
    maxPlayers: number;
    buyIn: number;
}

export interface PlayerAction {
    type: 'fold' | 'check' | 'call' | 'raise' | 'all-in';
    amount?: number;
    playerId: string;
}

/**
 * Game Host Controller - Runs on the host's browser
 * Manages the authoritative PokerEngine and synchronizes state via Supabase Realtime
 */
export class GameHostController {
    private engine: PokerEngine;
    private config: GameConfig;
    private isGameActive: boolean = false;

    constructor(config: GameConfig) {
        this.config = config;
        this.engine = new PokerEngine(config.gameId, config.smallBlind, config.bigBlind);
        console.log('[Host] Game Host Controller initialized');
    }

    /**
     * Initialize as host with Realtime subscriptions
     */
    async initialize(_hostUserId: string): Promise<void> {
        console.log('[Host] Initializing as host for game:', this.config.gameId);

        // Subscribe to player actions
        await realtimeGameService.subscribeToPlayerActions(
            this.config.gameId,
            async (action: RealtimePlayerAction) => {
                console.log('[Host] Received player action:', action);

                // Mark action as processed
                if (action.id) {
                    await realtimeGameService.markActionProcessed(action.id);
                }

                // Process the action
                this.handlePlayerAction({
                    type: action.action_type,
                    amount: action.amount,
                    playerId: action.user_id,
                });

                // Save updated state to database
                await this.saveGameState();
            }
        );

        // Try to restore existing game state
        const existingState = await realtimeGameService.fetchGameState(this.config.gameId);
        if (existingState) {
            console.log('[Host] Restoring existing game state');
            this.engine.setState(existingState);

            // Determine if game is active
            if (existingState.phase !== 'waiting' && existingState.phase !== 'ended') {
                this.isGameActive = true;
                console.log('[Host] Game restored as ACTIVE in phase:', existingState.phase);
            }
        }

        // Subscribe to game_participants to detect when players join
        await this.subscribeToParticipants();

        console.log('[Host] Initialized with Realtime subscriptions');
    }

    /**
     * Subscribe to game_participants changes to add players to engine
     */
    private async subscribeToParticipants(): Promise<void> {
        const { data: participants, error } = await supabase
            .from('game_participants')
            .select('user_id, profiles!inner(username)')
            .eq('game_id', this.config.gameId);

        if (error) {
            console.error('[Host] Error fetching participants:', error);
            return;
        }

        // Add existing participants to engine
        if (participants && participants.length > 0) {
            for (let i = 0; i < participants.length; i++) {
                const p = participants[i];
                const username = (p.profiles as any)?.username || 'Player';

                // Check if player already exists in restored state
                const existingPlayer = this.engine.getState().players.find(player => player.id === p.user_id);

                if (!existingPlayer) {
                    try {
                        this.engine.addPlayer(p.user_id, username, i, this.config.buyIn);
                        console.log('[Host] Added existing player:', username, 'at seat', i);
                    } catch (e) {
                        console.warn('[Host] Could not add player:', e);
                    }
                } else {
                    console.log('[Host] Player already in state:', username);
                }
            }

            // Start game if we have >= 2 players AND game is not active
            if (this.engine.getState().players.length >= 2 && !this.isGameActive) {
                this.isGameActive = true;
                this.startNewHand();
            } else if (!this.isGameActive) {
                // Save initial state if waiting
                await this.saveGameState();
            }
        }

        // Listen for new participants joining
        supabase
            .channel(`game-participants-${this.config.gameId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'game_participants',
                    filter: `game_id=eq.${this.config.gameId}`,
                },
                async (payload) => {
                    console.log('[Host] New participant joined:', payload);
                    const newParticipant = payload.new as any;

                    // Fetch profile info including avatar
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('username, avatar_url')
                        .eq('id', newParticipant.user_id)
                        .single();

                    const username = profile?.username || 'Player';
                    const avatarUrl = profile?.avatar_url;
                    const currentPlayers = this.engine.getState().players;
                    const seatPosition = currentPlayers.length;

                    try {
                        this.engine.addPlayer(
                            newParticipant.user_id,
                            username,
                            seatPosition,
                            this.config.buyIn,
                            avatarUrl
                        );
                        console.log('[Host] Added new player:', username, 'at seat', seatPosition);

                        // Start game if we now have >= 2 players
                        if (this.engine.getState().players.length >= 2 && !this.isGameActive) {
                            this.isGameActive = true;
                            this.startNewHand();
                        } else {
                            await this.saveGameState();
                        }
                    } catch (e) {
                        console.error('[Host] Error adding new player:', e);
                    }
                }
            )
            .on(
                'postgres_changes',
                {
                    event: 'DELETE',
                    schema: 'public',
                    table: 'game_participants',
                    filter: `game_id=eq.${this.config.gameId}`,
                },
                async (payload) => {
                    console.log('[Host] Participant left:', payload);
                    const oldParticipant = payload.old as any;
                    const playerId = oldParticipant.user_id;

                    if (!playerId) return;

                    try {
                        // Check if it was this player's turn
                        const currentPlayer = this.engine.getCurrentPlayer();
                        const isTurn = currentPlayer && currentPlayer.id === playerId;

                        // If it was their turn, fold them first to advance game state properly
                        if (isTurn) {
                            console.log('[Host] Player left during turn, folding first');
                            this.engine.fold(playerId);
                        }

                        // Remove player from engine
                        this.engine.removePlayer(playerId);
                        console.log('[Host] Removed player:', playerId);

                        // If only 1 player left, end the game/hand?
                        // For now, just save state. The engine handles "1 player left" logic in determineWinner
                        // but we might need to trigger it if we are mid-hand.

                        const activePlayers = this.engine.getState().players.filter(p => !p.folded && !p.allIn);
                        if (this.isGameActive && activePlayers.length < 2) {
                            // If everyone else folded/left, we might need to force a win check
                            // But let's rely on normal flow for now.
                        }

                        await this.saveGameState();

                    } catch (e) {
                        console.error('[Host] Error removing player:', e);
                    }
                }
            )
            .subscribe();
    }

    private handlePlayerAction(action: PlayerAction): void {
        const { type, amount, playerId } = action;

        console.log('[Host] Processing action from', playerId, ':', type, amount);

        // Validate it's the player's turn
        const currentPlayer = this.engine.getCurrentPlayer();
        if (!currentPlayer || currentPlayer.id !== playerId) {
            console.warn('[Host] Not player turn:', playerId);
            return;
        }

        // Execute action in engine
        let success = false;
        switch (type) {
            case 'fold':
                success = this.engine.fold(playerId);
                break;
            case 'check':
                success = this.engine.check(playerId);
                break;
            case 'call':
                success = this.engine.call(playerId);
                break;
            case 'raise':
                if (amount !== undefined) {
                    success = this.engine.raise(playerId, amount);
                }
                break;
            case 'all-in':
                // All-in is a raise with all remaining chips
                const player = this.engine.getState().players.find(p => p.id === playerId);
                if (player) {
                    const gameState = this.engine.getState();
                    const raiseAmount = player.chips + player.currentBet - gameState.currentBet;
                    success = this.engine.raise(playerId, raiseAmount);
                }
                break;
        }

        if (!success) {
            console.warn('[Host] Action failed:', type);
            return;
        }

        console.log('[Host] Action successful, advancing turn');

        // Move to next player
        this.engine.setNextPlayer();

        // Check if we need to advance phase
        if (this.engine.isBettingRoundComplete()) {
            console.log('[Host] Betting round complete, advancing phase');
            setTimeout(() => this.advanceGamePhase(), 2000);
        } else {
            // Betting round not complete, save state to sync turn to all players
            console.log('[Host] Saving state after action');
            this.saveGameState();
        }
    }

    private async advanceGamePhase(): Promise<void> {
        const gameState = this.engine.getState();

        console.log('[Host] Advancing from phase:', gameState.phase);

        if (gameState.phase === 'showdown' || gameState.phase === 'ended') {
            // Hand is over, start new hand
            setTimeout(() => this.startNewHand(), 3000);
            return;
        }

        this.engine.advancePhase();
        await this.saveGameState();

        // Determine winner at showdown
        if (this.engine.getState().phase === 'showdown') {
            const result = this.engine.determineWinner();
            console.log('[Host] Winners:', result.winners, 'Hand:', result.handName);

            // Mark hand as ended
            setTimeout(async () => {
                await this.saveGameState();
                // Start new hand after delay
                setTimeout(() => this.startNewHand(), 5000);
            }, 2000);
        }
    }

    startNewHand(): void {
        console.log('[Host] Starting new hand');
        this.engine.startNewHand();
        this.saveGameState();
    }

    /**
     * Save game state to Supabase (triggers Realtime update to all clients)
     */
    private async saveGameState(): Promise<void> {
        try {
            const gameState = this.engine.getState();
            await realtimeGameService.updateGameState(this.config.gameId, gameState);
            console.log('[Host] Game state saved and synced via Realtime');
        } catch (error) {
            console.error('[Host] Error saving game state:', error);
        }
    }

    /**
     * Get current game state
     */
    getGameState(): GameState {
        return this.engine.getState();
    }

    /**
     * Host player action methods (host can also play)
     */
    fold(hostUserId: string): void {
        this.handlePlayerAction({ type: 'fold', playerId: hostUserId });
        this.saveGameState();
    }

    check(hostUserId: string): void {
        this.handlePlayerAction({ type: 'check', playerId: hostUserId });
        this.saveGameState();
    }

    call(hostUserId: string): void {
        this.handlePlayerAction({ type: 'call', playerId: hostUserId });
        this.saveGameState();
    }

    raise(hostUserId: string, amount: number): void {
        this.handlePlayerAction({ type: 'raise', amount, playerId: hostUserId });
        this.saveGameState();
    }

    allIn(hostUserId: string): void {
        this.handlePlayerAction({ type: 'all-in', playerId: hostUserId });
        this.saveGameState();
    }

    /**
     * Cleanup and disconnect
     */
    cleanup(): void {
        realtimeGameService.cleanup();
        this.isGameActive = false;
        console.log('[Host] Cleaned up');
    }
}
