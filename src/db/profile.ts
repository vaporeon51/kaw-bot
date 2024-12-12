import escape from 'pg-escape';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import { CurrencyManager } from '../services/currency/Currency';
import { convertRowToCardData } from './cards';
import { Rarity } from '../config/types';
import { getInstanceConfig } from '../config/config';

export const updateProfileBioText = async (userId: string, bioText: string, options?: ExecuteSQLOptions) => {
    const sql = `UPDATE users SET bio = ${escape.literal(bioText)} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const updateProfileLookingFor = async (userId: string, cards: string, options?: ExecuteSQLOptions) => {
    const sql = `UPDATE users SET looking_for_cards = ${escape.literal(cards)} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const updateProfileFavoriteCard = async (userId: string, cardId: number, options?: ExecuteSQLOptions) => {
    const sql = `UPDATE users SET favorite_card_id = ${cardId} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const getProfileBioText = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT bio FROM users WHERE id = ${escape.literal(userId)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        throw new Error('Unable to find user!');
    }

    if (result.rows[0].bio === '' || result.rows[0].bio === null) {
        return 'User has not set a bio yet, use **/set_bio**!';
    }
    return result.rows[0].bio;
};

export const getTotalCardsByRarity = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT rarity_class, COUNT(*) FROM card_to_user 
    JOIN cards ON cards.id = card_to_user.card_id
    WHERE user_id = ${escape.literal(userId)} 
    GROUP BY rarity_class`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return {
            totalByRarity: {
                [Rarity.D]: 0,
                [Rarity.C]: 0,
                [Rarity.B]: 0,
                [Rarity.A]: 0,
                [Rarity.S]: 0,
                [Rarity.SS]: 0,
                [Rarity.SSS]: 0,
                [Rarity.GOD]: 0,
                [Rarity.QUEEN]: 0,
                [Rarity.LEMON]: 0,
                [Rarity.DEAD]: 0,
                [Rarity.DEPTH]: 0,
                [Rarity.CHARR]: 0
            },
            overallTotal: 0
        };
    }

    let overallTotal = 0;
    const totalByRarity: Record<Rarity, number> = {} as unknown as any;
    for (const row of result.rows) {
        totalByRarity[row.rarity_class as Rarity] = parseInt(row.count);
        overallTotal += parseInt(row.count);
    }
    const knownRarities = Object.keys(getInstanceConfig().raritySettings);
    for (const knownRarity of knownRarities) {
        if (totalByRarity[knownRarity as Rarity] === undefined) {
            totalByRarity[knownRarity as Rarity] = 0;
        }
    }
    return { totalByRarity, overallTotal };
};

export const doesUserOwnFavoriteCard = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT * FROM card_to_user 
    WHERE user_id = ${escape.literal(userId)} AND card_id = (SELECT favorite_card_id FROM users WHERE id = ${escape.literal(userId)})`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return {
            owned: false,
            soulbound: false
        };
    }

    const owned = result.rowCount !== null && result.rowCount >= 1;
    let hasNonSoulbound = false;
    let hasSoulbound = false;
    for (const row of result.rows) {
        if (row.soulbound) {
            hasSoulbound = true;
        } else if (!row.soulbound) {
            hasNonSoulbound = true;
        }
    }
    return {
        owned,
        soulbound: hasSoulbound && !hasNonSoulbound
    };
};

export const getLookingForCards = async (userId: string, options?: ExecuteSQLOptions): Promise<string[]> => {
    const sql = `SELECT looking_for_cards FROM users WHERE id = ${escape.literal(userId)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return [];
    }

    const cards = result.rows[0].looking_for_cards;
    if (cards === null || (cards as string).trim() === '') {
        return [];
    }
    return cards.split(',');
};

export const getFavoriteCardDetails = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT * FROM cards WHERE id = (SELECT favorite_card_id FROM users WHERE id = ${escape.literal(userId)})`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return null;
    }
    return convertRowToCardData(result.rows[0]);
};

export const getNumCompletedGroups = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT groups FROM completed_groups
    WHERE user_id = ${escape.literal(userId)}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return 0;
    }
    return Number(result.rows[0].groups.length);
};

export const getProfileInfo = async (userId: string, options?: ExecuteSQLOptions) => {
    const [
        totalsByRarity,
        bio,
        balance,
        favoriteCard,
        favoriteCardOwnership,
        lookingForCards,
        numCompletedGroups
    ] = await Promise.all([
        getTotalCardsByRarity(userId, options),
        getProfileBioText(userId, options),
        CurrencyManager.getInstance().balance(userId),
        getFavoriteCardDetails(userId, options),
        doesUserOwnFavoriteCard(userId, options),
        getLookingForCards(userId, options),
        getNumCompletedGroups(userId, options)
    ]);

    return {
        balance,
        bio,
        totalsByRarity,
        favoriteCard,
        favoriteCardOwnership,
        lookingForCards,
        numCompletedGroups
    };
};
