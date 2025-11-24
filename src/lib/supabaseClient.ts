import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Please check your .env.local file.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'x-my-custom-header': 'homegame-poker',
    },
  },
});

// Log Supabase configuration for debugging
console.log('[Supabase] Configured with URL:', supabaseUrl?.substring(0, 30) + '...');

// Database types (will be auto-generated from Supabase later)
export interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  chips_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Game {
  id: string;
  game_name?: string;
  game_type: 'cash' | 'tournament';
  variant: string;
  small_blind: number;
  big_blind: number;
  buy_in: number;
  max_players: number;
  status: 'waiting' | 'active' | 'completed';
  host_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  tournament_blind_schedule?: BlindLevel[];
  prize_structure?: PrizeStructure[];
}

export type GameType = Game['game_type'];

export interface BlindLevel {
  level: number;
  small_blind: number;
  big_blind: number;
  duration_minutes: number;
}

export interface PrizeStructure {
  placement: number;
  percentage: number;
}

export interface PlayerStats {
  id: string;
  user_id: string;
  total_hands_played: number;
  hands_won: number;
  total_chips_won: number;
  total_chips_lost: number;
  biggest_pot: number;
  cash_games_played: number;
  cash_game_profit: number;
  tournaments_played: number;
  tournaments_won: number;
  tournament_top_3: number;
  best_hand: BestHand | null;
  updated_at: string;
}

export interface BestHand {
  rank: string;
  cards: string[];
  handName: string;
  achievedAt: string;
}

export interface GameParticipant {
  id: string;
  game_id: string;
  user_id: string;
  seat_position: number;
  starting_chips: number;
  ending_chips: number | null;
  placement: number | null;
  hands_won: number;
  biggest_pot: number;
  joined_at: string;
  left_at: string | null;
}

export interface Friend {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
}
