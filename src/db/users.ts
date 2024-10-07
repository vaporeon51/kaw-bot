import escape from 'pg-escape';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import Configuration from '../services/Configuration';
import { Rarity, type Series } from '../config/types';
import { getCurrentQuizWeek } from '../db/quiz';
export interface InventoryResult {
    count: number
    cardId: number
    soulbound: boolean
    memberName: string
    groupName: string
    imageUrl: string
    staticUrl: string
    rarityClass: Rarity
    series: Series
}

export interface ProgressForSeries {
    name: string
    obtained: number
    total: number
};

const mapRowToProgressForSeries = (row: any): ProgressForSeries => {
    const value: ProgressForSeries = {
        name: row.series,
        obtained: typeof row.obtained === 'string' ? parseInt(row.obtained) : row.obtained,
        total: typeof row.total === 'string' ? parseInt(row.total) : row.total
    };
    return value;
};

export const getAllUserIds = async (): Promise<string[] | null> => {
    const sql = `SELECT DISTINCT id
            FROM users`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql)

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map((row: any) => {
        return row.id
    })
}

export const getProgressTowardsAllGroupsInSeries = async (userId: string, series: string, options?: ExecuteSQLOptions): Promise<ProgressForSeries[] | null> => {
    const sql = `WITH TotalCountsForSeries AS (
            SELECT series, group_name, COUNT(*) FROM cards
            GROUP BY series, group_name
        ), 
        TotalCountsForUserForSeries AS (
            SELECT series, group_name, COUNT(*) FROM (
                SELECT DISTINCT cards.id, series, cards.group_name FROM card_to_user
                JOIN cards ON cards.id = card_to_user.card_id
                WHERE card_to_user.user_id = ${escape.literal(userId)}
            ) AS "dedupedCards"
            GROUP BY series, group_name
        )
        SELECT TotalCountsForSeries.group_name, TotalCountsForSeries.series, coalesce(TotalCountsForUserForSeries.count, 0) AS "obtained", TotalCountsForSeries.count AS "total" FROM TotalCountsForSeries
        LEFT JOIN TotalCountsForUserForSeries ON TotalCountsForSeries.series = TotalCountsForUserForSeries.series AND TotalCountsForSeries.group_name = TotalCountsForUserForSeries.group_name
        WHERE TotalCountsForSeries.series = ${escape.literal(series)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map((row: any) => {
        const value: ProgressForSeries = {
            name: row.group_name,
            obtained: typeof row.obtained === 'string' ? parseInt(row.obtained) : row.obtained,
            total: typeof row.total === 'string' ? parseInt(row.total) : row.total
        };
        return value;
    });
};

export const getProgressLeaderboard = async (options?: ExecuteSQLOptions): Promise<LeaderboardEntry[] | null> => {
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
    ),
    numOfCompletedGroups AS (
            SELECT user_id, COUNT(*) FROM (
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
        GROUP BY user_id
    ),
    totalNumOfCardsForUser AS (
        SELECT user_id, COUNT(card_id) AS "count" FROM (
            SELECT DISTINCT card_id, user_id FROM card_to_user
            GROUP BY user_id, card_id
        ) AS "innerTable"
        GROUP BY user_id
    )
    SELECT 
        totalNumOfCardsForUser.user_id, 
        totalNumOfCardsForUser.count AS "totalUniqueCards", 
        COALESCE(numOfCompletedGroups.count, 0) AS "totalGroups",
        ((totalNumOfCardsForUser.count * 100) + (COALESCE(numOfCompletedGroups.count, 0) * 300)) AS "score"
    FROM totalNumOfCardsForUser
    LEFT JOIN numOfCompletedGroups ON numOfCompletedGroups.user_id = totalNumOfCardsForUser.user_id
    ORDER BY score DESC`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map((row: any) => {
        const value: LeaderboardEntry = {
            userId: row.user_id,
            score: Number.parseInt(row.score)
        };
        return value;
    });
};

export interface LeaderboardEntry {
    userId: string
    score: number
};

export const getRarityScoredLeaderboard = async (options?: ExecuteSQLOptions): Promise<LeaderboardEntry[] | null> => {
    const sql = `SELECT user_id, SUM(score) as "score" FROM
        (SELECT 
            card_to_user.user_id AS "user_id", 
            CASE cards.rarity_class
                WHEN '${Rarity.GOD}' THEN 7290 
                WHEN '${Rarity.SSS}' THEN 2430
                WHEN '${Rarity.SS}' THEN 810
                WHEN '${Rarity.S}' THEN 270
                WHEN '${Rarity.A}' THEN 90
                WHEN '${Rarity.B}' THEN 30
                WHEN '${Rarity.C}' THEN 10
                ELSE 3  
            END AS "score"
        FROM card_to_user
        JOIN cards ON cards.id = card_to_user.card_id) AS "innerUserData"
        GROUP BY user_id
        ORDER BY score DESC`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map((row: any) => {
        const value: LeaderboardEntry = {
            userId: row.user_id,
            score: Number.parseInt(row.score)
        };
        return value;
    });
};

