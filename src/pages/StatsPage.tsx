import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';
import { supabase } from '../lib/supabaseClient';
import './StatsPage.css';

interface PlayerStats {
    totalHandsPlayed: number;
    handsWon: number;
    totalChipsWon: number;
    totalChipsLost: number;
    biggestPot: number;
    winRate: number;
}

export default function StatsPage() {
    const navigate = useNavigate();
    const user = useAppSelector((state) => state.user.user);
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [recentHands, setRecentHands] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;

        const fetchStats = async () => {
            try {
                // Fetch player stats
                const { data: playerStats, error } = await supabase
                    .from('player_stats')
                    .select('*')
                    .eq('user_id', user.id)
                    .single();

                if (error && error.code !== 'PGRST116') {
                    console.error('Error fetching stats:', error);
                } else if (playerStats) {
                    const winRate = playerStats.total_hands_played > 0
                        ? (playerStats.hands_won / playerStats.total_hands_played) * 100
                        : 0;

                    setStats({
                        totalHandsPlayed: playerStats.total_hands_played || 0,
                        handsWon: playerStats.hands_won || 0,
                        totalChipsWon: playerStats.total_chips_won || 0,
                        totalChipsLost: playerStats.total_chips_lost || 0,
                        biggestPot: playerStats.biggest_pot || 0,
                        winRate
                    });
                }

                // Fetch recent hands
                const { data: participatedGames } = await supabase
                    .from('game_participants')
                    .select('game_id')
                    .eq('user_id', user.id)
                    .order('joined_at', { ascending: false })
                    .limit(5);

                if (participatedGames && participatedGames.length > 0) {
                    const gameIds = participatedGames.map(g => g.game_id);
                    const { data: hands } = await supabase
                        .from('hand_history')
                        .select('*')
                        .in('game_id', gameIds)
                        .order('started_at', { ascending: false })
                        .limit(10);

                    if (hands) {
                        setRecentHands(hands);
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching stats:', err);
                setLoading(false);
            }
        };

        fetchStats();
    }, [user]);

    if (!user) {
        return (
            <div className="stats-page">
                <div className="stats-empty">
                    <h2>Please log in to view your statistics</h2>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="stats-page">
                <div className="stats-loading">Loading statistics...</div>
            </div>
        );
    }

    return (
        <div className="stats-page">
            <div className="stats-header">
                <h1>Player Statistics</h1>
                <button
                    className="return-lobby-btn"
                    onClick={() => navigate('/lobby')}
                >
                    ← Return to Lobby
                </button>
            </div>

            <div className="stats-overview">
                <div className="stat-card">
                    <div className="stat-value">{stats?.totalHandsPlayed || 0}</div>
                    <div className="stat-label">Hands Played</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.handsWon || 0}</div>
                    <div className="stat-label">Hands Won</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.winRate.toFixed(1) || 0}%</div>
                    <div className="stat-label">Win Rate</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">${(stats?.totalChipsWon || 0).toLocaleString()}</div>
                    <div className="stat-label">Total Winnings</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">${(stats?.biggestPot || 0).toLocaleString()}</div>
                    <div className="stat-label">Biggest Pot Won</div>
                </div>
            </div>

            <div className="recent-hands-section">
                <h2>Recent Hands</h2>

                {recentHands.length === 0 ? (
                    <div className="no-hands">
                        <p>No hand history available yet.</p>
                        <p>Play some games to see your hand history here!</p>
                    </div>
                ) : (
                    <div className="hands-list">
                        {recentHands.map(hand => (
                            <div key={hand.id} className="hand-card">
                                <div className="hand-header">
                                    <span className="hand-number">Hand #{hand.hand_number}</span>
                                    <span className="hand-date">
                                        {new Date(hand.started_at).toLocaleString()}
                                    </span>
                                </div>
                                <div className="hand-details">
                                    <div className="hand-blinds">
                                        Blinds: ${hand.small_blind}/${hand.big_blind}
                                    </div>
                                    {hand.pot_total && (
                                        <div className="hand-pot">
                                            Pot: ${hand.pot_total.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                                {hand.winning_hand_description && (
                                    <div className="hand-result">
                                        {hand.winning_hand_description}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
