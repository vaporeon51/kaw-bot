import * as escape from 'pg-escape';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
// SQL functions associated with tracking badge/achievement progress

export async function getUserCompletedGroups (userId: string, options?: ExecuteSQLOptions): Promise<string[][]> {
    const sql = `SELECT groups FROM completed_groups
    WHERE user_id = ${escape.literal(userId)}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return [];
    }
    return result.rows[0].groups;
}

interface CalculatedCompletedGroups {
    userId: string
    numberOfGroups: number
    groups: string[][]
}

export async function calculateUserCompletedGroups (userId: string, options?: ExecuteSQLOptions): Promise<CalculatedCompletedGroups> {
    const sql = `
        WITH groupAndSeriesTotalCards AS (
        SELECT cards.group_name AS "group_name", cards.series AS "series_name", COUNT("groupedCards".*) AS "count" FROM cards
        JOIN (
            SELECT group_name, series FROM cards
            GROUP BY group_name, series
        ) AS "groupedCards"
        ON cards.group_name = "groupedCards".group_name AND
        cards.series = "groupedCards".series
        GROUP BY cards.group_name, cards.series
    )
    SELECT user_id, COUNT(*), ARRAY_AGG(array[groupAndSeriesTotalCards.group_name, groupAndSeriesTotalCards.series_name]) AS "groups" FROM (
                SELECT user_id, group_name, series_name, COUNT(*) AS "count" FROM (
                    SELECT DISTINCT card_to_user.user_id AS "user_id", cards.id, cards.group_name AS "group_name", cards.series AS "series_name" FROM card_to_user
                    JOIN cards ON card_to_user.card_id = cards.id
                    GROUP BY card_to_user.user_id, cards.id, cards.group_name, cards.series 
                ) AS "groupedCardsByUser"
            GROUP BY user_id, group_name, series_name
        ) AS "groupedUserSeriesAndGroup"
        JOIN groupAndSeriesTotalCards ON 
        groupAndSeriesTotalCards.group_name = "groupedUserSeriesAndGroup".group_name AND
        groupAndSeriesTotalCards.series_name = "groupedUserSeriesAndGroup".series_name AND
        groupAndSeriesTotalCards.count = "groupedUserSeriesAndGroup".count
        WHERE user_id = ${escape.literal(userId)}
        GROUP BY user_id
        ORDER BY COUNT DESC
    `;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return {
            userId,
            numberOfGroups: 0,
            groups: []
        };
    }
    return {
        userId: result.rows[0].user_id,
        numberOfGroups: parseInt(result.rows[0].count, 10),
        groups: result.rows[0].groups
    };
}

export async function updateUserCompletedGroups (userId: string, groups: string[][], options?: ExecuteSQLOptions) {
    const groupsArray = ` ARRAY [${groups.map(innerArr => `ARRAY [${innerArr.map(item => escape.literal(item)).join(',')}]::varchar[]`).join(',')}]::varchar[]`;
    const sql = `INSERT INTO completed_groups (user_id, groups) 
    VALUES (${escape.literal(userId)}, ${groupsArray}) ON CONFLICT (user_id) DO UPDATE SET groups = ${groupsArray}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
}
