-- Migration: Add Hand History Tracking
-- This migration adds tables to store detailed hand history for replay and analytics

-- ============================================================================
-- HAND HISTORY TABLE
-- ============================================================================
CREATE TABLE hand_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_id UUID REFERENCES games(id) ON DELETE CASCADE,
    hand_number INTEGER NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    
    -- Initial state
    small_blind INTEGER NOT NULL,
    big_blind INTEGER NOT NULL,
    dealer_position INTEGER NOT NULL,
    starting_pot INTEGER DEFAULT 0,
    
    -- Community cards (stored as JSONB arrays)
    flop_cards JSONB, -- [{rank: string, suit: string}, ...]
    turn_card JSONB,  -- {rank: string, suit: string}
    river_card JSONB, -- {rank: string, suit: string}
    
    -- Results
    winning_player_ids UUID[], -- Array of winner UUIDs (can be multiple for split pots)
    pot_total INTEGER,
    pot_distribution JSONB, -- [{player_id: UUID, amount: number}, ...]
    winning_hand_description TEXT, -- Human-readable description like "Flush, Ace high"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_hand_history_game ON hand_history(game_id);
CREATE INDEX idx_hand_history_started ON hand_history(started_at DESC);
CREATE INDEX idx_hand_history_winners ON hand_history USING GIN(winning_player_ids);

-- ============================================================================
-- HAND ACTIONS TABLE
-- ============================================================================
CREATE TABLE hand_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID REFERENCES hand_history(id) ON DELETE CASCADE,
    action_number INTEGER NOT NULL, -- Sequential number within the hand
    betting_round TEXT NOT NULL CHECK (betting_round IN ('preflop', 'flop', 'turn', 'river')),
    
    -- Action details
    player_id UUID REFERENCES profiles(id),
    seat_position INTEGER,
    action_type TEXT NOT NULL CHECK (action_type IN ('fold', 'check', 'call', 'raise', 'all_in', 'blind', 'post')),
    amount INTEGER DEFAULT 0, -- Amount bet/raised (0 for fold/check)
    
    -- Game state at time of action
    player_stack INTEGER, -- Player's chips before this action
    pot_before_action INTEGER,
    current_bet INTEGER, -- The bet to match
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for replay queries
CREATE INDEX idx_hand_actions_hand ON hand_actions(hand_id, action_number);
CREATE INDEX idx_hand_actions_player ON hand_actions(player_id);

-- ============================================================================
-- PLAYER HAND CARDS TABLE
-- ============================================================================
CREATE TABLE player_hand_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hand_id UUID REFERENCES hand_history(id) ON DELETE CASCADE,
    player_id UUID REFERENCES profiles(id),
    seat_position INTEGER NOT NULL,
    
    -- Cards and state
    hole_cards JSONB NOT NULL, -- [{rank: string, suit: string}, {rank: string, suit: string}]
    starting_chips INTEGER NOT NULL,
    ending_chips INTEGER NOT NULL,
    final_hand_rank TEXT, -- e.g., "Two Pair", "Flush", etc.
    final_hand_value JSONB, -- Best 5-card hand if went to showdown
    
    -- Flags
    folded BOOLEAN DEFAULT FALSE,
    went_all_in BOOLEAN DEFAULT FALSE,
    won BOOLEAN DEFAULT FALSE,
    won_amount INTEGER DEFAULT 0 -- Amount won from this hand
);

CREATE INDEX idx_player_hand_cards_hand ON player_hand_cards(hand_id);
CREATE INDEX idx_player_hand_cards_player ON player_hand_cards(player_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Hand history is viewable by all players in that game
ALTER TABLE hand_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hand history viewable by participants"
    ON hand_history FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM game_participants
            WHERE game_participants.game_id = hand_history.game_id
            AND game_participants.user_id = auth.uid()
        )
    );

-- Only host can insert hand history (done by host controller)
CREATE POLICY "Host can insert hand history"
    ON hand_history FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM games
            WHERE games.id = hand_history.game_id
            AND games.host_id = auth.uid()
        )
    );

-- Hand actions viewable by participants
ALTER TABLE hand_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hand actions viewable by participants"
    ON hand_actions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hand_history
            JOIN game_participants ON game_participants.game_id = hand_history.game_id
            WHERE hand_history.id = hand_actions.hand_id
            AND game_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Host can insert hand actions"
    ON hand_actions FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hand_history
            JOIN games ON games.id = hand_history.game_id
            WHERE hand_history.id = hand_actions.hand_id
            AND games.host_id = auth.uid()
        )
    );

-- Player hand cards viewable by participants
ALTER TABLE player_hand_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Player hand cards viewable by participants"
    ON player_hand_cards FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM hand_history
            JOIN game_participants ON game_participants.game_id = hand_history.game_id
            WHERE hand_history.id = player_hand_cards.hand_id
            AND game_participants.user_id = auth.uid()
        )
    );

CREATE POLICY "Host can insert player hand cards"
    ON player_hand_cards FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM hand_history
            JOIN games ON games.id = hand_history.game_id
            WHERE hand_history.id = player_hand_cards.hand_id
            AND games.host_id = auth.uid()
        )
    );

-- ============================================================================
-- HELPER FUNCTION - Update player stats after hand
-- ============================================================================
CREATE OR REPLACE FUNCTION update_player_stats_from_hand(
    p_player_id UUID,
    p_won BOOLEAN,
    p_amount_won INTEGER,
    p_pot_size INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Insert or update player stats
    INSERT INTO player_stats (user_id, total_hands_played, hands_won, total_chips_won, biggest_pot)
    VALUES (
        p_player_id,
        1,
        CASE WHEN p_won THEN 1 ELSE 0 END,
        CASE WHEN p_won THEN p_amount_won ELSE 0 END,
        CASE WHEN p_won AND p_pot_size > 0 THEN p_pot_size ELSE 0 END
    )
    ON CONFLICT (user_id) DO UPDATE SET
        total_hands_played = player_stats.total_hands_played + 1,
        hands_won = player_stats.hands_won + CASE WHEN p_won THEN 1 ELSE 0 END,
        total_chips_won = player_stats.total_chips_won + CASE WHEN p_won THEN p_amount_won ELSE 0 END,
        biggest_pot = GREATEST(player_stats.biggest_pot, CASE WHEN p_won THEN p_pot_size ELSE 0 END),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
