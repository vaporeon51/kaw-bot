import { Rarity, type Series } from '../config/types';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import escape from 'pg-escape';

export interface CardData {
    id: number
    memberName: string
    groupName: string
    imageUrl: string
    staticUrl: string
    rarityClass: Rarity
    series: Series
    hidden: boolean
};

export const convertRowToCardData = (row: any): CardData => {
    return {
        id: row.id,
        memberName: row.member_name,
        groupName: row.group_name,
        imageUrl: row.image_url,
        staticUrl: row.static_url,
        rarityClass: row.rarity_class,
        series: row.series,
        hidden: row.hidden
    };
};

const buildAllCardsWhereClause = (
    rarityFilter: string | null,
    groupFilter: string | null,
    memberFilter: string | null,
    seriesFilter: string | null,
    withoutWhereKeyword?: boolean
): string => {
    const sections = [];
    if (rarityFilter) {
        sections.push(`LOWER(rarity_class) = LOWER(${escape.literal(rarityFilter)})`);
    }
    if (groupFilter) {
        sections.push(`LOWER(group_name) = LOWER(${escape.literal(groupFilter)})`);
    }
    if (memberFilter) {
        sections.push(`LOWER(member_name) = LOWER(${escape.literal(memberFilter)})`);
    }
    if (seriesFilter) {
        sections.push(`LOWER(series) = LOWER(${escape.literal(seriesFilter)})`);
    }
    const sectionsJoined = withoutWhereKeyword ? sections.join(' AND ') : `WHERE ${sections.join(' AND ')}`;
    return sections.length > 0 ? sectionsJoined : '';
};

export const getCardCreationReasonAndUser = async (cardId: number) => {
    const sql = `SELECT created_for, created_reason FROM cards WHERE id = ${cardId} LIMIT 1`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0 || result.rows[0].created_for === null || result.rows[0].created_reason === null) {
        return null;
    }

    return {
        createdFor: result.rows[0].created_for,
        createdReason: result.rows[0].created_reason
    };
};

export const getMissingCardsForUser = async (
    userId: string,
    rarityFilter: string | null,
    groupFilter: string | null,
    memberFilter: string | null,
    seriesFilter: string | null
): Promise<CardData[]> => {
    let whereClause = buildAllCardsWhereClause(rarityFilter, groupFilter, memberFilter, seriesFilter, true);

    if (whereClause.length > 0) {
        whereClause = `AND ${whereClause}`;
    }

    const sql = `SELECT cards.* FROM cards
    LEFT JOIN card_to_user ON card_to_user.card_id = cards.id AND card_to_user.user_id = ${escape.literal(userId)}
    WHERE card_to_user.id IS NULL ${whereClause}
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
        END ASC, cards.series DESC, cards.group_name DESC, cards.member_name DESC`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (response.rowCount === 0) {
        return [];
    }
    return response.rows.map((item) => convertRowToCardData(item));
};

export const getAllCards = async (
    rarityFilter: string | null,
    groupFilter: string | null,
    memberFilter: string | null,
    seriesFilter: string | null
): Promise<CardData[] | null> => {
    const whereClause = buildAllCardsWhereClause(rarityFilter, groupFilter, memberFilter, seriesFilter);

    const sql = `SELECT * FROM cards
    ${whereClause}
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
        END ASC, cards.series DESC, cards.group_name DESC, cards.member_name DESC`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (response.rowCount === 0) {
        return null;
    }
    return response.rows.map((item) => convertRowToCardData(item));
};

export const getNumberOfCardInInventory = async (cardId: number, userId: string, options?: ExecuteSQLOptions): Promise<number | null> => {
    const sql = `SELECT id FROM card_to_user
    WHERE card_id = ${cardId} AND user_id = '${userId}'`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    return response.rowCount;
};

export const getCardDetails = async (cardId: number, options?: ExecuteSQLOptions): Promise<CardData | null> => {
    const sql = `SELECT * FROM cards
    WHERE id = ${cardId}`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (response.rowCount === 0) {
        return null;
    }

    return convertRowToCardData(response.rows[0]);
};

export const getCardsIds = async (rarity: string, onlyDroppableCards: boolean, series?: Series): Promise<number[]> => {
    const withSeriesFilter = series ? `AND series = '${series}'` : '';
    const droppableFilter = onlyDroppableCards ? 'AND can_be_dropped = TRUE' : '';
    const sql = `SELECT id FROM cards
    WHERE rarity_class = ${escape.literal(rarity)} ${droppableFilter} ${withSeriesFilter}
    ORDER BY id ASC`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    const rows = response.rows.map((item) => item.id);
    return rows;
};

export const getOwnedCardDetails = async (userId: string, cardId: number): Promise<CardData | null> => {
    const sql = `SELECT cards.* FROM card_to_user
    JOIN cards ON cards.id = card_to_user.card_id
    WHERE user_id = ${escape.literal(userId)} AND card_id = ${cardId}`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (response.rowCount === 0) {
        return null;
    }

    return convertRowToCardData(response.rows[0]);
};

export interface CardIssueAndOtherOwners {
    numOfOtherOwners: number
    issue: number
    totalInstances: number
};

export const getIssueAndOtherOwnersForCardInstance = async (userId: string, cardInstanceId: number) => {
    const sql = `WITH cardIssue AS (
        SELECT card_to_user.id, card_to_user.card_id, user_id, ROW_NUMBER () OVER (PARTITION BY cards.id ORDER BY card_to_user.obtained_timestamp DESC) AS "issueNum" FROM card_to_user
        JOIN cards ON cards.id = card_to_user.card_id
    ),
    totalInstancesOfCard AS (
        SELECT card_to_user.card_id, COUNT(*) AS "totalInstances" FROM card_to_user
        GROUP BY card_to_user.card_id
    ),
    numOfOtherUsersOwn AS (
        SELECT card_id, COUNT(*)-1 AS "otherOwners" FROM (
            SELECT DISTINCT card_to_user.card_id, card_to_user.user_id FROM card_to_user
        ) AS "innerTable"
        GROUP BY "innerTable".card_id
    )
    SELECT * FROM cardIssue
    JOIN numOfOtherUsersOwn ON numOfOtherUsersOwn.card_id = cardIssue.card_id
    JOIN totalInstancesOfCard ON totalInstancesOfCard.card_id = cardIssue.card_id
    WHERE cardIssue.id = ${cardInstanceId} AND cardIssue.user_id = ${escape.literal(userId)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }
    const mappedData = result.rows.map((row) => {
        const data: CardIssueAndOtherOwners = {
            numOfOtherOwners: Number.parseInt(row.otherOwners),
            issue: Number.parseInt(row.issueNum),
            totalInstances: Number.parseInt(row.totalInstances)
        };
        return data;
    });
    return mappedData[0];
};