export const getQuizLeaderboard = async (options?: ExecuteSQLOptions): Promise<LeaderboardEntry[] | null> => {
    const quizWeek = getCurrentQuizWeek(Date.now());
    const sql = `SELECT user_id, ranking_value as "score"
        FROM quiz_stats
        WHERE week = ${quizWeek}
        ORDER BY score DESC`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map((row: any) => {
        const value: LeaderboardEntry = {
            userId: row.user_id,
            score: Number.parseInt(row.score)
        };
        return value;
    });
};

export const getProgressTowardsAllSeriesForgroup = async (userId: string, groupName: string, options?: ExecuteSQLOptions): Promise<ProgressForSeries[] | null> => {
    const sql = `WITH TotalCountsForSeries AS (
            SELECT series, group_name, COUNT(*) FROM cards
            GROUP BY series, group_name
        ), 
        TotalCountsForUserForSeries AS (
            SELECT series, group_name, COUNT(*) FROM (
                SELECT DISTINCT cards.id, series, cards.group_name FROM card_to_user
                JOIN cards ON cards.id = card_to_user.card_id
                WHERE card_to_user.user_id = ${escape.literal(userId)}
            ) AS "dedupedCards"
            GROUP BY series, group_name
        )
        SELECT TotalCountsForSeries.series, coalesce(TotalCountsForUserForSeries.count, 0) AS "obtained", TotalCountsForSeries.count AS "total" FROM TotalCountsForSeries
        LEFT JOIN TotalCountsForUserForSeries ON TotalCountsForSeries.series = TotalCountsForUserForSeries.series AND TotalCountsForSeries.group_name = TotalCountsForUserForSeries.group_name
        WHERE TotalCountsForSeries.group_name = ${escape.literal(groupName)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map(mapRowToProgressForSeries);
};

export const getProgressTowardsAllSeries = async (userId: string, options?: ExecuteSQLOptions): Promise<ProgressForSeries[] | null> => {
    const sql = `WITH TotalCountsForSeries AS (
            SELECT series, COUNT(*) FROM cards
            GROUP BY series
        ), 
        TotalCountsForUserForSeries AS (
            SELECT series, COUNT(*) FROM (
                SELECT DISTINCT cards.id, series, cards.group_name FROM card_to_user
                JOIN cards ON cards.id = card_to_user.card_id
                WHERE card_to_user.user_id = ${escape.literal(userId)}
            ) AS "dedupedCards"
            GROUP BY series
        )
        SELECT TotalCountsForSeries.series, coalesce(TotalCountsForUserForSeries.count, 0) AS "obtained", TotalCountsForSeries.count AS "total" FROM TotalCountsForSeries
        LEFT JOIN TotalCountsForUserForSeries ON TotalCountsForSeries.series = TotalCountsForUserForSeries.series`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    if (result.rowCount === 0) {
        return null;
    }
    return result.rows.map(mapRowToProgressForSeries);
};

export interface CardsForCurrentSeries {
    owned: number
    total: number
};
export const getProgressTowardsSeries = async (
    userId: string,
    groupName: string,
    series: Series,
    options?: ExecuteSQLOptions
): Promise<CardsForCurrentSeries | null> => {
    const sql = `
    WITH numOfCardsForSeries AS (
        SELECT COUNT(*) AS "count", series, group_name FROM cards
        WHERE group_name = ${escape.literal(groupName)} AND series = ${escape.literal(series)}
        GROUP BY series, group_name
    ),
    cardsForGroup AS (
        SELECT COUNT(*) AS "count" FROM (
            SELECT cards.id FROM card_to_user
            JOIN cards ON cards.id = card_to_user.card_id
            WHERE user_id = ${escape.literal(userId)} AND group_name = ${escape.literal(groupName)} AND series = ${escape.literal(series)}
            GROUP BY cards.id
        ) AS "cards_for_group"
    )
    SELECT cardsForGroup.count AS "owned", numOfCardsForSeries.count AS "total" FROM cardsForGroup
    JOIN numOfCardsForSeries ON 1=1
    `;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return null;
    }
    return {
        owned: result.rows[0].owned,
        total: result.rows[0].total
    };
};

export type InventoryResultWithIds = InventoryResult & {
    id: number
};

export const getInventoryContentsWithId = async (
    userId: string,
    options?: ExecuteSQLOptions
): Promise<InventoryResultWithIds[]> => {
    const sql = `SELECT 
        card_to_user.soulbound, 
        card_to_user.id, 
        cards.id AS "card_id", 
        cards.member_name, 
        cards.group_name, 
        cards.image_url, 
        cards.rarity_class, 
        cards.series,
        cards.static_url
    FROM card_to_user
    JOIN cards ON cards.id = card_to_user.card_id
    WHERE card_to_user.user_id = ${escape.literal(userId)}`;
    const data = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    return data.rows.map((item) => {
        const row: InventoryResultWithIds = {
            count: 1,
            cardId: item.card_id,
            id: item.id,
            staticUrl: item.static_url,
            soulbound: item.soulbound,
            memberName: item.member_name,
            groupName: item.group_name,
            imageUrl: item.image_url,
            rarityClass: item.rarity_class,
            series: item.series
        };
        return row;
    });
};

export const getCardsByMappingIds = async (userId: string, ids: number[], options?: ExecuteSQLOptions): Promise<InventoryResult[]> => {
    const sql = `SELECT
        card_to_user.soulbound, 
        card_to_user.id, 
        cards.id AS "card_id", 
        cards.member_name, 
        cards.group_name, 
        cards.image_url, 
        cards.rarity_class, 
        cards.series,
        cards.static_url
    FROM card_to_user 
    JOIN cards ON cards.id = card_to_user.card_id
    WHERE card_to_user.id IN (${ids.join(', ')}) AND card_to_user.user_id = ${escape.literal(userId)}`;

    const response = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    return response.rows.map((item) => {
        const row: InventoryResult = {
            count: item.count,
            cardId: item.card_id,
            staticUrl: item.static_url,
            soulbound: item.soulbound,
            memberName: item.member_name,
            groupName: item.group_name,
            imageUrl: item.image_url,
            rarityClass: item.rarity_class,
            series: item.series
        };
        return row;
    });
};

const buildAllCardsWhereClause = (
    rarityFilter: string | null,
    groupFilter: string | null,
    memberFilter: string | null,
    seriesFilter: string | null,
    soulboundFilter: boolean | null,
    prefix = '',
    withoutWhereKeyword?: boolean
): string => {
    const getWithPrefix = (item: string) => {
        if (prefix !== '' && prefix) {
            return `${prefix}.${item}`;
        }
        return item;
    };

    const sections = [];
    if (rarityFilter) {
        sections.push(`LOWER(${getWithPrefix('rarity_class')}) = LOWER(${escape.literal(rarityFilter)})`);
    }
    if (groupFilter) {
        sections.push(`LOWER(${getWithPrefix('group_name')}) = LOWER(${escape.literal(groupFilter)})`);
    }
    if (memberFilter) {
        sections.push(`LOWER(${getWithPrefix('member_name')}) = LOWER(${escape.literal(memberFilter)})`);
    }
    if (seriesFilter) {
        sections.push(`LOWER(${getWithPrefix('series')}) = LOWER(${escape.literal(seriesFilter)})`);
    }
    if (soulboundFilter !== null) {
        sections.push(`soulbound = ${soulboundFilter}`);
    }
    const sectionsJoined = withoutWhereKeyword ? sections.join(' AND ') : `WHERE ${sections.join(' AND ')}`;
    return sections.length > 0 ? sectionsJoined : '';
};

export const getInventoryContents = async (
    userId: string,
    options?: ExecuteSQLOptions
): Promise<InventoryResult[]> => {
    const sql = `WITH groupedCounts AS (
        SELECT COUNT(*) as "count", soulbound, card_id FROM card_to_user
        WHERE user_id = ${escape.literal(userId)}
        GROUP BY card_id, soulbound
    )
    SELECT groupedCounts.count, groupedCounts.soulbound AS "soulbound", cards.static_url, cards.id, cards.member_name, cards.group_name, cards.image_url, cards.rarity_class, cards.series FROM groupedCounts
    JOIN cards ON groupedCounts.card_id = cards.id 
    ORDER BY
        CASE cards.rarity_class
            WHEN '${Rarity.GOD}' THEN 0
            WHEN '${Rarity.SSS}' THEN 1 
            WHEN '${Rarity.SS}' THEN 2 
            WHEN '${Rarity.S}' THEN 3 
            WHEN '${Rarity.A}' THEN 4 
            WHEN '${Rarity.B}' THEN 5 
            WHEN '${Rarity.C}' THEN 6 
            ELSE 7
        END ASC, cards.series DESC, groupedCounts.soulbound ASC, cards.group_name DESC, cards.member_name DESC`;
    const data = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    return data.rows.map((item) => {
        const row: InventoryResult = {
            count: item.count ? parseInt(item.count) : item.count,
            cardId: item.id,
            staticUrl: item.static_url,
            soulbound: item.soulbound,
            memberName: item.member_name,
            groupName: item.group_name,
            imageUrl: item.image_url,
            rarityClass: item.rarity_class,
            series: item.series
        };
        return row;
    });
};

export const getInventoryContentsWithFilters = async (
    userId: string,
    rarityFilter: string | null,
    groupFilter: string | null,
    memberFilter: string | null,
    seriesFilter: string | null,
    soulboundFilter: boolean | null,
    options?: ExecuteSQLOptions
): Promise<InventoryResult[]> => {
    const sql = `WITH groupedCounts AS (
        SELECT COUNT(*) as "count", soulbound, card_id FROM card_to_user
        WHERE user_id = ${escape.literal(userId)}
        GROUP BY card_id, soulbound
    )
    SELECT groupedCounts.count, groupedCounts.soulbound, cards.static_url, cards.id, cards.member_name, cards.group_name, cards.image_url, cards.rarity_class, cards.series FROM groupedCounts
    JOIN cards ON groupedCounts.card_id = cards.id 
    ${buildAllCardsWhereClause(rarityFilter, groupFilter, memberFilter, seriesFilter, soulboundFilter, 'cards', false)}
    ORDER BY
        CASE cards.rarity_class
            WHEN '${Rarity.GOD}' THEN 0
            WHEN '${Rarity.SSS}' THEN 1 
            WHEN '${Rarity.SS}' THEN 2 
            WHEN '${Rarity.S}' THEN 3 
            WHEN '${Rarity.A}' THEN 4 
            WHEN '${Rarity.B}' THEN 5 
            WHEN '${Rarity.C}' THEN 6 
            ELSE 7
        END ASC, cards.series DESC, groupedCounts.soulbound ASC, cards.group_name DESC, cards.member_name DESC`;
    const data = await DbConnectionHandler.getInstance().executeSQL(sql, options);

    return data.rows.map((item) => {
        const row: InventoryResult = {
            count: item.count ? parseInt(item.count) : item.count,
            cardId: item.id,
            staticUrl: item.static_url,
            soulbound: item.soulbound,
            memberName: item.member_name,
            groupName: item.group_name,
            imageUrl: item.image_url,
            rarityClass: item.rarity_class,
            series: item.series
        };
        return row;
    });
};

export interface UserData {
    id: string
    guildId: string
    lastCardReceived: number | undefined
    lastBurnPerformed: number | undefined
    lastPackOpened: number | undefined
    lastQuizCompleted: number | undefined
    allowedCooldownTypes: string[]
    hasPrivateInventory: boolean
}
const mapRowToUserData = (row: any): UserData => {
    const data: UserData = {
        id: row.id,
        guildId: row.guild_id,
        lastCardReceived: row.last_card_received ? Number.parseInt(row.last_card_received) : undefined,
        allowedCooldownTypes: row.notification_types,
        lastBurnPerformed: row.last_burn_performed ? Number.parseInt(row.last_burn_performed) : undefined,
        lastPackOpened: row.last_pack_opened ? Number.parseInt(row.last_pack_opened) : undefined,
        lastQuizCompleted: row.last_quiz_completed ? Number.parseInt(row.last_quiz_completed) : undefined,
        hasPrivateInventory: row.private_inventory
    };
    return data;
};

export const getUserData = async (userId: string, options?: ExecuteSQLOptions): Promise<UserData | null> => {
    const sql = `SELECT * FROM users WHERE id = ${escape.literal(userId)}`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (response.rowCount !== 1) {
        return null;
    }
    return mapRowToUserData(response.rows[0]);
};

export const getAllUserDataForGuild = async (guildId: string, options?: ExecuteSQLOptions): Promise<UserData[]> => {
    const sql = `SELECT * FROM users WHERE guild_id = ${escape.literal(guildId)}`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (response.rowCount === 0) {
        return [];
    }
    return response.rows.map((row) => mapRowToUserData(row));
};

export const removeAllCardsFromUser = async (userId: string, options?: ExecuteSQLOptions): Promise<void> => {
    const sql = `DELETE FROM card_to_user WHERE user_id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

/**
 * Only removes regular cards not soulbound ones
 */
export const removeCardFromInventory = async (
    userId: string,
    cardId: number,
    amount: number,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const sql = `DELETE FROM card_to_user WHERE 
    ctid IN (
        SELECT ctid FROM card_to_user
        WHERE user_id = ${escape.literal(userId)} AND card_id = '${cardId}' AND soulbound = FALSE
        LIMIT ${amount}
    )`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        throw new Error('Expected to delete more than zero card(s)');
    }
};

