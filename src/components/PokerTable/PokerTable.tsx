import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../../store/hooks';
import type { GameState, Player } from '../../game/PokerEngine';
import { GameHostController, type GameConfig } from '../../game/GameHostController';
import { GameClientController } from '../../game/GameClientController';
import { setGameState, setIsHost, setConnectionStatus, setSystemMessage, setError, resetGame } from '../../store/gameSlice';
import PlayerSeat from './PlayerSeat';
import CommunityCards from './CommunityCards';
import ActionButtons from './ActionButtons';
import PotDisplay from './PotDisplay';
import './PokerTable.css';

export default function PokerTable() {
    const { gameId } = useParams<{ gameId: string }>();
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const user = useAppSelector(state => state.user.user);
    const gameState = useAppSelector(state => state.game);
    const connectionStatus = useAppSelector(state => state.game.connectionStatus);
    const systemMessage = useAppSelector(state => state.game.systemMessage);
    const error = useAppSelector(state => state.game.error);

    const [loading, setLoading] = useState(true);
    const [gameInfo, setGameInfo] = useState<any>(null);
    const [controller, setController] = useState<GameHostController | GameClientController | null>(null);
    const [hasJoined, setHasJoined] = useState(false);
    const [selectedSeat, setSelectedSeat] = useState<number>(0);
    const controllerRef = useRef<GameHostController | GameClientController | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize game and controller
    useEffect(() => {
        if (!gameId || !user) {
            navigate('/lobby');
            return;
        }

        const initializeGame = async () => {
            try {
                // Fetch game info from Supabase
                const { supabase } = await import('../../lib/supabaseClient');
                const { data: game, error: fetchError } = await supabase
                    .from('games')
                    .select('*')
                    .eq('id', gameId)
                    .single();

                if (fetchError || !game) {
                    dispatch(setError('Game not found'));
                    setLoading(false);
                    return;
                }

                setGameInfo(game);

                // Determine if user is host
                const isUserHost = game.host_id === user.id;
                dispatch(setIsHost(isUserHost));

                // Initialize appropriate controller
                if (isUserHost) {
                    // Initialize as host
                    const config: GameConfig = {
                        gameId: gameId,
                        smallBlind: game.small_blind,
                        bigBlind: game.big_blind,
                        maxPlayers: game.max_players,
                        buyIn: game.buy_in,
                    };

                    const hostController = new GameHostController(config);
                    await hostController.initialize(user.id);

                    // Fetch host's profile for avatar
                    const { data: profileData } = await supabase
                        .from('profiles')
                        .select('avatar_url')
                        .eq('id', user.id)
                        .single();

                    // Add host as a player at seat 0
                    const hostUsername = user.user_metadata?.username || user.email || 'Host';
                    const hostState = hostController.getGameState();
                    hostState.players.push({
                        id: user.id,
                        username: hostUsername,
                        avatarUrl: profileData?.avatar_url || undefined,
                        seatPosition: 0,
                        chips: config.buyIn,
                        cards: [],
                        currentBet: 0,
                        folded: false,
                        allIn: false,
                        isDealer: false,
                        isSmallBlind: false,
                        isBigBlind: false,
                        hasActed: false,
                    });

                    // Set up state updates
                    intervalRef.current = setInterval(() => {
                        const currentState = hostController.getGameState();
                        dispatch(setGameState(currentState));
                    }, 500); // Update UI every 500ms

                    setController(hostController);
                    controllerRef.current = hostController;

                    // Auto-join host to the game
                    setHasJoined(true);
                } else {
                    // Initialize as client
                    const clientController = new GameClientController(gameId, user.id);

                    // Set up callbacks
                    clientController.onGameStateUpdate((state: GameState) => {
                        dispatch(setGameState(state));
                    });

                    clientController.onSystemMessage((message: string) => {
                        dispatch(setSystemMessage(message));
                        setTimeout(() => dispatch(setSystemMessage(null)), 5000);
                    });

                    clientController.onConnectionStatus((status: string) => {
                        dispatch(setConnectionStatus(status as any));
                    });

                    // Connect to host
                    await clientController.connect(game.host_id);

                    setController(clientController);
                    controllerRef.current = clientController;
                }

                setLoading(false);
            } catch (err) {
                console.error('Error initializing game:', err);
                dispatch(setError('Failed to initialize game'));
                setLoading(false);
            }
        };

        initializeGame();

        // Cleanup on unmount
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            if (controllerRef.current) {
                controllerRef.current.cleanup();
            }
            dispatch(resetGame());
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameId, user?.id, navigate]); // Removed dispatch - it's stable in Redux Toolkit

    // Handle join table
    const handleJoinTable = async () => {
        if (!controller || !user || hasJoined) return;

        if (controller instanceof GameClientController) {
            await controller.joinTable(
                user.user_metadata?.username || user.email || 'Player',
                selectedSeat,
                gameInfo?.buy_in || 5000
            );
            setHasJoined(true);
        }
    };

    // Action handlers
    const handleFold = () => {
        if (!user?.id) return;
        if (controller instanceof GameClientController) {
            controller.fold();
        } else if (controller instanceof GameHostController) {
            controller.fold(user.id);
        }
    };

    const handleCheck = () => {
        if (!user?.id) return;
        if (controller instanceof GameClientController) {
            controller.check();
        } else if (controller instanceof GameHostController) {
            controller.check(user.id);
        }
    };

    const handleCall = () => {
        if (!user?.id) return;
        if (controller instanceof GameClientController) {
            controller.call();
        } else if (controller instanceof GameHostController) {
            controller.call(user.id);
        }
    };

    const handleRaise = (amount: number) => {
        if (!user?.id) return;
        if (controller instanceof GameClientController) {
            controller.raise(amount);
        } else if (controller instanceof GameHostController) {
            controller.raise(user.id, amount);
        }
    };

    const handleAllIn = () => {
        if (!user?.id) return;
        if (controller instanceof GameClientController) {
            controller.allIn();
        } else if (controller instanceof GameHostController) {
            controller.allIn(user.id);
        }
    };

    // Create array of all 9 seats
    const seats: (Player | null)[] = Array(9).fill(null);
    if (gameState.players) {
        gameState.players.forEach(player => {
            seats[player.seatPosition] = player;
        });
    }

    const currentPlayer = gameState.players?.find(p => p.id === user?.id);
    const isPlayerTurn = gameState.players?.[gameState.currentPlayerIndex]?.id === user?.id;
    const canCheck = currentPlayer?.currentBet === gameState.currentBet;
    const minRaise = gameState.bigBlind * 2;

    // Show loading state
    if (loading) {
        return (
            <div className="poker-table-container">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p>Loading game...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="poker-table-container">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <h2 style={{ color: 'var(--error)', marginBottom: '1rem' }}>Error</h2>
                    <p>{error}</p>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/lobby')}
                        style={{ marginTop: '1rem' }}
                    >
                        Return to Lobby
                    </button>
                </div>
            </div>
        );
    }

    // Show join screen for clients who haven't joined yet
    if (!gameState.isHost && !hasJoined) {
        return (
            <div className="poker-table-container">
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                    <h2 style={{ marginBottom: '2rem' }}>Join Table</h2>

                    <div style={{ marginBottom: '2rem' }}>
                        <p style={{ marginBottom: '1rem' }}>Connection Status: <strong>{connectionStatus}</strong></p>
                        <p>Buy-in: <strong>${gameInfo?.buy_in?.toLocaleString() || '5,000'}</strong></p>
                    </div>

                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem' }}>Select Seat:</label>
                        <select
                            value={selectedSeat}
                            onChange={(e) => setSelectedSeat(parseInt(e.target.value))}
                            style={{ padding: '0.5rem', fontSize: '1rem' }}
                        >
                            {Array.from({ length: 9 }).map((_, i) => (
                                <option key={i} value={i}>Seat {i + 1}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        className="btn btn-primary"
                        onClick={handleJoinTable}
                        disabled={connectionStatus !== 'connected'}
                        style={{ padding: '0.75rem 2rem', fontSize: '1.1rem' }}
                    >
                        {connectionStatus === 'connected' ? 'Join Game' : 'Connecting...'}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="poker-table-container">
            {/* Leave Table Button */}
            <button
                className="btn btn-secondary"
                onClick={() => {
                    if (controller) {
                        controller.cleanup();
                    }
                    navigate('/lobby');
                }}
                style={{
                    position: 'fixed',
                    top: '1rem',
                    left: '1rem',
                    zIndex: 200,
                    padding: '0.5rem 1rem',
                    fontSize: '0.875rem'
                }}
            >
                ← Leave Table
            </button>

            {/* Connection Status Indicator */}
            {connectionStatus !== 'connected' && !gameState.isHost && (
                <div style={{
                    position: 'fixed',
                    top: '1rem',
                    right: '1rem',
                    background: 'rgba(220, 38, 38, 0.9)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    zIndex: 200
                }}>
                    {connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                </div>
            )}

            {/* System Messages */}
            {systemMessage && (
                <div style={{
                    position: 'fixed',
                    top: '5rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(59, 130, 246, 0.95)',
                    color: 'white',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '8px',
                    fontWeight: 600,
                    zIndex: 200,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
                }}>
                    {systemMessage}
                </div>
            )}

            {/* Game Phase Indicator */}
            <div className="game-phase">
                {gameState.phase.toUpperCase()} - Hand #{gameState.handNumber}
                {gameState.isHost && <span style={{ marginLeft: '1rem', opacity: 0.7 }}>(Host)</span>}
            </div>

            {/* Main Poker Table */}
            <div className="poker-table">
                {/* Player Seats */}
                {seats.map((player, index) => (
                    <PlayerSeat
                        key={index}
                        player={player}
                        seatNumber={index}
                        isCurrentPlayer={player?.id === user?.id}
                        isActiveTurn={gameState.players[gameState.currentPlayerIndex]?.seatPosition === index}
                        showCards={gameState.phase === 'showdown'}
                    />
                ))}

                {/* Community Cards */}
                <CommunityCards
                    cards={gameState.communityCards || []}
                    phase={gameState.phase}
                />

                {/* Pot Display */}
                <PotDisplay
                    totalPot={gameState.pot}
                    sidePots={gameState.sidePots || []}
                />

                {/* Winner Announcement */}
                {gameState.phase === 'showdown' && gameState.lastWinner && (
                    <div className="winner-announcement">
                        <div className="winner-announcement-title">🏆 WINNER! 🏆</div>
                        <div className="winner-announcement-player">{gameState.lastWinner.playerName}</div>
                        <div className="winner-announcement-amount">
                            +${gameState.lastWinner.amountWon.toLocaleString()}
                        </div>
                        <div className="winner-announcement-hand">{gameState.lastWinner.handName}</div>
                    </div>
                )}
            </div>

            {/* Action Buttons (only show for current player when it's their turn) */}
            {currentPlayer && !currentPlayer.folded && (
                <ActionButtons
                    currentBet={gameState.currentBet}
                    playerChips={currentPlayer.chips}
                    playerCurrentBet={currentPlayer.currentBet}
                    minRaise={minRaise}
                    isPlayerTurn={isPlayerTurn}
                    canCheck={canCheck}
                    onFold={handleFold}
                    onCheck={handleCheck}
                    onCall={handleCall}
                    onRaise={handleRaise}
                    onAllIn={handleAllIn}
                />
            )}
        </div>
    );
}
