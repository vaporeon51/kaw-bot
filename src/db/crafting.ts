import { type CraftTypes } from '../commands/craft';
import { Rarity, type Series } from '../config/types';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import { addCardToInventory, removeCardFromInventoryByMappingId } from './users';
import * as escape from 'pg-escape';

export interface CraftingRequest {
    id: number
    userId: string
    type: CraftTypes
    consumingCards: number[]
    toRarity: Rarity
    toSeries: Series
    soulboundOutput: boolean
};

const mapRowToCraftingRequest = (row: any) => {
    const data: CraftingRequest = {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        consumingCards: row.consuming_cards,
        toRarity: row.destination_rarity,
        toSeries: row.destination_series,
        soulboundOutput: row.soulbound_output
    };
    return data;
};

export const createCraftingRequest = async (
    userId: string,
    type: string,
    cards: number[],
    toRarity: Rarity,
    toSeries: Series,
    soulbound: boolean
) => {
    const sql = `INSERT INTO 
    craft_requests(user_id, type, consuming_cards, destination_rarity, destination_series, soulbound_output)
    VALUES (
        ${escape.literal(userId)}, 
        ${escape.literal(type)}, 
        ARRAY [${cards.toString()}]::integer[], 
        ${escape.literal(toRarity)}, 
        ${escape.literal(toSeries)}, 
        ${soulbound}
    )
    RETURNING id`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0].id;
};

export const doesSeriesHaveGodCard = async (series: Series): Promise<boolean> => {
    const sql = `SELECT EXISTS(SELECT 1 FROM cards WHERE series = ${escape.literal(series)} AND rarity_class = '${Rarity.GOD}')`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    return result.rows[0].exists;
};

export const doesOtherCardsExistInSeriesForRarity = async (series: Series, rarity: Rarity, cardIds: number[]): Promise<boolean> => {
    const cardsStr = cardIds.join(',');
    const sql = `SELECT EXISTS(SELECT 1 FROM cards WHERE series = ${escape.literal(series)} AND rarity_class = ${escape.literal(rarity)} AND id NOT IN (${cardsStr}))`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    return result.rows[0].exists;
};

export const getCraftingRequestByUserId = async (userId: string): Promise<CraftingRequest | null> => {
    const sql = `SELECT * FROM craft_requests WHERE user_id = ${escape.literal(userId)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }
    return mapRowToCraftingRequest(result.rows[0]);
};

export const getCraftingRequestById = async (id: string): Promise<CraftingRequest | null> => {
    const sql = `SELECT * FROM craft_requests WHERE id = ${id}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }
    return mapRowToCraftingRequest(result.rows[0]);
};

export const closeCraftingRequest = async (id: number, options?: ExecuteSQLOptions) => {
    const sql = `DELETE FROM craft_requests WHERE id = ${id}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        throw new Error('Failed to close craft request!');
    }
};

/**
 * Consumes the cards passed in and grants the grantId
 * If `soulbound` is passed in as true the output will be soulbound and the input cards must be soulbound to be consumed
 */
export const consumeCardsForSingleCard = async (userId: string, type: CraftTypes, consumeIds: number[], grantId: number, soulbound: boolean, options?: ExecuteSQLOptions) => {
    for (const consumeId of consumeIds) {
        await removeCardFromInventoryByMappingId(userId, consumeId, options);
    }

    return await addCardToInventory(userId, grantId, {
        withCheckForGroupProgress: true,
        soulbound,
        reason: `Crafting ${type}`
    }, options);
};
