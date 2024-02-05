import { getInstanceConfig } from '../config/config';
import { Rarity, Series, type RarityRange } from '../config/types';
import { buildRarityMap } from '../config/utils';
import { type CardData } from '../db/cards';
import { getNumberOfDropsSinceRarity } from '../db/dropLogging';
import CardCache from './CardCache';

import prand from 'pure-rand';

interface GenerateCardOptionsBase {
    excludedIds?: number[]
    series?: Series
    /**
     * Gives you cards that are set to droppable or not dependent on value
     * @default true
     */
    onlyDroppableCards?: boolean
    rarityInput?: Rarity
}

type GenerateCardOptionsWithDirectRarity = GenerateCardOptionsBase & {
    rarityInput: Rarity
    pityInformation?: { userId: string }
    rarityRates?: Record<Rarity, number>
};

type GenerateCardOptionsWithPity = GenerateCardOptionsBase & {
    rarityInput?: Rarity
    /**
     * Should only be provided in cases where pity should be used
     */
    pityInformation: { userId: string }
    rarityRates?: Record<Rarity, number>
};

type GenerateCardOptionsWithRarity = GenerateCardOptionsBase & {
    rarityInput?: Rarity
    /**
     * Should be used for cases such as packs where pity is not used
     */
    rarityRates: Record<Rarity, number>
    pityInformation?: { userId: string }
};

type GenerateCardOptions = GenerateCardOptionsWithDirectRarity | GenerateCardOptionsWithPity | GenerateCardOptionsWithRarity;

export default class GenerateDrop {
    private static instance: GenerateDrop;
    private randGenerator = prand.mersenne(Date.now() ^ (Math.random() * 0x100000000));
    private readonly raritySettings = getInstanceConfig().raritySettings;
    private readonly cardCache = CardCache.getInstance();

    private constructor () {
    }

    public generateNumberInRange (min: number, max: number) {
        const result = prand.uniformIntDistribution(min, max, this.randGenerator);
        this.randGenerator = result[1];
        return result[0];
    };

    public async getRarityMapUsingPity (pityInfo: { userId: string } | undefined, useForceGive = false) {
        if (pityInfo === undefined) {
            return null;
        }

        const pityProgress: Record<Rarity, number | undefined> = {} as unknown as any;
        // Rarity map based on pity
        const raritySettings: Record<Rarity, number> = {} as unknown as any;
        const timeSinceLastDrops = await getNumberOfDropsSinceRarity(pityInfo.userId);

        let totalRate = 0;
        for (const rarity of Object.keys(this.raritySettings)) {
            if (totalRate >= 1000) {
                continue;
            }

            const settingsForRarity = this.raritySettings[rarity as Rarity];
            if ('rate' in settingsForRarity && settingsForRarity.rate !== undefined) {
                pityProgress[rarity as Rarity] = undefined;
                raritySettings[rarity as Rarity] = settingsForRarity.rate;
                totalRate += settingsForRarity.rate;
            }

            const timeSinceLastDrop = timeSinceLastDrops.find((timeSince) => timeSince.rarity === rarity);
            if (!timeSinceLastDrop) {
                console.warn(`Could not find time since last drop for rarity: ${rarity}, user: ${pityInfo.userId} this should not happen!`);
                continue;
            }
            const hasReachedForceThreshold = ('forceGiveThreshold' in settingsForRarity) ? timeSinceLastDrop.dropsSince >= (settingsForRarity?.forceGiveThreshold ?? 0) : false;

            if (hasReachedForceThreshold && useForceGive) {
                console.log(`Using force give for user: ${pityInfo.userId} ${rarity}`);
                const percentage = Math.min(1000, 1000 - totalRate);
                pityProgress[rarity as Rarity] = percentage;
                raritySettings[rarity as Rarity] += percentage;
                totalRate += percentage;
            } else if ('maxPity' in settingsForRarity && settingsForRarity.maxPity) {
                const percentage = Math.ceil(timeSinceLastDrop.dropsSince / settingsForRarity.maxPity * 1000);
                const maxedPercentage = Math.min(percentage, 1000 - totalRate);
                pityProgress[rarity as Rarity] = maxedPercentage;
                raritySettings[rarity as Rarity] = maxedPercentage + (raritySettings[rarity as Rarity] ?? 0);
                totalRate += maxedPercentage;
            }
        }

        // Just change the lowest rarity to make up for the difference
        const difference = totalRate > 1000 ? totalRate - 1000 : 1000 - totalRate;

        if (totalRate < 1000) {
            // Split 40% of the difference to lowest rarity
            const dDifference = Math.floor(difference * 0.40);
            raritySettings[Rarity.D] = dDifference;

            // Split 35% of the difference to second lowest rarity
            const cDifference = Math.floor(difference * 0.35);
            raritySettings[Rarity.C] = cDifference + raritySettings[Rarity.C];

            // Split 15% of the difference to third lowest rarity
            const bDifference = Math.floor(difference * 0.20);
            raritySettings[Rarity.B] = bDifference + raritySettings[Rarity.B];

            // Check if there is a left over after the difference distribution
            const leftover = difference - (dDifference + cDifference + bDifference);
            raritySettings[Rarity.D] = leftover + raritySettings[Rarity.D];
        }

        // Set all non-set rarities to 0 if totalRate is 1000
        for (const rarity of Object.values(Rarity)) {
            if (!raritySettings[rarity as Rarity]) {
                raritySettings[rarity as Rarity] = 0;
            }
        }

        const pityBasedRarityMap = buildRarityMap(raritySettings);
        return { pityProgress, raritySettings, pityBasedRarityMap };
    }

