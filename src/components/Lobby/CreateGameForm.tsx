import { useState, type FormEvent } from 'react';
import type { GameType } from '../../lib/supabaseClient';
import { supabase } from '../../lib/supabaseClient';

interface CreateGameFormProps {
    userId: string;
    onClose: () => void;
    onGameCreated: (gameId: string) => void;
}

export default function CreateGameForm({ userId, onClose, onGameCreated }: CreateGameFormProps) {
    const [gameName, setGameName] = useState('');
    const [gameType, setGameType] = useState<GameType>('cash');
    const [smallBlind, setSmallBlind] = useState(10);
    const [bigBlind, setBigBlind] = useState(20);
    const [buyIn, setBuyIn] = useState(1000);
    const [maxPlayers, setMaxPlayers] = useState(9);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Tournament-specific fields
    const [startingChips, setStartingChips] = useState(1500);
    const [blindIncreaseInterval, setBlindIncreaseInterval] = useState(10);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Tournament blind schedule array for JSONB column
            const tournamentBlindSchedule = gameType === 'tournament' ? [
                { level: 1, small_blind: smallBlind, big_blind: bigBlind, duration_minutes: blindIncreaseInterval },
                { level: 2, small_blind: smallBlind * 2, big_blind: bigBlind * 2, duration_minutes: blindIncreaseInterval },
                { level: 3, small_blind: smallBlind * 4, big_blind: bigBlind * 4, duration_minutes: blindIncreaseInterval },
                { level: 4, small_blind: smallBlind * 6, big_blind: bigBlind * 6, duration_minutes: blindIncreaseInterval },
                { level: 5, small_blind: smallBlind * 10, big_blind: bigBlind * 10, duration_minutes: blindIncreaseInterval },
            ] : null;

            const { data: game, error: insertError } = await supabase
                .from('games')
                .insert({
                    host_id: userId,
                    game_name: gameName || `${gameType === 'tournament' ? 'Tournament' : 'Cash Game'} Table`,
                    game_type: gameType,
                    variant: 'holdem',
                    small_blind: smallBlind,
                    big_blind: bigBlind,
                    buy_in: buyIn,
                    max_players: maxPlayers,
                    status: 'waiting',
                    tournament_blind_schedule: tournamentBlindSchedule,
                })
                .select()
                .single();

            if (insertError) {
                setError(insertError.message);
                setLoading(false);
                return;
            }

            if (game) {
                // Also insert the host as a participant
                await supabase
                    .from('game_participants')
                    .insert({
                        game_id: game.id,
                        user_id: userId,
                        seat_position: 0, // Host takes seat 0
                        starting_chips: gameType === 'tournament' ? startingChips : buyIn,
                    });

                onGameCreated(game.id);
            }
        } catch (err) {
            setError('Failed to create game');
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Game Type Selection */}
            <div>
                <label className="form-label">Game Type</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <button
                        type="button"
                        onClick={() => setGameType('cash')}
                        className={gameType === 'cash' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ padding: '1rem' }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>💰</div>
                        <div>Cash Game</div>
                    </button>
                    <button
                        type="button"
                        onClick={() => setGameType('tournament')}
                        className={gameType === 'tournament' ? 'btn btn-primary' : 'btn btn-secondary'}
                        style={{ padding: '1rem' }}
                    >
                        <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🏆</div>
                        <div>Tournament</div>
                    </button>
                </div>
            </div>

            {/* Game Name */}
            <div className="form-group">
                <label className="form-label">Game Name (Optional)</label>
                <input
                    type="text"
                    className="input"
                    value={gameName}
                    onChange={(e) => setGameName(e.target.value)}
                    placeholder={`${gameType === 'tournament' ? 'Tournament' : 'Cash Game'} Table`}
                    maxLength={100}
                />
                <small className="text-muted">Give your game a custom name so friends can find it easily</small>
            </div>

            {/* Blinds */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                    <label className="form-label">Small Blind</label>
                    <input
                        type="number"
                        className="input"
                        value={smallBlind}
                        onChange={(e) => {
                            const val = parseInt(e.target.value);
                            setSmallBlind(val);
                            setBigBlind(val * 2);
                        }}
                        min="1"
                        required
                        disabled={loading}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">Big Blind</label>
                    <input
                        type="number"
                        className="input"
                        value={bigBlind}
                        onChange={(e) => setBigBlind(parseInt(e.target.value))}
                        min={smallBlind}
                        required
                        disabled={loading}
                    />
                </div>
            </div>

            {/* Buy-in & Max Players */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div className="form-group">
                    <label className="form-label">Buy-in Amount</label>
                    <input
                        type="number"
                        className="input"
                        value={buyIn}
                        onChange={(e) => setBuyIn(parseInt(e.target.value))}
                        min={bigBlind * 10}
                        required
                        disabled={loading}
                    />
                    <div className="text-muted" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                        Min: {bigBlind * 10}
                    </div>
                </div>
                <div className="form-group">
                    <label className="form-label">Max Players</label>
                    <input
                        type="number"
                        className="input"
                        value={maxPlayers}
                        onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                        min="2"
                        max="9"
                        required
                        disabled={loading}
                    />
                </div>
            </div>

            {/* Tournament-specific settings */}
            {gameType === 'tournament' && (
                <div style={{ padding: '1rem', background: 'rgba(78, 204, 163, 0.1)', borderRadius: '0.5rem' }}>
                    <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>🏆 Tournament Settings</h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">Starting Chips</label>
                            <input
                                type="number"
                                className="input"
                                value={startingChips}
                                onChange={(e) => setStartingChips(parseInt(e.target.value))}
                                min="1000"
                                required
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Blind Level (minutes)</label>
                            <input
                                type="number"
                                className="input"
                                value={blindIncreaseInterval}
                                onChange={(e) => setBlindIncreaseInterval(parseInt(e.target.value))}
                                min="5"
                                max="30"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="text-muted" style={{ fontSize: '0.875rem', marginTop: '0.75rem' }}>
                        <strong>Blind Schedule:</strong>
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                            <div>Level 1: {smallBlind}/{bigBlind} ({blindIncreaseInterval} min)</div>
                            <div>Level 2: {smallBlind * 2}/{bigBlind * 2} ({blindIncreaseInterval} min)</div>
                            <div>Level 3: {smallBlind * 4}/{bigBlind * 4} ({blindIncreaseInterval} min)</div>
                            <div>Level 4: {smallBlind * 6}/{bigBlind * 6} ({blindIncreaseInterval} min)</div>
                            <div>Level 5: {smallBlind * 10}/{bigBlind * 10} ({blindIncreaseInterval} min)</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="text-danger" style={{ padding: '0.75rem', background: 'rgba(255, 71, 87, 0.1)', borderRadius: '0.5rem' }}>
                    {error}
                </div>
            )}

            {/* Info Box */}
            <div style={{ padding: '1rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', fontSize: '0.875rem' }}>
                <div className="text-muted">
                    <strong>💡 Tip:</strong> {gameType === 'cash'
                        ? 'In cash games, players can buy in at any time and leave whenever they want.'
                        : 'In tournaments, all players start with the same chips and play until one player has them all!'
                    }
                </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '1rem' }}>
                <button
                    type="button"
                    onClick={onClose}
                    className="btn btn-secondary"
                    style={{ flex: 1 }}
                    disabled={loading}
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    disabled={loading}
                >
                    {loading ? 'Creating...' : 'Create Game'}
                </button>
            </div>
        </form>
    );
}
