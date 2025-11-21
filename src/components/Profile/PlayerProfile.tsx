import { useState, useEffect, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import { authService } from '../../services/authService';
import { statsService } from '../../services/statsService';
import { setProfile } from '../../store/userSlice';
import type { PlayerStats } from '../../lib/supabaseClient';

export default function PlayerProfile() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { user, profile } = useAppSelector((state) => state.user);

    const [isEditing, setIsEditing] = useState(false);
    const [newUsername, setNewUsername] = useState(profile?.username || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [stats, setStats] = useState<PlayerStats | null>(null);
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (user?.id) {
            loadStats();
        }
    }, [user?.id]);

    const loadStats = async () => {
        if (!user?.id) return;
        const { stats: playerStats } = await statsService.getPlayerStats(user.id);
        if (playerStats) {
            setStats(playerStats);
        }
    };

    const handleUpdateUsername = async () => {
        if (!user?.id || !newUsername.trim()) return;

        setLoading(true);
        setError(null);
        setSuccess(null);

        const { error: updateError } = await authService.updateProfile(user.id, {
            username: newUsername.trim(),
        });

        if (updateError) {
            setError(updateError.message);
            setLoading(false);
            return;
        }

        // Reload profile
        const { profile: updatedProfile } = await authService.getProfile(user.id);
        if (updatedProfile) {
            dispatch(setProfile(updatedProfile));
            setSuccess('Username updated successfully!');
            setIsEditing(false);
        }

        setLoading(false);
    };

    const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select an image file');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Image must be less than 2MB');
            return;
        }

        setUploading(true);
        setError(null);

        const { avatarUrl, error: uploadError } = await authService.uploadAvatar(user.id, file);

        if (uploadError) {
            setError(uploadError.message);
            setUploading(false);
            return;
        }

        if (avatarUrl) {
            // Update profile with new avatar URL
            await authService.updateProfile(user.id, { avatar_url: avatarUrl });

            // Reload profile
            const { profile: updatedProfile } = await authService.getProfile(user.id);
            if (updatedProfile) {
                dispatch(setProfile(updatedProfile));
                setSuccess('Avatar updated successfully!');
            }
        }

        setUploading(false);
    };

    return (
        <div style={{ minHeight: '100vh', padding: '2rem' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '2rem' }}>👤 Player Profile</h1>
                    <button onClick={() => navigate('/lobby')} className="btn btn-secondary">
                        ← Back to Lobby
                    </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                    {/* Left Column - Profile Info */}
                    <div>
                        <div className="glass-card" style={{ padding: '2rem', textAlign: 'center' }}>
                            {/* Avatar */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <div
                                    style={{
                                        width: '150px',
                                        height: '150px',
                                        borderRadius: '50%',
                                        margin: '0 auto',
                                        background: profile?.avatar_url
                                            ? `url(${profile.avatar_url}) center/cover`
                                            : 'linear-gradient(135deg, rgba(78, 204, 163, 0.2), rgba(78, 204, 163, 0.5))',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '3rem',
                                        border: '3px solid rgba(78, 204, 163, 0.3)',
                                    }}
                                >
                                    {!profile?.avatar_url && '👤'}
                                </div>

                                <label
                                    htmlFor="avatar-upload"
                                    className="btn btn-secondary"
                                    style={{ marginTop: '1rem', cursor: 'pointer', display: 'inline-block' }}
                                >
                                    {uploading ? 'Uploading...' : '📷 Change Avatar'}
                                </label>
                                <input
                                    id="avatar-upload"
                                    type="file"
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    disabled={uploading}
                                    style={{ display: 'none' }}
                                />
                            </div>

                            {/* Username */}
                            <div style={{ marginBottom: '1rem' }}>
                                {isEditing ? (
                                    <div>
                                        <input
                                            type="text"
                                            className="input"
                                            value={newUsername}
                                            onChange={(e) => setNewUsername(e.target.value)}
                                            disabled={loading}
                                            maxLength={50}
                                            style={{ marginBottom: '0.5rem' }}
                                        />
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                onClick={handleUpdateUsername}
                                                className="btn btn-primary"
                                                disabled={loading || !newUsername.trim()}
                                                style={{ flex: 1 }}
                                            >
                                                {loading ? 'Saving...' : '✓ Save'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setNewUsername(profile?.username || '');
                                                    setError(null);
                                                }}
                                                className="btn btn-secondary"
                                                disabled={loading}
                                                style={{ flex: 1 }}
                                            >
                                                ✕ Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{profile?.username}</h2>
                                        <button
                                            onClick={() => setIsEditing(true)}
                                            className="btn btn-secondary"
                                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                        >
                                            ✏️ Edit Username
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Messages */}
                            {error && (
                                <div className="text-danger" style={{ padding: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                    {error}
                                </div>
                            )}
                            {success && (
                                <div className="text-primary" style={{ padding: '0.75rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                    {success}
                                </div>
                            )}

                            {/* Chip Balance */}
                            <div style={{ padding: '1rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem' }}>
                                <div className="text-muted" style={{ fontSize: '0.875rem' }}>Chip Balance</div>
                                <div className="text-gold" style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                    {profile?.chips_balance?.toLocaleString() || '0'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Stats */}
                    <div>
                        <div className="glass-card" style={{ padding: '2rem', marginBottom: '1.5rem' }}>
                            <h2 style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>📊 Statistics Summary</h2>

                            {stats ? (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                                    {/* Overall Stats */}
                                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Total Hands</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.total_hands_played?.toLocaleString()}</div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Hands Won</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.hands_won?.toLocaleString()}</div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Win Rate</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {stats.total_hands_played > 0
                                                ? ((stats.hands_won / stats.total_hands_played) * 100).toFixed(1)
                                                : '0'}%
                                        </div>
                                    </div>

                                    {/* Cash Game Stats */}
                                    <div style={{ padding: '1rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Cash Games</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.cash_games_played}</div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Cash Profit</div>
                                        <div className={stats.cash_game_profit >= 0 ? 'text-primary' : 'text-danger'} style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
                                            {stats.cash_game_profit >= 0 ? '+' : ''}{stats.cash_game_profit?.toLocaleString()}
                                        </div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Biggest Pot</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.biggest_pot?.toLocaleString()}</div>
                                    </div>

                                    {/* Tournament Stats */}
                                    <div style={{ padding: '1rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Tournaments</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.tournaments_played}</div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Wins</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.tournaments_won}</div>
                                    </div>

                                    <div style={{ padding: '1rem', background: 'rgba(255, 165, 2, 0.1)', borderRadius: '0.5rem' }}>
                                        <div className="text-muted" style={{ fontSize: '0.75rem' }}>Top 3 Finishes</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.tournament_top_3}</div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '2rem' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
                                    <p className="text-muted">No statistics yet. Play some games to see your stats!</p>
                                </div>
                            )}
                        </div>

                        {/* Quick Actions */}
                        <div className="glass-card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem' }}>Quick Actions</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                <button onClick={() => navigate('/lobby')} className="btn btn-primary">
                                    🎰 Join a Game
                                </button>
                                <button onClick={() => navigate('/stats')} className="btn btn-secondary">
                                    📊 View Detailed Stats
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
