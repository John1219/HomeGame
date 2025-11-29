import { supabase } from '../lib/supabaseClient';
import type { Card } from '../game/PokerEngine';

export interface HandHistoryRecord {
    id: string;
    gameId: string;
    handNumber: number;
    startedAt: string;
    endedAt?: string;
    smallBlind: number;
    bigBlind: number;
    dealerPosition: number;
    startingPot: number;
    flopCards?: Card[];
    turnCard?: Card;
    riverCard?: Card;
    winningPlayerIds?: string[];
    potTotal?: number;
    potDistribution?: { playerId: string; amount: number }[];
    winningHandDescription?: string;
}

export interface HandAction {
    handId: string;
    actionNumber: number;
    bettingRound: 'preflop' | 'flop' | 'turn' | 'river';
    playerId: string;
    seatPosition: number;
    actionType: 'fold' | 'check' | 'call' | 'raise' | 'all_in' | 'blind' | 'post';
    amount: number;
    playerStack: number;
    potBeforeAction: number;
    currentBet: number;
}

export interface PlayerHandCards {
    handId: string;
    playerId: string;
    seatPosition: number;
    holeCards: Card[];
    startingChips: number;
    endingChips: number;
    finalHandRank?: string;
    finalHandValue?: Card[];
    folded: boolean;
    wentAllIn: boolean;
    won: boolean;
    wonAmount: number;
}

class HandHistoryService {
    /**
     * Start a new hand and create the initial hand_history record
     */
    async startHand(
        gameId: string,
        handNumber: number,
        smallBlind: number,
        bigBlind: number,
        dealerPosition: number,
        startingPot: number = 0
    ): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('hand_history')
                .insert({
                    game_id: gameId,
                    hand_number: handNumber,
                    small_blind: smallBlind,
                    big_blind: bigBlind,
                    dealer_position: dealerPosition,
                    starting_pot: startingPot,
                    started_at: new Date().toISOString()
                })
                .select('id')
                .single();

            if (error) {
                console.error('Error starting hand history:', error);
                return null;
            }

