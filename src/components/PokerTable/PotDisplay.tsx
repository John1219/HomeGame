import type { SidePot } from '../../game/PokerEngine';

interface PotDisplayProps {
    totalPot: number;
    sidePots?: SidePot[];
}

export default function PotDisplay({ totalPot, sidePots = [] }: PotDisplayProps) {
    const hasSidePots = sidePots.length > 0;

    return (
        <div className="pot-display">
            <div className="pot-label">Total Pot</div>
            <div className="pot-amount">${totalPot.toLocaleString()}</div>

            {hasSidePots && (
                <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {sidePots.map((sidePot, index) => (
                        <div key={index}>
                            Side Pot {index + 1}: ${sidePot.amount.toLocaleString()}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
