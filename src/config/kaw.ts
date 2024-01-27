import Configuration from '../services/Configuration';
import { CurrencyType, type RaritySettings, type InstanceConfig, Rarity, Series } from './types';
import { createGetIconFn, createGetNextRarityFn } from './utils';

const roleSettingsDev: Record<Series, string> = {
    [Series.SERIES_1]: '1194292045410467910',
    [Series.SERIES_2]: '1194292124984807554',
    [Series.MASTER]: '',
    [Series.CHRISTMAS_2023]: ''
};

const roleSettingsProd: Record<Series, string> = {
    [Series.SERIES_1]: '1178669236072230912',
    [Series.SERIES_2]: '1192089101625741494',
    [Series.MASTER]: '',
    [Series.CHRISTMAS_2023]: ''
};

// 1/27 and 1/28 start of day GMT
const quizRatingEpochStartDev = 1706313600000;
const quizRatingEpochStartProd = 1706400000000;

const BOT_ANNOUCEMENT_CHANNEL_DEV = '1194324127645970462';
const BOT_ANNOUCEMENT_CHANNEL_PROD = '1194318699159617596';

const raritySettings: Record<Rarity, RaritySettings> = {
    [Rarity.GOD]: {
        index: 0,
        iconImage: 'https://i.imgur.com/PsgbH27.png',
        icon: '<:GodRating:1185720175178289295>',
        rarity: Rarity.GOD,
        rate: 1,
        color: '#d04427',
        burnValue: 450_000
    },
    [Rarity.SSS]: {
        index: 1,
        rarity: Rarity.SSS,
        iconImage (series) {
            if (series === Series.CHRISTMAS_2023) {
                return 'https://i.imgur.com/T33wRt9.png';
            }
            if (series === Series.MASTER) {
                return 'https://i.imgur.com/fQdjrqx.png';
            }
            return 'https://i.imgur.com/sgwb1vl.png';
        },
        icon (series) {
            if (series === Series.CHRISTMAS_2023) {
                return '<:SSSChristmas:1178908018159652956>';
            }
            if (series === Series.MASTER) {
                return '<:SSSMaster:1192255718615687178>';
            }
            return '<:SSSrating:1177787651055689818>';
        },
        color (series) {
            if (series === Series.MASTER) {
                return '#b153b9';
            }
            return '#c1b30a';
        },
        burnValue: 150_000,
        forceGiveThreshold: 70,
        maxPity: 1000,
        rate: 0
    },
    [Rarity.SS]: {
        index: 2,
        iconImage: 'https://i.imgur.com/JAoMQNi.png',
        icon: '<:SSrating:1177788559290282076>',
        rarity: Rarity.SS,
        color: '#ffeb00',
        burnValue: 50_000,
        maxPity: 571,
        forceGiveThreshold: 40,
        rate: 30
    },
    [Rarity.S]: {
        index: 3,
        iconImage: 'https://i.imgur.com/ExolcGc.png',
        icon: '<:Srating:1177788268037799956>',
        rarity: Rarity.S,
        color: '#ff9900',
        burnValue: 16_500,
        maxPity: 222,
        forceGiveThreshold: 20,
        rate: 40
    },
    [Rarity.A]: {
        index: 4,
        iconImage: 'https://i.imgur.com/yiJAaFQ.png',
        icon: '<:Arating:1177788779298295880>',
        rarity: Rarity.A,
        color: '#8e7cc3',
        burnValue: 5_500,
        rate: 80,
        maxPity: 350
    },
    [Rarity.B]: {
        index: 5,
        iconImage: 'https://i.imgur.com/WaRYp3V.png',
        icon: '<:Brating:1177789430103277619>',
        rarity: Rarity.B,
        color: '#a4c2f4',
        burnValue: 1800,
        rate: 0
    },
    [Rarity.C]: {
        index: 6,
        iconImage: 'https://i.imgur.com/EGdDJ2J.png',
        icon: '<:Crating:1177789626795184178>',
        rarity: Rarity.C,
        color: '#b6d7a8',
        burnValue: 600,
        rate: 0
    },
    [Rarity.D]: {
        index: 7,
        iconImage: 'https://i.imgur.com/lbKOTvJ.png',
        icon: '<:Drating:1177790000788672572>',
        rarity: Rarity.D,
        rate: 0,
        color: '#efefef',
        burnValue: 150
    }
};

const isDEV = Configuration.getInstance().getConfig().isDev;
const kawConfig: InstanceConfig = {
    quizRatingEpochStart: isDEV ? quizRatingEpochStartDev : quizRatingEpochStartProd,
    announcementChannel: isDEV ? BOT_ANNOUCEMENT_CHANNEL_DEV : BOT_ANNOUCEMENT_CHANNEL_PROD,
    roleSettings: isDEV ? roleSettingsDev : roleSettingsProd,
    currencyType: CurrencyType.UNBELIEVABOAT,
    raritySettings,
    getIconForRarity: createGetIconFn(raritySettings),
    getNextRarity: createGetNextRarityFn(raritySettings)
};

export default kawConfig;
