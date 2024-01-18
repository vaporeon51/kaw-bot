import { type Rarity, type Series } from '../config/types';
import { getCardDetails, type CardData, getCardsIds as getDroppableCardIds } from '../db/cards';

/**
 * Due to cards only changing from edit/upload or manual database changes
 * The server can actually just store all card data in a cache
 */
export default class CardCache {
    private static instance: CardCache;

    private cardDetailsCache: Record<number, CardData> = {};
    private cardIdsFromRarityCache: Record<string, number[]> = {} as any;

    public reset () {
        this.cardDetailsCache = {};
        this.cardIdsFromRarityCache = {} as any;
    }

    public async getCardIdsForRarity (rarity: Rarity, onlyDroppableCards: boolean, series?: Series): Promise<number[]> {
        const key = `${rarity}::${series}::${onlyDroppableCards}`;
        if (this.cardIdsFromRarityCache[key]) {
            return this.cardIdsFromRarityCache[key];
        }

        const cardIds = await getDroppableCardIds(rarity, onlyDroppableCards, series);
        if (cardIds === null) {
            throw new Error(`[CardCache] Failed to obtain cardIds for rarity ${rarity}`);
        }
        this.cardIdsFromRarityCache[key] = cardIds;
        return cardIds;
    }

    public async getCardDetails (id: number): Promise<CardData> {
        if (this.cardDetailsCache[id]) {
            return this.cardDetailsCache[id];
        }

        const cardDetails = await getCardDetails(id);
        if (cardDetails === null) {
            throw new Error(`[CardCache] Failed to obtain card details ${id}`);
        }
        this.cardDetailsCache[cardDetails.id] = cardDetails;
        return cardDetails;
    }

    public static getInstance (): CardCache {
        if (!CardCache.instance) {
            CardCache.instance = new CardCache();
        }
        return CardCache.instance;
    }
}
