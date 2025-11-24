import { Hand } from 'pokersolver';

export interface Card {
    rank: string; // '2'-'9', 'T', 'J', 'Q', 'K', 'A'
    suit: string; // 'h', 'd', 'c', 's'
}

export interface Player {
    id: string;
    username: string;
    avatarUrl?: string;
    seatPosition: number;
    chips: number;
    cards: Card[];
    currentBet: number;
    folded: boolean;
    allIn: boolean;
    isDealer: boolean;
    isSmallBlind: boolean;
    isBigBlind: boolean;
    hasActed: boolean;
}

export interface GameState {
    id: string;
    players: Player[];
    communityCards: Card[];
    pot: number;
    sidePots: SidePot[];
    currentBet: number;
    dealerPosition: number;
    currentPlayerIndex: number;
    phase: 'waiting' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'ended';
    smallBlind: number;
    bigBlind: number;
    handNumber: number;
}

export interface SidePot {
    amount: number;
    eligiblePlayers: string[];
}

/**
 * Core Poker Engine - runs on the host's browser
 * Handles all game logic for Texas Hold'em
 */
export class PokerEngine {
    private deck: Card[] = [];
    private gameState: GameState;

    constructor(gameId: string, smallBlind: number, bigBlind: number) {
        this.gameState = {
            id: gameId,
            players: [],
            communityCards: [],
            pot: 0,
            sidePots: [],
            currentBet: 0,
            dealerPosition: 0,
            currentPlayerIndex: 0,
            phase: 'waiting',
            smallBlind,
            bigBlind,
            handNumber: 0,
        };
    }

    /**
     * Add a player to the game
     */
    addPlayer(id: string, username: string, seatPosition: number, chips: number): void {
        const player: Player = {
            id,
            username,
            seatPosition,
            chips,
            cards: [],
            currentBet: 0,
            folded: false,
            allIn: false,
            isDealer: false,
            isSmallBlind: false,
            isBigBlind: false,
            hasActed: false,
        };

        this.gameState.players.push(player);
        this.gameState.players.sort((a, b) => a.seatPosition - b.seatPosition);
    }

    /**
     * Remove a player from the game
     */
    removePlayer(playerId: string): void {
        this.gameState.players = this.gameState.players.filter(p => p.id !== playerId);
    }

    /**
     * Start a new hand
     */
    startNewHand(): void {
        this.gameState.handNumber++;
        this.gameState.phase = 'preflop';
        this.gameState.pot = 0;
        this.gameState.sidePots = [];
        this.gameState.currentBet = 0;
        this.gameState.communityCards = [];

        // Reset player states
        this.gameState.players.forEach(player => {
            player.cards = [];
            player.currentBet = 0;
            player.folded = false;
            player.allIn = false;
            player.hasActed = false;
            player.isDealer = false;
            player.isSmallBlind = false;
            player.isBigBlind = false;
        });

        // Rotate dealer
        this.rotateDealer();

        // Post blinds
        this.postBlinds();

        // Deal cards
        this.dealHoleCards();

        // Set first player to act (after big blind)
        this.setNextPlayer();
    }

    /**
     * Rotate dealer button
     */
    private rotateDealer(): void {
        const activePlayers = this.getActivePlayers();
        if (activePlayers.length < 2) return;

        this.gameState.dealerPosition = (this.gameState.dealerPosition + 1) % activePlayers.length;
        const dealer = activePlayers[this.gameState.dealerPosition];
        dealer.isDealer = true;

        // Mark blinds
        const sbIndex = (this.gameState.dealerPosition + 1) % activePlayers.length;
        const bbIndex = (this.gameState.dealerPosition + 2) % activePlayers.length;

        activePlayers[sbIndex].isSmallBlind = true;
        activePlayers[bbIndex].isBigBlind = true;
    }

    /**
     * Post small and big blinds
     */
    private postBlinds(): void {
        const activePlayers = this.getActivePlayers();

        const sbPlayer = activePlayers.find(p => p.isSmallBlind);
        const bbPlayer = activePlayers.find(p => p.isBigBlind);

        if (sbPlayer) {
            const sbAmount = Math.min(this.gameState.smallBlind, sbPlayer.chips);
            sbPlayer.chips -= sbAmount;
            sbPlayer.currentBet = sbAmount;
            this.gameState.pot += sbAmount;
            if (sbPlayer.chips === 0) sbPlayer.allIn = true;
        }

        if (bbPlayer) {
            const bbAmount = Math.min(this.gameState.bigBlind, bbPlayer.chips);
            bbPlayer.chips -= bbAmount;
            bbPlayer.currentBet = bbAmount;
            this.gameState.pot += bbAmount;
            this.gameState.currentBet = bbAmount;
            if (bbPlayer.chips === 0) bbPlayer.allIn = true;
        }
    }

