import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { authService } from '../../services/authService';
import { clearUser } from '../../store/userSlice';
import { supabase } from '../../lib/supabaseClient';
import type { Game } from '../../lib/supabaseClient';
import CreateGameForm from './CreateGameForm';

export default function GameLobby() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user, profile } = useAppSelector((state) => state.user);
    const [games, setGames] = useState<Game[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    useEffect(() => {
        loadGames();

        // Subscribe to game updates
        const channel = supabase
            .channel('games-channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, () => {
                loadGames();
            })
            .subscribe();

        // Cleanup empty games every minute
        const cleanupInterval = setInterval(async () => {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

            // Delete games that have been empty for 10+ minutes
            await supabase
                .from('games')
                .delete()
                .lt('last_activity_at', tenMinutesAgo)
                .in('status', ['waiting', 'active']);

            // Refresh the game list after cleanup
            loadGames();
        }, 60000); // Run every minute

        return () => {
            channel.unsubscribe();
            clearInterval(cleanupInterval);
        };
    }, []);

    const loadGames = async () => {
        const { data } = await supabase
            .from('games')
            .select('*')
            .in('status', ['waiting', 'active'])
            .order('created_at', { ascending: false });

        if (data) {
            setGames(data as Game[]);
        }
        setLoading(false);
    };

    const handleLogout = async () => {
        await authService.signOut();
        dispatch(clearUser());
        navigate('/login');
    };

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎰 HomeGame Poker</h1>
                    <p className="text-muted">Welcome back, {profile?.username || 'Player'}!</p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div className="glass-card" style={{ padding: '0.75rem 1.5rem' }}>
                        <div className="text-muted" style={{ fontSize: '0.875rem' }}>Your Chips</div>
                        <div className="text-gold" style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                            {profile?.chips_balance?.toLocaleString() || '0'}
                        </div>
                    </div>
                    <button onClick={() => navigate('/profile')} className="btn btn-secondary">
                        Profile
                    </button>
                    <button onClick={() => navigate('/stats')} className="btn btn-secondary">
                        Stats
                    </button>
                    <button onClick={handleLogout} className="btn btn-danger">
                        Logout
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
                {/* Active Games */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h2 style={{ fontSize: '1.5rem' }}>Active Games</h2>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="btn btn-primary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                            <span>+ Host New Game</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                        </div>
                    ) : games.length === 0 ? (
                        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🃏</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>No Active Games</h3>
                            <p className="text-muted">Be the first to host a game!</p>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="btn btn-primary"
                                style={{ marginTop: '1rem' }}
                            >
                                Host New Game
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {games.map((game) => (
                                <div key={game.id} className="glass-card" style={{ padding: '1.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>
                                                    {(game as any).game_name || `${game.game_type === 'tournament' ? 'Tournament' : 'Cash Game'} Table`}
                                                </h3>
                                                <span
                                                    className={game.status === 'waiting' ? 'text-primary' : 'text-warning'}
                                                    style={{
                                                        padding: '0.25rem 0.75rem',
                                                        background: game.status === 'waiting' ? 'rgba(78, 204, 163, 0.1)' : 'rgba(255, 165, 2, 0.1)',
                                                        borderRadius: '1rem',
                                                        fontSize: '0.875rem',
                                                    }}
                                                >
                                                    {game.status === 'waiting' ? 'Waiting' : 'In Progress'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                                                {game.game_type === 'tournament' ? '🏆' : '💰'} {game.variant.toUpperCase()}
                                            </div>
                                            <div style={{ display: 'flex', gap: '2rem', fontSize: '0.875rem' }} className="text-muted">
                                                <span>Blinds: {game.small_blind}/{game.big_blind}</span>
                                                <span>Buy-in: {game.buy_in}</span>
                                                <span>Type: {game.game_type}</span>
                                            </div>
                                        </div>
                                        <button
                                            className="btn btn-primary"
                                            disabled={game.status !== 'waiting'}
                                            onClick={() => navigate(`/game/${game.id}`)}
                                        >
                                            {game.status === 'waiting' ? 'Join Game' : 'Spectate'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Quick Stats & Info */}
                <div>
                    <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Quick Info</h2>

                    <div className="glass-card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>🎮 How to Play</h3>
                        <ul style={{ paddingLeft: '1.25rem', fontSize: '0.875rem' }} className="text-muted">
                            <li style={{ marginBottom: '0.5rem' }}>Click "Host New Game" to start</li>
                            <li style={{ marginBottom: '0.5rem' }}>Set your blinds and buy-in</li>
                            <li style={{ marginBottom: '0.5rem' }}>Share game code with friends</li>
                            <li style={{ marginBottom: '0.5rem' }}>Enjoy video, voice, and text chat!</li>
                        </ul>
                    </div>

                    <div className="glass-card" style={{ padding: '1.5rem' }}>
                        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>💡 Features</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem' }} className="text-muted">
                            <div>✅ Texas Hold'em</div>
                            <div>✅ Cash & Tournament modes</div>
                            <div>✅ Video/Voice/Text chat</div>
                            <div>✅ Statistics tracking</div>
                            <div>✅ 100% Free - Play money!</div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Game Modal */}
            {showCreateModal && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.8)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000,
                    }}
                    onClick={() => setShowCreateModal(false)}
                >
                    <div
                        className="glass-card"
                        style={{ padding: '2rem', maxWidth: '600px', width: '100%', margin: '1rem' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ marginBottom: '1.5rem' }}>🎰 Create New Game</h2>
                        <CreateGameForm
                            userId={user?.id || ''}
                            onClose={() => setShowCreateModal(false)}
                            onGameCreated={(gameId) => {
                                setShowCreateModal(false);
                                navigate(`/game/${gameId}`);
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