            return data.id;
        } catch (err) {
            console.error('Exception in startHand:', err);
            return null;
        }
    }

    /**
     * Record a player action during the hand
     */
    async recordAction(action: HandAction): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('hand_actions')
                .insert({
                    hand_id: action.handId,
                    action_number: action.actionNumber,
                    betting_round: action.bettingRound,
                    player_id: action.playerId,
                    seat_position: action.seatPosition,
                    action_type: action.actionType,
                    amount: action.amount,
                    player_stack: action.playerStack,
                    pot_before_action: action.potBeforeAction,
                    current_bet: action.currentBet
                });

            if (error) {
                console.error('Error recording action:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Exception in recordAction:', err);
            return false;
        }
    }

    /**
     * Record hole cards for a player in this hand
     */
    async recordPlayerCards(cards: PlayerHandCards): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('player_hand_cards')
                .insert({
                    hand_id: cards.handId,
                    player_id: cards.playerId,
                    seat_position: cards.seatPosition,
                    hole_cards: cards.holeCards,
                    starting_chips: cards.startingChips,
                    ending_chips: cards.endingChips,
                    final_hand_rank: cards.finalHandRank,
                    final_hand_value: cards.finalHandValue,
                    folded: cards.folded,
                    went_all_in: cards.wentAllIn,
                    won: cards.won,
                    won_amount: cards.wonAmount
                });

            if (error) {
                console.error('Error recording player cards:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Exception in recordPlayerCards:', err);
            return false;
        }
    }

    /**
     * Update community cards as they're revealed
     */
    async updateCommunityCards(
        handId: string,
        flopCards?: Card[],
        turnCard?: Card,
        riverCard?: Card
    ): Promise<boolean> {
        try {
            const updates: any = {};

            if (flopCards) updates.flop_cards = flopCards;
            if (turnCard) updates.turn_card = turnCard;
            if (riverCard) updates.river_card = riverCard;

            const { error } = await supabase
                .from('hand_history')
                .update(updates)
                .eq('id', handId);

            if (error) {
                console.error('Error updating community cards:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Exception in updateCommunityCards:', err);
            return false;
        }
    }

    /**
     * Finalize the hand with winners and pot distribution
     */
    async endHand(
        handId: string,
        winningPlayerIds: string[],
        potTotal: number,
        potDistribution: { playerId: string; amount: number }[],
        winningHandDescription?: string
    ): Promise<boolean> {
        try {
            const { error } = await supabase
                .from('hand_history')
                .update({
                    ended_at: new Date().toISOString(),
                    winning_player_ids: winningPlayerIds,
                    pot_total: potTotal,
                    pot_distribution: potDistribution,
                    winning_hand_description: winningHandDescription
                })
                .eq('id', handId);

            if (error) {
                console.error('Error ending hand:', error);
                return false;
            }

            // Update player stats for all participants
            for (const dist of potDistribution) {
                const won = dist.amount > 0;
                const wonAmount = dist.amount;

                // Call the database function to update stats
                await supabase.rpc('update_player_stats_from_hand', {
                    p_player_id: dist.playerId,
                    p_won: won,
                    p_amount_won: wonAmount,
                    p_pot_size: potTotal
                });
            }

            return true;
        } catch (err) {
            console.error('Exception in endHand:', err);
            return false;
        }
    }

    /**
     * Get hand history for a specific game
     */
    async getHandsByGame(gameId: string): Promise<HandHistoryRecord[]> {
        try {
            const { data, error } = await supabase
                .from('hand_history')
                .select(`
                    id,
                    game_id,
                    hand_number,
                    started_at,
                    ended_at,
                    small_blind,
                    big_blind,
                    dealer_position,
                    starting_pot,
                    flop_cards,
                    turn_card,
                    river_card,
                    winning_player_ids,
                    pot_total,
                    pot_distribution,
                    winning_hand_description
                `)
                .eq('game_id', gameId)
                .order('hand_number', { ascending: true });

            if (error) {
                console.error('Error fetching hands:', error);
                return [];
            }

            // Map database fields to camelCase
            return (data || []).map(row => ({
                id: row.id,
                gameId: row.game_id,
                handNumber: row.hand_number,
                startedAt: row.started_at,
                endedAt: row.ended_at,
                smallBlind: row.small_blind,
                bigBlind: row.big_blind,
                dealerPosition: row.dealer_position,
                startingPot: row.starting_pot,
                flopCards: row.flop_cards,
                turnCard: row.turn_card,
                riverCard: row.river_card,
                winningPlayerIds: row.winning_player_ids,
                potTotal: row.pot_total,
                potDistribution: row.pot_distribution,
                winningHandDescription: row.winning_hand_description
            }));
        } catch (err) {
            console.error('Exception in getHandsByGame:', err);
            return [];
        }
    }

    /**
     * Get complete hand details including all actions and player cards
     */
    async getHandDetails(handId: string) {
        try {
            // Get hand summary
            const { data: hand, error: handError } = await supabase
                .from('hand_history')
                .select('*')
                .eq('id', handId)
                .single();

            if (handError) throw handError;

            // Get all actions
            const { data: actions, error: actionsError } = await supabase
                .from('hand_actions')
                .select('*')
                .eq('hand_id', handId)
                .order('action_number', { ascending: true });

            if (actionsError) throw actionsError;

            // Get player cards
            const { data: playerCards, error: cardsError } = await supabase
                .from('player_hand_cards')
                .select('*')
                .eq('hand_id', handId);

            if (cardsError) throw cardsError;

            return {
                hand,
                actions: actions || [],
                playerCards: playerCards || []
            };
        } catch (err) {
            console.error('Exception in getHandDetails:', err);
            return null;
        }
    }
}

export const handHistoryService = new HandHistoryService();
