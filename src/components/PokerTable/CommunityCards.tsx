import type { Card } from '../../game/PokerEngine';

interface CommunityCardsProps {
    cards: Card[];
    phase: string;
}

export default function CommunityCards({ cards, phase }: CommunityCardsProps) {
    // Map suits to symbols
    const suitSymbols: Record<string, string> = {
        'h': '♥',
        'd': '♦',
        'c': '♣',
        's': '♠'
    };

    const renderCard = (card: Card, index: number) => {
        const suitClass = card.suit === 'h' || card.suit === 'd' ? 'card-hearts' : 'card-clubs';

        return (
            <div key={index} className={`community-card ${suitClass}`}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
                    <div style={{ fontSize: '1.75rem', lineHeight: 1, fontWeight: 'bold' }}>{card.rank}</div>
                    <div style={{ fontSize: '1.5rem', lineHeight: 1 }}>{suitSymbols[card.suit]}</div>
                </div>
            </div>
        );
    };

    const renderPlaceholder = (index: number) => {
        return (
            <div key={`placeholder-${index}`} className="community-card placeholder">
                <div style={{ fontSize: '2rem', opacity: 0.3 }}>🂠</div>
            </div>
        );
    };

    // Determine how many cards should be visible based on phase
    const getVisibleCardCount = () => {
        switch (phase) {
            case 'flop':
                return 3;
            case 'turn':
                return 4;
            case 'river':
            case 'showdown':
                return 5;
            default:
                return 0;
        }
    };

    const visibleCount = getVisibleCardCount();
    const displayCards = cards.slice(0, visibleCount);

    return (
        <div className="community-cards">
            {/* Show actual cards */}
            {displayCards.map((card, index) => renderCard(card, index))}

            {/* Show placeholders for remaining cards */}
            {Array.from({ length: 5 - displayCards.length }).map((_, index) =>
                renderPlaceholder(displayCards.length + index)
            )}
        </div>
    );
}