    /**
     * Create and shuffle a new deck
     */
    private createDeck(): void {
        const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
        const suits = ['h', 'd', 'c', 's'];

        this.deck = [];
        for (const suit of suits) {
            for (const rank of ranks) {
                this.deck.push({ rank, suit });
            }
        }

        // Shuffle
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    /**
     * Deal hole cards to all players
     */
    private dealHoleCards(): void {
        this.createDeck();

        const activePlayers = this.getActivePlayers();

        // Deal 2 cards to each player
        for (let i = 0; i < 2; i++) {
            for (const player of activePlayers) {
                if (!player.folded) {
                    player.cards.push(this.deck.pop()!);
                }
            }
        }
    }

    /**
     * Deal community cards (flop, turn, or river)
     */
    dealCommunityCards(count: number): void {
        for (let i = 0; i < count; i++) {
            if (this.deck.length > 0) {
                this.gameState.communityCards.push(this.deck.pop()!);
            }
        }
    }

    /**
     * Player action: Fold
     */
    fold(playerId: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player || player.folded) return false;

        player.folded = true;
        player.hasActed = true;

        return true;
    }

    /**
     * Player action: Call
     */
    call(playerId: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player || player.folded) return false;

        const callAmount = this.gameState.currentBet - player.currentBet;
        const actualAmount = Math.min(callAmount, player.chips);

        player.chips -= actualAmount;
        player.currentBet += actualAmount;
        this.gameState.pot += actualAmount;
        player.hasActed = true;

        if (player.chips === 0) {
            player.allIn = true;
        }

