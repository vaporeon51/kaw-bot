export interface ParsedCardId {
    id: number
    soulbound: boolean
};
export const parseStringToCardsIds = (cardsList: string): ParsedCardId[] | null => {
    if (cardsList.length === 0) {
        return [];
    }

    try {
        const cards = [];
        const splitItems = cardsList.split(',');
        for (const item of splitItems) {
            const isSoulbound = item.endsWith('SB');
            const asNum = parseInt(item.replace('SB', ''), 10);
            if (isNaN(asNum)) {
                return null;
            }
            cards.push({
                id: asNum,
                soulbound: isSoulbound
            });
        }
        return cards;
    } catch (e) {
        return null;
    }
};
