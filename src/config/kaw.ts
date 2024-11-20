import Configuration from '../services/Configuration';
import { CurrencyType, type RaritySettings, type InstanceConfig, Rarity, Series } from './types';
import { createGetIconFn, createGetNextRarityFn } from './utils';

const roleSettingsDev: Record<Series, string> = {
    [Series.SERIES_1]: '11291966055752667159',
    [Series.SERIES_2]: '1291966055752667158',
    [Series.SERIES_3]: '1291966055752667157',
    [Series.SERIES_4]: '',
    [Series.MASTER]: '',
    [Series.CHRISTMAS_2023]: '',
    [Series.SUMMER_2024]: '',
    [Series.HALLOWEEN_2024]: '',
    [Series.ADMIN]: ''
};

const roleSettingsProd: Record<Series, string> = {
    [Series.SERIES_1]: '1291712519911510016',
    [Series.SERIES_2]: '1291712528510095390',
    [Series.SERIES_3]: '1291712532385501224',
    [Series.SERIES_4]: '1291712535610785843',
    [Series.MASTER]: '',
    [Series.CHRISTMAS_2023]: '',
    [Series.SUMMER_2024]: '',
    [Series.HALLOWEEN_2024]: '',
    [Series.ADMIN]: ''
};

const quizRatingEpochStartDev = 1706313600000;
const quizRatingEpochStartProd = 1706457600000;

const BOT_ANNOUCEMENT_CHANNEL_DEV = '1291966056340000802';
const BOT_ANNOUCEMENT_CHANNEL_PROD = '1291612688966881321';

const raritySettings: Record<Rarity, RaritySettings> = {
    [Rarity.CHARR]: {
        index: -10,
        rarity: Rarity.CHARR,
        iconImage: 'https://i.imgur.com/Ct3a526.png',
        icon: '<:z12CHARR:1302571841843626025>',
        rate: 0,
        color: '#000000',
        burnValue: 69_000
    },
    [Rarity.DEAD]: {
        index: -10,
        rarity: Rarity.DEAD,
        iconImage: 'https://i.imgur.com/ALq3fKO.png',
        icon: '<:z12DEAD:1302571837145874473>',
        rate: 0,
        color: '#000000',
        burnValue: 69_000
    },
    [Rarity.DEPTH]: {
        index: -10,
        rarity: Rarity.DEPTH,
        iconImage: 'https://i.imgur.com/9ttK4ln.png',
        icon: '<:z12DEPTH:1302571832125423678>',
        rate: 0,
        color: '#000000',
        burnValue: 69_000
    },
    [Rarity.GOD]: {
        index: 0,
        iconImage: 'https://i.imgur.com/PsgbH27.png',
        icon: '<:z08GOD:1291975773804171284>',
        rarity: Rarity.GOD,
        rate: 1,
        color: '#d04427',
        burnValue: 450_000
    },
    [Rarity.SSS]: {
        index: 1,
        rarity: Rarity.SSS,
        iconImage(series) {
            if (series === Series.CHRISTMAS_2023) {
                return 'https://i.imgur.com/T33wRt9.png';
            }
            if (series === Series.SUMMER_2024) {
                return 'https://i.imgur.com/v39z5O4.png';
            }
            if (series === Series.HALLOWEEN_2024) {
                return 'https://i.imgur.com/h0tGXu8.png';
            }
            if (series === Series.MASTER) {
                return 'https://i.imgur.com/fQdjrqx.png';
            }
            return 'https://i.imgur.com/sgwb1vl.png';
        },
        icon(series) {
            if (series === Series.CHRISTMAS_2023) {
                return '<:z11Christmas:1291975778249998376>';
            }
            if (series === Series.SUMMER_2024) {
                return '<:z11Summer:1291975780406005760>'
            }
            if (series === Series.HALLOWEEN_2024) {
                return '<:z10Halloween:1291975782947622963>'
            }
            if (series === Series.MASTER) {
                return '<:z07SSSMaster:1291975775884414976>';
            }
            return '<:z06SSS:1291975750089445487>';
        },
        color(series) {
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
        icon: '<:z05SS:1291975771237257300>',
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
        icon: '<:z04S:1291975768896831508>',
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
        icon: '<:z03A:1291975765977731132>',
        rarity: Rarity.A,
        color: '#8e7cc3',
        burnValue: 5_500,
        rate: 80,
        maxPity: 350
    },
    [Rarity.B]: {
        index: 5,
        iconImage: 'https://i.imgur.com/WaRYp3V.png',
        icon: '<:z02B:1291975763221811290>',
        rarity: Rarity.B,
        color: '#a4c2f4',
        burnValue: 1800,
        rate: 0
    },
    [Rarity.C]: {
        index: 6,
        iconImage: 'https://i.imgur.com/EGdDJ2J.png',
        icon: '<:z01C:1291975760164421672>',
        rarity: Rarity.C,
        color: '#b6d7a8',
        burnValue: 600,
        rate: 0
    },
    [Rarity.D]: {
        index: 7,
        iconImage: 'https://i.imgur.com/lbKOTvJ.png',
        icon: '<:z00D:1291975757459099648>',
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
