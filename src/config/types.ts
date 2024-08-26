export enum CurrencyType {
    UNBELIEVABOAT = 'UNBELIEVABOAT',
    CUSTOM = 'CUSTOM'
}

export enum Rarity {
    GOD = 'GOD',
    SSS = 'SSS',
    SS = 'SS',
    S = 'S',
    A = 'A',
    B = 'B',
    C = 'C',
    D = 'D'
}

export enum Series {
    SERIES_1 = 'Series 1',
    SERIES_2 = 'Series 2',
    SERIES_3 = 'Series 3',
    SERIES_4 = 'Series 4',
    CHRISTMAS_2023 = 'Christmas 2023',
    MASTER = 'Master',
    SUMMER_2024 = 'Summer 2024'
}

export interface RarityRange {
    start: number
    end: number
    rarity: string
};

interface RaritySettingBase {
    index: number
    rarity: Rarity
    iconImage: string | ((series: Series) => string)
    icon: string | ((series: Series) => string)
    color: string | ((series: Series) => string)
    burnValue: number
}

interface RaritySettingWithRate extends RaritySettingBase {
    rate: number
    maxPity?: never
}

interface RaritySettingWithPity extends RaritySettingBase {
    forceGiveThreshold?: number
    maxPity: number
    rate: number
}

export type RaritySettings = RaritySettingWithRate | RaritySettingWithPity;

export interface InstanceConfig {
    quizRatingEpochStart: number
    announcementChannel: string
    roleSettings: Record<Series, string>
    currencyType: CurrencyType
    raritySettings: Record<Rarity, RaritySettings>
    getIconForRarity: (rarity: Rarity, series: Series) => string
    getNextRarity: (rarity: Rarity) => Rarity | null
}

export interface AchievementConfig {
    name: string
    icon: string
    threshold: number
}