        return true;
    }

    /**
     * Player action: Raise
     */
    raise(playerId: string, raiseAmount: number): boolean {
        const player = this.getPlayer(playerId);
        if (!player || player.folded) return false;

        const totalBet = this.gameState.currentBet + raiseAmount;
        const amountToAdd = totalBet - player.currentBet;
        const actualAmount = Math.min(amountToAdd, player.chips);

        player.chips -= actualAmount;
        player.currentBet += actualAmount;
        this.gameState.pot += actualAmount;
        this.gameState.currentBet = player.currentBet;
        player.hasActed = true;

        // Reset hasActed for other players
        this.gameState.players.forEach(p => {
            if (p.id !== playerId && !p.folded && !p.allIn) {
                p.hasActed = false;
            }
        });

        if (player.chips === 0) {
            player.allIn = true;
        }

        return true;
    }

    /**
     * Player action: Check
     */
    check(playerId: string): boolean {
        const player = this.getPlayer(playerId);
        if (!player || player.folded) return false;
        if (player.currentBet !== this.gameState.currentBet) return false;

        player.hasActed = true;
        return true;
    }

    /**
     * Check if betting round is complete
     */
    isBettingRoundComplete(): boolean {
        const activePlayers = this.getActivePlayers().filter(p => !p.folded);

        if (activePlayers.length <= 1) return true;

        const playersWhoCanAct = activePlayers.filter(p => !p.allIn);

        if (playersWhoCanAct.length === 0) return true;

        return playersWhoCanAct.every(p =>
            p.hasActed && p.currentBet === this.gameState.currentBet
        );
    }

    /**
     * Advance to next phase
     */
    advancePhase(): void {
        // Reset bets and hasActed
        this.gameState.players.forEach(player => {
            player.currentBet = 0;
            player.hasActed = false;
        });
        this.gameState.currentBet = 0;

        if (this.gameState.phase === 'preflop') {
            this.gameState.phase = 'flop';
            this.dealCommunityCards(3);
        } else if (this.gameState.phase === 'flop') {
            this.gameState.phase = 'turn';
            this.dealCommunityCards(1);
        } else if (this.gameState.phase === 'turn') {
            this.gameState.phase = 'river';
            this.dealCommunityCards(1);
        } else if (this.gameState.phase === 'river') {
            this.gameState.phase = 'showdown';
            this.determineWinner();
        }

        this.setNextPlayer();
    }

    /**
     * Determine winner(s) and distribute pot
     */
    determineWinner(): { winners: string[]; handName: string } {
        const activePlayers = this.getActivePlayers().filter(p => !p.folded);

        if (activePlayers.length === 1) {
            // Only one player left
            const winner = activePlayers[0];
            winner.chips += this.gameState.pot;
            return { winners: [winner.id], handName: 'Opponent folded' };
        }

        // Calculate side pots if needed
        const { sidePots, mainPot } = this.calculatePots();

        // Evaluate hands and distribute pots
        const winners: string[] = [];
        let winningHandName = '';

        // Award side pots
        for (const sidePot of sidePots) {
            const eligible = activePlayers.filter(p => sidePot.eligiblePlayers.includes(p.id));
            const { winners: potWinners, handName } = this.evaluateHands(eligible);

            const potShare = sidePot.amount / potWinners.length;
            potWinners.forEach(winner => {
                winner.chips += potShare;
                if (!winners.includes(winner.id)) {
                    winners.push(winner.id);
                    winningHandName = handName;
                }
            });
        }

        // Award main pot
        if (mainPot > 0) {
            const { winners: potWinners, handName } = this.evaluateHands(activePlayers);
            const potShare = mainPot / potWinners.length;
            potWinners.forEach(winner => {
                winner.chips += potShare;
                if (!winners.includes(winner.id)) {
                    winners.push(winner.id);
                    winningHandName = handName;
                }
            });
        }

        return { winners, handName: winningHandName };
    }

    /**
     * Calculate main pot and side pots
     */
    private calculatePots(): { sidePots: SidePot[]; mainPot: number } {
        const sidePots: SidePot[] = [];
        const activePlayers = this.getActivePlayers().filter(p => !p.folded);

        // Sort players by total bet
        const playerBets = activePlayers.map(p => ({
            id: p.id,
            bet: p.currentBet,
        })).sort((a, b) => a.bet - b.bet);

        let remainingPot = this.gameState.pot;
        let previousBet = 0;

        for (let i = 0; i < playerBets.length; i++) {
            const currentBet = playerBets[i].bet;
            const betDiff = currentBet - previousBet;

            if (betDiff > 0) {
                const eligiblePlayers = playerBets.slice(i).map(pb => pb.id);
                const potAmount = betDiff * eligiblePlayers.length;

                if (potAmount > 0) {
                    sidePots.push({
                        amount: potAmount,
                        eligiblePlayers,
                    });
                    remainingPot -= potAmount;
                }
            }

            previousBet = currentBet;
        }

        return { sidePots, mainPot: remainingPot };
    }

    /**
     * Evaluate hands using pokersolver library
     */
    private evaluateHands(players: Player[]): { winners: Player[]; handName: string } {
        const hands = players.map(player => {
            const cardStrings = [
                ...player.cards,
                ...this.gameState.communityCards
            ].map(card => `${card.rank}${card.suit}`);

            return {
                player,
                hand: Hand.solve(cardStrings),
            };
        });

        // Find winning hand(s)
        const winners = Hand.winners(hands.map(h => h.hand));
        const winningPlayers = hands
            .filter(h => winners.includes(h.hand))
            .map(h => h.player);

        return {
            winners: winningPlayers,
            handName: winners[0]?.descr || 'High Card',
        };
    }

    /**
     * Set next player to act
     */
    setNextPlayer(): void {
        const activePlayers = this.getActivePlayers().filter(p => !p.folded && !p.allIn);

        if (activePlayers.length === 0) {
            // Everyone is all-in or folded, go to showdown
            this.gameState.phase = 'showdown';
            this.determineWinner();
            return;
        }

        let searched = 0;
        let nextIndex = (this.gameState.currentPlayerIndex + 1) % this.gameState.players.length;

        while (searched < this.gameState.players.length) {
            const player = this.gameState.players[nextIndex];
            if (!player.folded && !player.allIn && player.chips > 0) {
                this.gameState.currentPlayerIndex = nextIndex;
                return;
            }
            nextIndex = (nextIndex + 1) % this.gameState.players.length;
            searched++;
        }
    }

    /**
     * Get active players (not eliminated)
     */
    private getActivePlayers(): Player[] {
        return this.gameState.players.filter(p => p.chips > 0 || p.currentBet > 0);
    }

    /**
     * Get player by ID
     */
    private getPlayer(playerId: string): Player | undefined {
        return this.gameState.players.find(p => p.id === playerId);
    }

    /**
     * Get current game state
     */
    getState(): GameState {
        // Return a deep copy to prevent external code from freezing our internal state
        return JSON.parse(JSON.stringify(this.gameState));
    }

    /**
     * Get current player to act
     */
    getCurrentPlayer(): Player | undefined {
        return this.gameState.players[this.gameState.currentPlayerIndex];
    }
}
