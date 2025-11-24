import type { Player } from '../../game/PokerEngine';

interface PlayerSeatProps {
    player: Player | null;
    seatNumber: number;
    isCurrentPlayer: boolean;
    isActiveTurn: boolean;
    showCards?: boolean;
}

export default function PlayerSeat({
    player,
    seatNumber,
    isCurrentPlayer,
    isActiveTurn,
    showCards = false
}: PlayerSeatProps) {
    if (!player) {
        return (
            <div className={`player-seat empty-seat seat-${seatNumber}`}>
                <div className="player-info">
                    <div className="player-avatar">
                        <span style={{ fontSize: '1.5rem', opacity: 0.5 }}>+</span>
                    </div>
                    <div className="player-details" style={{ opacity: 0 }}>
                        <div className="player-name">Empty</div>
                    </div>
                </div>
            </div>
        );
    }

    const renderCard = (rank: string, suit: string, index: number) => {
        const suitSymbols: Record<string, string> = { 'h': '♥', 'd': '♦', 'c': '♣', 's': '♠' };
        const suitClass = suit === 'h' || suit === 'd' ? 'card-hearts' : 'card-clubs';

        return (
            <div key={index} className={`playing-card ${suitClass}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.2rem', lineHeight: 1 }}>{rank}</div>
                    <div style={{ fontSize: '1rem', lineHeight: 1 }}>{suitSymbols[suit]}</div>
                </div>
            </div>
        );
    };

    const renderCardBack = (index: number) => {
        return <div key={index} className="playing-card card-back"></div>;
    };

    return (
        <div className={`player-seat seat-${seatNumber} ${isActiveTurn ? 'active-turn' : ''}`}>
            {/* Player Info Wrapper */}
            <div className="player-info">
                {/* Avatar */}
                <div className="player-avatar">
                    {player.avatarUrl ? (
                        <img src={player.avatarUrl} alt={player.username} />
                    ) : (
                        player.username.charAt(0).toUpperCase()
                    )}

                    {/* Dealer Button (attached to avatar) */}
                    {player.isDealer && <div className="dealer-button">D</div>}
                </div>

                {/* Name & Chips */}
                <div className="player-details">
                    <div className="player-name" title={player.username}>
                        {player.username} {isCurrentPlayer ? '(You)' : ''}
                    </div>
                    <div className="player-chips">
                        ${player.chips.toLocaleString()}
                    </div>
                </div>

                {/* Status Badges (Floating) */}
                {player.isSmallBlind && <span className="status-badge blind-badge">SB</span>}
                {player.isBigBlind && <span className="status-badge blind-badge">BB</span>}

                {player.folded && <span className="status-badge folded-badge">Folded</span>}
                {player.allIn && <span className="status-badge all-in-badge">All-In</span>}

                {!player.folded && !player.allIn && player.lastAction === 'check' && (
                    <span className="status-badge check-badge">Check</span>
                )}
                {!player.folded && !player.allIn && player.lastAction === 'call' && (
                    <span className="status-badge call-badge">Call</span>
                )}
                {!player.folded && !player.allIn && player.lastAction === 'raise' && (
                    <span className="status-badge raise-badge">Raise</span>
                )}
            </div>

            {/* Player Cards (Floating above) */}
            {player.cards && player.cards.length > 0 && (
                <div className="player-cards">
                    {player.cards.map((card, index) =>
                        (showCards || isCurrentPlayer)
                            ? renderCard(card.rank, card.suit, index)
                            : renderCardBack(index)
                    )}
                </div>
            )}

            {/* Current Bet (Floating) */}
            {player.currentBet > 0 && (
                <div className="player-bet">
                    ${player.currentBet.toLocaleString()}
                </div>
            )}
        </div>
    );
}
