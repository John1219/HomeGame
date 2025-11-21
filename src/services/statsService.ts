import { supabase } from '../lib/supabaseClient';
import type { PlayerStats } from '../lib/supabaseClient';

/**
 * Statistics service for tracking and retrieving player stats
 */
class StatsService {
    /**
     * Get player stats by user ID
     */
    async getPlayerStats(userId: string) {
        const { data, error } = await supabase
            .from('player_stats')
            .select('*')
            .eq('user_id', userId)
            .single();

        return { stats: data as PlayerStats | null, error };
    }

    /**
     * Get leaderboard (top players by various metrics)
     */
    async getLeaderboard(limit: number = 10, orderBy: 'chips_won' | 'tournaments_won' | 'hands_won' = 'chips_won') {
        const column = orderBy === 'chips_won'
            ? 'total_chips_won'
            : orderBy === 'tournaments_won'
                ? 'tournaments_won'
                : 'hands_won';

        const { data, error } = await supabase
            .from('player_stats')
            .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
            .order(column, { ascending: false })
            .limit(limit);

        return { leaderboard: data, error };
    }

    /**
     * Get game history for a user
     */
    async getGameHistory(userId: string, limit: number = 20) {
        const { data, error } = await supabase
            .from('game_participants')
            .select(`
        *,
        games:game_id (
          id,
          game_type,
          variant,
          small_blind,
          big_blind,
          buy_in,
          status,
          started_at,
          ended_at
        )
      `)
            .eq('user_id', userId)
            .order('joined_at', { ascending: false })
            .limit(limit);

        return { history: data, error };
    }

    /**
     * Update player stats after a game
     */
    async updateStatsAfterGame(
        userId: string,
        updates: {
            hands_played: number;
            hands_won: number;
            chips_won?: number;
            chips_lost?: number;
            biggest_pot?: number;
            is_tournament?: boolean;
            tournament_won?: boolean;
            tournament_placement?: number;
        }
    ) {
        try {
            // Get current stats
            const { data: currentStats } = await supabase
                .from('player_stats')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (!currentStats) {
                // Create new stats record if doesn't exist
                const { error } = await supabase
                    .from('player_stats')
                    .insert([{ user_id: userId }]);

                if (error) return { error };
            }

            // Calculate new values
            const newStats: Partial<PlayerStats> = {
                total_hands_played: (currentStats?.total_hands_played || 0) + updates.hands_played,
                hands_won: (currentStats?.hands_won || 0) + updates.hands_won,
            };

            if (updates.chips_won) {
                newStats.total_chips_won = (currentStats?.total_chips_won || 0) + updates.chips_won;
            }

            if (updates.chips_lost) {
                newStats.total_chips_lost = (currentStats?.total_chips_lost || 0) + updates.chips_lost;
            }

            if (updates.biggest_pot && updates.biggest_pot > (currentStats?.biggest_pot || 0)) {
                newStats.biggest_pot = updates.biggest_pot;
            }

            if (updates.is_tournament) {
                newStats.tournaments_played = (currentStats?.tournaments_played || 0) + 1;

                if (updates.tournament_won) {
                    newStats.tournaments_won = (currentStats?.tournaments_won || 0) + 1;
                }

                if (updates.tournament_placement && updates.tournament_placement <= 3) {
                    newStats.tournament_top_3 = (currentStats?.tournament_top_3 || 0) + 1;
                }
            } else {
                newStats.cash_games_played = (currentStats?.cash_games_played || 0) + 1;

                const profit = (updates.chips_won || 0) - (updates.chips_lost || 0);
                newStats.cash_game_profit = (currentStats?.cash_game_profit || 0) + profit;
            }

            // Update stats
            const { error } = await supabase
                .from('player_stats')
                .update(newStats)
                .eq('user_id', userId);

            return { error };
        } catch (error) {
            return { error };
        }
    }

    /**
     * Get statistics for multiple users (for game summaries)
     */
    async getMultiplePlayerStats(userIds: string[]) {
        const { data, error } = await supabase
            .from('player_stats')
            .select(`
        *,
        profiles:user_id (
          username,
          avatar_url
        )
      `)
            .in('user_id', userIds);

        return { stats: data, error };
    }

    /**
     * Get win rate for a user
     */
    async getWinRate(userId: string) {
        const { stats } = await this.getPlayerStats(userId);

        if (!stats || stats.total_hands_played === 0) {
            return { winRate: 0, error: null };
        }

        const winRate = (stats.hands_won / stats.total_hands_played) * 100;
        return { winRate, error: null };
    }

    /**
     * Get profit/loss for a user
     */
    async getProfitLoss(userId: string) {
        const { stats } = await this.getPlayerStats(userId);

        if (!stats) {
            return { profitLoss: 0, error: null };
        }

        const profitLoss = stats.total_chips_won - stats.total_chips_lost;
        return { profitLoss, error: null };
    }
}

export const statsService = new StatsService();
