import { useState } from 'react';

interface ActionButtonsProps {
    currentBet: number;
    playerChips: number;
    playerCurrentBet: number;
    minRaise: number;
    isPlayerTurn: boolean;
    canCheck: boolean;
    onFold: () => void;
    onCheck: () => void;
    onCall: () => void;
    onRaise: (amount: number) => void;
    onAllIn: () => void;
}

export default function ActionButtons({
    currentBet,
    playerChips,
    playerCurrentBet,
    minRaise,
    isPlayerTurn,
    canCheck,
    onFold,
    onCheck,
    onCall,
    onRaise,
    onAllIn
}: ActionButtonsProps) {
    const callAmount = currentBet - playerCurrentBet;
    const maxRaise = playerChips;
    const [raiseAmount, setRaiseAmount] = useState(minRaise);

    const handleRaiseSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRaiseAmount(parseInt(e.target.value));
    };

    const handleRaise = () => {
        onRaise(raiseAmount);
    };

    return (
        <div className="action-buttons">
            {/* Fold - always available */}
            <button
                className="action-button fold"
                onClick={onFold}
                disabled={!isPlayerTurn}
            >
                Fold
            </button>

            {/* Check - only when no bet to call */}
            {canCheck && (
                <button
                    className="action-button check"
                    onClick={onCheck}
                    disabled={!isPlayerTurn}
                >
                    Check
                </button>
            )}

            {/* Call - only when there's a bet to match */}
            {!canCheck && callAmount > 0 && callAmount < playerChips && (
                <button
                    className="action-button call"
                    onClick={onCall}
                    disabled={!isPlayerTurn}
                >
                    Call ${callAmount.toLocaleString()}
                </button>
            )}

            {/* Raise */}
            {playerChips > callAmount && (
                <div className="raise-controls">
                    <input
                        type="range"
                        className="raise-slider"
                        min={minRaise}
                        max={maxRaise}
                        value={raiseAmount}
                        onChange={handleRaiseSliderChange}
                        disabled={!isPlayerTurn}
                    />
                    <div className="raise-amount">
                        Raise to ${raiseAmount.toLocaleString()}
                    </div>
                    <button
                        className="action-button raise"
                        onClick={handleRaise}
                        disabled={!isPlayerTurn}
                    >
                        Raise
                    </button>
                </div>
            )}

            {/* All-in */}
            <button
                className="action-button all-in"
                onClick={onAllIn}
                disabled={!isPlayerTurn || playerChips === 0}
            >
                All-In ${playerChips.toLocaleString()}
            </button>
        </div>
    );
}
