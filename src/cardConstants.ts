import { getInstanceConfig } from './config/config';
import { Rarity, Series } from './config/types';
import { type CardData } from './db/cards';
import { type InventoryResult } from './db/users';
import { IS_SERIES_TWO_ENABLED } from './services/FeatureFlags';
import GenerateDrop from './services/GenerateDrop';

export const JJ_DISCORD_ID = '1185373336948199576';
export const ONE_MINUTE_MS = 60000;
export const ONE_HOUR_MS = ONE_MINUTE_MS * 60;

export interface PackDetails {
    id: string
    name: string
    description: string
    value: number
    soulboundOutput: boolean
    series: Series
    generatorFn: () => Promise<CardData>
    enabled: boolean
};

export const SPECIAL_DROP_PACK_RARITY_RATES = {
    [Rarity.GOD]: 0,
    [Rarity.SSS]: 3,
    [Rarity.SS]: 20,
    [Rarity.S]: 40,
    [Rarity.A]: 105,
    [Rarity.B]: 202,
    [Rarity.C]: 300,
    [Rarity.D]: 330
};

export const COMMON_PACK_RARITY_RATES = {
    [Rarity.GOD]: 1,
    [Rarity.SSS]: 9,
    [Rarity.SS]: 30,
    [Rarity.S]: 60,
    [Rarity.A]: 100,
    [Rarity.B]: 200,
    [Rarity.C]: 250,
    [Rarity.D]: 350
};

export const packsForPurchase: PackDetails[] = [
    {
        id: 'SERIES_ONE_PACK',
        name: 'Series 1 Pack',
        description: 'Will award one card from Series 1',
        soulboundOutput: false,
        series: Series.SERIES_1,
        value: 3500,
        async generatorFn () {
            return await GenerateDrop.getInstance().getCardToDrop({
                series: Series.SERIES_1,
                rarityRates: COMMON_PACK_RARITY_RATES,
                onlyDroppableCards: true
            });
        },
        enabled: true
    },
    {
        id: 'SERIES_TWO_PACK',
        name: 'Series 2 Pack',
        description: 'Will award one card from Series 2',
        soulboundOutput: false,
        series: Series.SERIES_2,
        value: 3500,
        async generatorFn () {
            return await GenerateDrop.getInstance().getCardToDrop({
                series: Series.SERIES_2,
                rarityRates: COMMON_PACK_RARITY_RATES,
                onlyDroppableCards: true
            });
        },
        enabled: IS_SERIES_TWO_ENABLED
    }
    // TODO: uncomment once release
    // {
    //     id: 'SERIES_THREE_PACK',
    //     name: 'Series 3 Pack',
    //     description: 'Will award one card from Series 3',
    //     soulboundOutput: false,
    //     series: Series.SERIES_3,
    //     value: 15000,
    //     async generatorFn () {
    //         return await GenerateDrop.getInstance().getCardToDrop({
    //             series: Series.SERIES_3,
    //             rarityRates: COMMON_PACK_RARITY_RATES,
    //             onlyDroppableCards: true
    //         });
    //     },
    //     enabled: true
    // }
];

export const seriesAliases: Record<Series, string[]> = {
    [Series.MASTER]: ['Master'],
    [Series.CHRISTMAS_2023]: ['XMAS2023'],
    [Series.SERIES_1]: ['S1'],
    [Series.SERIES_2]: ['S2'],
    [Series.SERIES_3]: ['S3']
};

export const getPrimaryAliasForSeries = (series: Series) => {
    return seriesAliases[series][0];
};

export const getListOfValidSeriesOptions = () => {
    const allOptions = [];
    for (const original of Object.keys(seriesAliases)) {
        const aliases = seriesAliases[original as Series];
        allOptions.push(`${original} (${aliases.join(', ')})`);
    }
    return allOptions.join(', ');
};

export const getValueOfCardInventoryResult = (card: InventoryResult) => {
    return getValueOfCardBase(card.series, card.rarityClass, card.soulbound);
};

export const getValueOfCard = (card: CardData, soulbound: boolean) => {
    return getValueOfCardBase(card.series, card.rarityClass, soulbound);
};

const getValueOfCardBase = (series: Series, rarity: Rarity, soulbound: boolean) => {
    const raritySettings = getInstanceConfig().raritySettings;
    const burnValue = soulbound ? 0 : raritySettings[rarity].burnValue;

    if (soulbound && series === Series.CHRISTMAS_2023) {
        const packValue = packsForPurchase.find((pack) => pack.series === Series.CHRISTMAS_2023)?.value ?? 0;
        return packValue;
    }
    return burnValue;
};

/**
 * Converts to the original series or returns back the alias if not possible
 */
export const convertSeriesAliasToStandard = (seriesAlias: string | null) => {
    if (seriesAlias === null) {
        return null;
    }

    for (const original of Object.keys(seriesAliases)) {
        const aliases = seriesAliases[original as Series];
        if (aliases.includes(seriesAlias)) {
            return original;
        }
    }
    return seriesAlias;
};

export enum Groups {
    G_IDLE = '(G)I-DLE',
    HL_KEY = 'H1-Key',
    SOLOIST = 'Soloist',
    ITZY = 'Itzy',
    LE_SSERAFIM = 'LE SSERAFIM',
    FROMIS_9 = 'fromis_9',
    VIVIZ = 'VIVIZ',
    BLACKPINK = 'Blackpink',
    AESPA = 'Aespa',
    IVE = 'IVE',
    STAY_C = 'StayC',
    TWICE = 'Twice',
    RED_VELVET = 'Red Velvet',
    NEW_JEANS = 'New Jeans',
    IZ_ONE = 'IZ*ONE',
    OH_MY_GIRL = 'OH MY GIRL',
    Kep1er = 'Kep1er',
    Everglow = 'EVERGLOW',
    Weeekly = 'Weeekly',
    NMIXX = 'NMIXX',
    Dreamcatcher = 'Dreamcatcher',
    MAMAMOO = 'MAMAMOO',
    WJSN = 'WJSN',
    LOONA = 'Loona',
    KISS_OF_LIFE = 'Kiss of Life',
    PURPLE_KISS = 'Purple Kiss',
    GIRLS_GENERATION = 'Girls\' Generation',
    LIGHTSUM = 'Lightsum',
    Blackswan = 'Blackswan',
    ROCKET_PUNCH = 'Rocket Punch',
    PIXY = 'Pixy',
}

export const TIMER_ICON = '<:timer:1189496798537064448>';
export const CHECKMARK_ICON = '<:checkmark:1189496760691859507>';
export const SOULBOUND_ICON = '<:sb:1189496824483020810>';
export const COIN_ICON = '<:coin:1189496543619842098>';
export const CELEBRATE_ICON = '<:Celebrate:1189496262542766120>';