/**
 * Only removes regular cards not soulbound ones
 */
export const removeCardFromInventoryByMappingId = async (
    userId: string,
    mappingId: number,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const sql = `DELETE FROM card_to_user WHERE 
    ctid IN (
        SELECT ctid FROM card_to_user
        WHERE user_id = ${escape.literal(userId)} AND id = '${mappingId}' 
    )`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        throw new Error('Expected to delete more than one card');
    }
};

export const removeSoulboundCardFromInventory = async (
    userId: string,
    cardId: number,
    amount: number,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const sql = `DELETE FROM card_to_user WHERE 
    ctid IN (
        SELECT ctid FROM card_to_user
        WHERE user_id = ${escape.literal(userId)} AND card_id = '${cardId}' AND soulbound = TRUE
        LIMIT ${amount}
    )`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        throw new Error('Expected to delete more than one card');
    }
};

export interface AddCardOptions {
    soulbound?: boolean
    reason: string
    withCheckForGroupProgress?: boolean
};
export const addCardToInventory = async (
    userId: string,
    cardId: number,
    cardOptions: AddCardOptions,
    options?: ExecuteSQLOptions
): Promise<number> => {
    await addUserToDatabaseIfNotPresent(userId, options);
    const soulboundFlag = cardOptions.soulbound ?? false;
    const sql = `INSERT INTO card_to_user(user_id, card_id, soulbound) VALUES('${userId}', ${cardId}, ${soulboundFlag}) RETURNING id`;
    const results = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (results.rowCount !== 1) {
        throw new Error('Unable to insert card to user');
    }

    return parseInt(results.rows[0].id, 10);
};

