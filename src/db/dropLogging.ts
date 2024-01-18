import * as escape from 'pg-escape';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import { Rarity } from '../config/types';

export const insertDropLog = async (userId: string, cardId: number, options?: ExecuteSQLOptions) => {
    const sql = `INSERT INTO drop_logging(user_id, card_id) VALUES (${escape.literal(userId)}, ${cardId})`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount !== 1) {
        throw new Error('Unable to insert drop log!');
    }
};

const generateRarityTable = () => {
    const rarities = Object.values(Rarity).map((rarity) => `(${escape.literal(rarity)})`).join(', ');
    return `rarity_table(rarity) AS (VALUES ${rarities})`;
};

export interface TimeSinceLastRarity {
    rarity: Rarity
    dropsSince: number
};

export const getNumberOfDropsSinceRarity = async (userId: string): Promise<TimeSinceLastRarity[]> => {
    const sql = `
    WITH ordered_drop_numbering AS (
        SELECT drop_logging.obtained_timestamp, cards.rarity_class, ROW_NUMBER () OVER (ORDER BY drop_logging.obtained_timestamp DESC) AS "rowNum" FROM drop_logging
        JOIN cards ON cards.id = drop_logging.card_id
        WHERE drop_logging.user_id = ${escape.literal(userId)} 
    ),
    total_drops AS (
        SELECT COUNT(*) AS "total" FROM drop_logging
        WHERE drop_logging.user_id = ${escape.literal(userId)} 
    ),
    ${generateRarityTable()}
    SELECT rarity, COALESCE(MIN(ordered_drop_numbering."rowNum")-1, total_drops.total) AS "numOfDrawsSince" FROM rarity_table
    FULL JOIN total_drops ON 1=1
    LEFT JOIN ordered_drop_numbering ON ordered_drop_numbering.rarity_class = rarity_table.rarity
    GROUP BY rarity, total_drops.total
    ORDER BY "numOfDrawsSince" DESC`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);

    return result.rows.map((row) => {
        const timeSince: TimeSinceLastRarity = {
            rarity: row.rarity,
            dropsSince: Number.parseInt(row.numOfDrawsSince)
        };
        return timeSince;
    });
};
