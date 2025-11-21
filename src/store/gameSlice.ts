import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GameState, Player } from '../game/PokerEngine';

interface ExtendedGameState extends GameState {
    isHost: boolean;
    hostId: string | null;
    connected: boolean;
    connectedPlayers: string[];
}

const initialState: ExtendedGameState = {
    id: '',
    players: [],
    communityCards: [],
    pot: 0,
    sidePots: [],
    currentBet: 0,
    dealerPosition: 0,
    currentPlayerIndex: 0,
    phase: 'waiting',
    smallBlind: 10,
    bigBlind: 20,
    handNumber: 0,
    isHost: false,
    hostId: null,
    connected: false,
    connectedPlayers: [],
};

const gameSlice = createSlice({
    name: 'game',
    initialState,
    reducers: {
        setGameState: (state, action: PayloadAction<GameState>) => {
            return { ...state, ...action.payload };
        },
        updateGameState: (state, action: PayloadAction<Partial<GameState>>) => {
            return { ...state, ...action.payload };
        },
        setIsHost: (state, action: PayloadAction<boolean>) => {
            state.isHost = action.payload;
        },
        setHostId: (state, action: PayloadAction<string>) => {
            state.hostId = action.payload;
        },
        setConnected: (state, action: PayloadAction<boolean>) => {
            state.connected = action.payload;
        },
        addConnectedPlayer: (state, action: PayloadAction<string>) => {
            if (!state.connectedPlayers.includes(action.payload)) {
                state.connectedPlayers.push(action.payload);
            }
        },
        removeConnectedPlayer: (state, action: PayloadAction<string>) => {
            state.connectedPlayers = state.connectedPlayers.filter(
                (id) => id !== action.payload
            );
        },
        addPlayer: (state, action: PayloadAction<Player>) => {
            const exists = state.players.find((p) => p.id === action.payload.id);
            if (!exists) {
                state.players.push(action.payload);
                state.players.sort((a, b) => a.seatPosition - b.seatPosition);
            }
        },
        removePlayer: (state, action: PayloadAction<string>) => {
            state.players = state.players.filter((p) => p.id !== action.payload);
        },
        updatePlayer: (
            state,
            action: PayloadAction<{ id: string; updates: Partial<Player> }>
        ) => {
            const player = state.players.find((p) => p.id === action.payload.id);
            if (player) {
                Object.assign(player, action.payload.updates);
            }
        },
        resetGame: () => initialState,
    },
});

export const {
    setGameState,
    updateGameState,
    setIsHost,
    setHostId,
    setConnected,
    addConnectedPlayer,
    removeConnectedPlayer,
    addPlayer,
    removePlayer,
    updatePlayer,
    resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
