declare module 'pokersolver' {
    export interface IHand {
        cards: string[];
        descr: string;
        name: string;
        rank: number;
        qualifiesHigh(): boolean;
        qualifiesLow(): boolean;
        toString(): string;
        compare(other: IHand): number;
    }

    export class Hand {
        static solve(cards: string[], game?: string, canDisqualify?: boolean): IHand;
        static winners(hands: IHand[]): IHand[];
    }

    export class Game {
        constructor(gameType: string);
        // Add other Game methods as needed
    }
}
