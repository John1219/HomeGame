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
                    <div className="player-avatar">💺</div>
                    <div className="player-name">Empty Seat</div>
                </div>
            </div>
        );
    }

    const renderCard = (rank: string, suit: string, index: number) => {
        // Map suits to symbols
        const suitSymbols: Record<string, string> = {
            'h': '♥',
            'd': '♦',
            'c': '♣',
            's': '♠'
        };

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
            {player.currentBet > 0 && (
                <div className="player-bet">
                    💰 ${player.currentBet.toLocaleString()}
                </div>
            )}

            <div className="player-info" title={`${player.username}${isCurrentPlayer ? ' (You)' : ''}`}>
                <div className="player-avatar">
                    {player.username.charAt(0).toUpperCase()}
                </div>

                <div className="player-chips">
                    💰 ${player.chips.toLocaleString()}
                </div>

                {/* Status badges */}
                <div className="player-status">
                    {player.isDealer && (
                        <span className="status-badge dealer-button">D</span>
                    )}
                    {player.isSmallBlind && (
                        <span className="status-badge blind-badge">SB</span>
                    )}
                    {player.isBigBlind && (
                        <span className="status-badge blind-badge">BB</span>
                    )}
                    {player.folded && (
                        <span className="status-badge folded-badge">Folded</span>
                    )}
                    {player.allIn && (
                        <span className="status-badge all-in-badge">All-In</span>
                    )}
                </div>
            </div>

            {/* Player cards */}
            {player.cards && player.cards.length > 0 && (
                <div className="player-cards">
                    {player.cards.map((card, index) =>
                        (showCards || isCurrentPlayer)
                            ? renderCard(card.rank, card.suit, index)
                            : renderCardBack(index)
                    )}
                </div>
            )}
        </div>
    );
}
