import { useState, useEffect } from 'react';

interface ActionButtonsProps {
    currentBet: number;
    potSize: number;
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
    potSize,
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

    // Reset raise amount when turn changes or min raise changes
    useEffect(() => {
        setRaiseAmount(minRaise);
    }, [minRaise, isPlayerTurn]);

    const handleRaiseSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRaiseAmount(parseInt(e.target.value));
    };

    const handleRaise = () => {
        onRaise(raiseAmount);
    };

    const setRaiseTo = (amount: number) => {
        let newAmount = Math.max(minRaise, Math.min(amount, maxRaise));
        setRaiseAmount(Math.floor(newAmount));
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

            {/* Raise Controls */}
            {playerChips > callAmount && (
                <div className="raise-controls">
                    {/* Preset Buttons */}
                    <div style={{ display: 'flex', gap: '5px', marginBottom: '5px' }}>
                        <button
                            className="preset-button"
                            onClick={() => setRaiseTo(minRaise * 2.2)}
                            disabled={!isPlayerTurn}
                        >
                            2.2x
                        </button>
                        <button
                            className="preset-button"
                            onClick={() => setRaiseTo(potSize)}
                            disabled={!isPlayerTurn}
                        >
                            Pot
                        </button>
                        <button
                            className="preset-button"
                            onClick={() => setRaiseTo(maxRaise)}
                            disabled={!isPlayerTurn}
                        >
                            Max
                        </button>
                    </div>

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

            {/* All-in (Separate button, or just use Max preset) */}
            {/* Keeping separate All-in button for clarity if needed, but Max preset covers it for raise */}
            {/* If chips <= callAmount, they can only call all-in, handled by Call button logic usually or specific All-in call */}
        </div>
    );
}