export const modifyUserLastReceivedCard = async (
    userId: string,
    lastReceived: number | null,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const lastReceivedVal = lastReceived ?? 'NULL';
    const sql = `UPDATE users SET last_card_received = ${lastReceivedVal} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const modifyUserLastBurnedCard = async (
    userId: string,
    lastBurnedCard: number | null,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const lastReceivedVal = lastBurnedCard ?? 'NULL';
    const sql = `UPDATE users SET last_burn_performed = ${lastReceivedVal} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const modifyUserLastPackOpened = async (
    userId: string,
    lastPackOpened: number | null,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const lastReceivedVal = lastPackOpened ?? 'NULL';
    const sql = `UPDATE users SET last_pack_opened = ${lastReceivedVal} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const modifyUserLastQuizCompleted = async (
    userId: string,
    lastQuizCompleted: number | null,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const lastReceivedVal = lastQuizCompleted ?? 'NULL';
    const sql = `UPDATE users SET last_quiz_completed = ${lastReceivedVal} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const modifyInventoryIsPrivate = async (
    userId: string,
    isPrivate: boolean,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const sql = `UPDATE users SET private_inventory = ${isPrivate} WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const modifyUserNotificationPreference = async (
    userId: string,
    type: string,
    value: boolean,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const currentUserData = await getUserData(userId, options);
    if (currentUserData === null) {
        throw new Error('Unable to retrieve user data');
    }

    const modifiedNotificationTypes = new Set(currentUserData.allowedCooldownTypes);
    if (value) {
        modifiedNotificationTypes.add(type);
    } else {
        modifiedNotificationTypes.delete(type);
    }

    const typesAsString = modifiedNotificationTypes.size > 0 ? `'${Array.from(modifiedNotificationTypes).join('\', \'')}'` : '';

    const sql = `UPDATE users 
        SET notification_types = ARRAY [${typesAsString}]::varchar[] 
        WHERE id = ${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};

export const addUserToDatabaseIfNotPresent = async (
    userId: string,
    options?: ExecuteSQLOptions
): Promise<void> => {
    const config = Configuration.getInstance().getConfig();
    const sql = `INSERT INTO users(id, guild_id, last_card_received) 
    VALUES(${escape.literal(userId)}, ${escape.literal(config.guildId)}, NULL) ON CONFLICT DO NOTHING`;

    await DbConnectionHandler.getInstance().executeSQL(sql, options);
};
