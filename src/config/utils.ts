import { type Series, type Rarity, type RarityRange, type RaritySettings } from './types';

export const createGetNextRarityFn = (raritySettings: Record<Rarity, RaritySettings>) => {
    const getNextRarity = (rarity: Rarity) => {
        const thisIndex = raritySettings[rarity].index;
        const nextRarity = Object.values(raritySettings).find((settings) => settings.index === thisIndex - 1);
        if (nextRarity === undefined) {
            return null;
        }
        return nextRarity.rarity;
    };
    return getNextRarity;
};

export const createGetIconFn = (raritySettings: Record<Rarity, RaritySettings>) => {
    const getIconForRarity = (rarity: Rarity, series: Series): string => {
        const iconValue = raritySettings[rarity].icon;
        if (typeof iconValue === 'function') {
            return iconValue(series);
        }
        return iconValue;
    };
    return getIconForRarity;
};

export const buildRarityMap = (raritySettings: Record<Rarity, number>): RarityRange[] => {
    let currentValue = 1;
    let endValue = 0;
    const ranges: RarityRange[] = [];
    for (const [rarityName, rate] of Object.entries(raritySettings)) {
        if (rate === 0) {
            continue;
        }

        endValue = currentValue + (rate - 1);

        ranges.push({
            rarity: rarityName,
            start: currentValue,
            end: endValue
        });
        currentValue += rate;
    }

    if (endValue !== 1000) {
        console.error('Expected end value to be 1000, but was: ' + endValue + '');
    }

    return ranges;
};