    public async getDropRarity (rarityRates: Record<Rarity, number> | undefined, pityInfo: { userId: string } | undefined) {
        if (rarityRates === undefined && pityInfo === undefined) {
            throw new Error('Either pityRates or pityInfo must be provided');
        }

        const pityRarityMap = await this.getRarityMapUsingPity(pityInfo, true);

        let rarityMap: RarityRange[] = [];
        const totalRate = 1000;
        if (pityRarityMap !== null) {
            rarityMap = pityRarityMap.pityBasedRarityMap;
        } else {
            rarityMap = buildRarityMap(rarityRates as Record<Rarity, number>);
        }

        console.log(`Generating number in range: ${1} ${totalRate}`);
        const roll = this.generateNumberInRange(1, totalRate);
        for (const rarity of rarityMap) {
            if (roll >= rarity.start && roll <= rarity.end) {
                console.log(`Generated rarity: ${roll} ${rarity.rarity}`);
                return rarity.rarity;
            }
        }
        throw new Error(`Unexpected: could not determine rarity: ${roll}`);
    }

    private async generateCardIdWithCache (
        options: GenerateCardOptions | undefined
    ) {
        let rarity = options?.rarityInput ?? (await this.getDropRarity(options?.rarityRates, options?.pityInformation) as Rarity);

        // FIXME: Somehow be integrated with instance config?
        // Series 1 does not have any GOD cards
        if (options?.series === Series.SERIES_1 && rarity === Rarity.GOD) {
            rarity = Rarity.SSS;
        }

        const cardIds = await this.cardCache.getCardIdsForRarity(rarity, options?.onlyDroppableCards ?? true, options?.series);
        const excludeIds = new Set(options?.excludedIds ?? []);
        const filteredCardIds = cardIds.filter((id) => !excludeIds.has(id));
        if (filteredCardIds.length === 0) {
            throw new Error('No card was available to drop!');
        }

        const cardIndex = this.generateNumberInRange(0, filteredCardIds.length - 1);
        const cardId = filteredCardIds[cardIndex];
        return { rarity, cardId };
    };

    public getCardToDrop = async (options?: GenerateCardOptions) => {
        const generatedData = await this.generateCardIdWithCache(options);
        const selectedCard = await this.cardCache.getCardDetails(generatedData.cardId);
        console.log(`Generated card: ${selectedCard.id}, ${selectedCard.series} (${selectedCard.groupName} - ${selectedCard.memberName}) (${selectedCard.rarityClass})`);
        return selectedCard;
    };

    public generateMultipleCards = async (options: GenerateCardOptions & { numberOfCards: number }) => {
        const cards: CardData[] = [];
        const alreadySpawnedIds = new Set<number>();
        for (let i = 0; i < options.numberOfCards; i++) {
            const card = await this.getCardToDrop({ ...options, excludedIds: [...alreadySpawnedIds] });
            cards.push(card);
            alreadySpawnedIds.add(card.id);
        }
        return cards;
    };

    public static getInstance () {
        if (!GenerateDrop.instance) {
            GenerateDrop.instance = new GenerateDrop();
        }
        return GenerateDrop.instance;
    }
}
