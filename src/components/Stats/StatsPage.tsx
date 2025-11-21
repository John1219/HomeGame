import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../../store/hooks';
import { statsService } from '../../services/statsService';
import type { PlayerStats } from '../../lib/supabaseClient';

interface GameHistoryItem {
    id: string;
    game_type: string;
    variant: string;
    small_blind: number;
    big_blind: number;
    started_at: string;
    ended_at: string;
    placement?: number;
    ending_chips?: number;
    hands_won: number;
}

interface LeaderboardEntry {
    user_id: string;
    username: string;
    avatar_url: string | null;
    total_hands_played: number;
    hands_won: number;
    cash_game_profit: number;
    tournaments_won: number;
}

export default function StatsPage() {
    const navigate = useNavigate();
    const { user } = useAppSelector((state) => state.user);

    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [gameHistory, setGameHistory] = useState<GameHistoryItem[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'stats' | 'history' | 'leaderboard'>('stats');

    useEffect(() => {
        if (user?.id) {
            loadAllData();
        }
    }, [user?.id]);

    const loadAllData = async () => {
        if (!user?.id) return;

        setLoading(true);

        // Load player stats
        const { stats: playerStats } = await statsService.getPlayerStats(user.id);
        if (playerStats) {
            setStats(playerStats);
        }

        // Load game history
        const { history, error: historyError } = await statsService.getGameHistory(user.id);
        if (history && !historyError) {
            // Transform the nested structure from Supabase
            const transformedHistory = history
                .filter((item: any) => item.games) // Filter out any entries without game data
                .map((item: any) => ({
                    id: item.games.id,
                    game_type: item.games.game_type,
                    variant: item.games.variant,
                    small_blind: item.games.small_blind,
                    big_blind: item.games.big_blind,
                    started_at: item.games.started_at,
                    ended_at: item.games.ended_at,
                    placement: item.placement,
                    ending_chips: item.ending_chips,
                    hands_won: item.hands_won,
                }));
            setGameHistory(transformedHistory);
        } else {
            setGameHistory([]);
        }

        // Load leaderboard
        const { leaderboard: leaderboardData, error: leaderboardError } = await statsService.getLeaderboard(10);
        if (leaderboardData && !leaderboardError) {
            setLeaderboard(leaderboardData as LeaderboardEntry[]);
        } else {
            setLeaderboard([]);
        }

        setLoading(false);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const calculateWinRate = () => {
        if (!stats || stats.total_hands_played === 0) return 0;
        return ((stats.hands_won / stats.total_hands_played) * 100).toFixed(1);
    };

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem' }}>📊 Statistics Dashboard</h1>
                    <button onClick={() => navigate('/lobby')} className="btn btn-secondary">
                        ← Back to Lobby
                    </button>
                </div>

                {/* Tab Navigation */}
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={activeTab === 'stats' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'stats' ? '3px solid var(--primary)' : 'none'
                        }}
                    >
                        📈 Statistics
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={activeTab === 'history' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'history' ? '3px solid var(--primary)' : 'none'
                        }}
                    >
                        🎮 Game History
                    </button>
                    <button
                        onClick={() => setActiveTab('leaderboard')}
                        className={activeTab === 'leaderboard' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{
                            borderRadius: '0.5rem 0.5rem 0 0',
                            borderBottom: activeTab === 'leaderboard' ? '3px solid var(--primary)' : 'none'
                        }}
                    >
                        🏆 Leaderboard
                    </button>
                </div>

                {loading ? (
                    <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                        <div className="spinner" style={{ margin: '0 auto' }}></div>
                    </div>
                ) : (
                    <>
                        {/* Statistics Tab */}
                        {activeTab === 'stats' && stats && (
                            <div>
                                {/* Overall Stats */}
                                <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Overall Performance</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div style={{ padding: '1.5rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Hands</div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.total_hands_played.toLocaleString()}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Hands Won</div>
                                            <div style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.hands_won.toLocaleString()}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Win Rate</div>
                                            <div className="text-primary" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{calculateWinRate()}%</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Biggest Pot</div>
                                            <div className="text-gold" style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>{stats.biggest_pot.toLocaleString()}</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Cash Game Stats */}
                                <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>💰 Cash Game Performance</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Games Played</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.cash_games_played}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Total Profit/Loss</div>
                                            <div className={stats.cash_game_profit >= 0 ? 'text-primary' : 'text-danger'} style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                {stats.cash_game_profit >= 0 ? '+' : ''}{stats.cash_game_profit.toLocaleString()}
                                            </div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Chips Won</div>
                                            <div className="text-primary" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                {stats.total_chips_won.toLocaleString()}
                                            </div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Chips Lost</div>
                                            <div className="text-danger" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                {stats.total_chips_lost.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tournament Stats */}
                                <div className="glass-card" style={{ padding: '2rem' }}>
                                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>🏆 Tournament Performance</h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Tournaments Played</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.tournaments_played}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Victories</div>
                                            <div className="text-gold" style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.tournaments_won}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Top 3 Finishes</div>
                                            <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{stats.tournament_top_3}</div>
                                        </div>

                                        <div style={{ padding: '1.5rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem', textAlign: 'center' }}>
                                            <div className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Win Rate</div>
                                            <div className="text-gold" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                {stats.tournaments_played > 0
                                                    ? ((stats.tournaments_won / stats.tournaments_played) * 100).toFixed(1)
                                                    : '0'}%
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Game History Tab */}
                        {activeTab === 'history' && (
                            <div className="glass-card" style={{ padding: '2rem' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Recent Games</h2>
                                {gameHistory.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎮</div>
                                        <p className="text-muted">No game history yet. Play some games to see your history!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                        {gameHistory.map((game) => (
                                            <div key={game.id} style={{ padding: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                            <span style={{ fontSize: '1.5rem' }}>
                                                                {game.game_type === 'tournament' ? '🏆' : '💰'}
                                                            </span>
                                                            <h3 style={{ fontSize: '1.25rem' }}>
                                                                {game.variant.toUpperCase()} - {game.game_type}
                                                            </h3>
                                                            {game.placement && (
                                                                <span
                                                                    className={game.placement === 1 ? 'text-gold' : game.placement <= 3 ? 'text-primary' : 'text-muted'}
                                                                    style={{
                                                                        padding: '0.25rem 0.75rem',
                                                                        background: game.placement === 1 ? 'rgba(255, 165, 2, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                                                                        borderRadius: '1rem',
                                                                        fontSize: '0.875rem',
                                                                    }}
                                                                >
                                                                    {game.placement === 1 ? '🥇' : game.placement === 2 ? '🥈' : game.placement === 3 ? '🥉' : `#${game.placement}`}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }} className="text-muted">
                                                            <span>Blinds: {game.small_blind}/{game.big_blind}</span>
                                                            <span>Hands Won: {game.hands_won}</span>
                                                            {game.ending_chips !== undefined && (
                                                                <span>Final Chips: {game.ending_chips.toLocaleString()}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div style={{ textAlign: 'right' }}>
                                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                            {formatDate(game.ended_at || game.started_at)}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Leaderboard Tab */}
                        {activeTab === 'leaderboard' && (
                            <div className="glass-card" style={{ padding: '2rem' }}>
                                <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Top Players</h2>
                                {leaderboard.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem' }}>
                                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🏆</div>
                                        <p className="text-muted">No leaderboard data yet!</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                        {leaderboard.map((player, index) => (
                                            <div
                                                key={player.user_id}
                                                style={{
                                                    padding: '1rem 1.5rem',
                                                    background: index === 0
                                                        ? 'linear-gradient(135deg, rgba(255, 165, 2, 0.2), rgba(255, 165, 2, 0.1))'
                                                        : index === 1
                                                            ? 'linear-gradient(135deg, rgba(192, 192, 192, 0.2), rgba(192, 192, 192, 0.1))'
                                                            : index === 2
                                                                ? 'linear-gradient(135deg, rgba(205, 127, 50, 0.2), rgba(205, 127, 50, 0.1))'
                                                                : 'rgba(255, 255, 255, 0.03)',
                                                    borderRadius: '0.5rem',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '1.5rem',
                                                }}
                                            >
                                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', minWidth: '2rem' }}>
                                                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}
                                                </div>

                                                <div
                                                    style={{
                                                        width: '50px',
                                                        height: '50px',
                                                        borderRadius: '50%',
                                                        background: player.avatar_url
                                                            ? `url(${player.avatar_url}) center/cover`
                                                            : 'linear-gradient(135deg, rgba(78, 204, 163, 0.2), rgba(78, 204, 163, 0.5))',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '1.5rem',
                                                    }}
                                                >
                                                    {!player.avatar_url && '👤'}
                                                </div>

                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '1.125rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
                                                        {player.username}
                                                        {player.user_id === user?.id && (
                                                            <span className="text-primary" style={{ marginLeft: '0.5rem', fontSize: '0.875rem' }}>(You)</span>
                                                        )}
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem' }} className="text-muted">
                                                        <span>Hands: {player.total_hands_played.toLocaleString()}</span>
                                                        <span>Won: {player.hands_won.toLocaleString()}</span>
                                                        <span className={player.cash_game_profit >= 0 ? 'text-primary' : 'text-danger'}>
                                                            Profit: {player.cash_game_profit >= 0 ? '+' : ''}{player.cash_game_profit.toLocaleString()}
                                                        </span>
                                                        <span className="text-gold">Tournaments: {player.tournaments_won}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
