import AuditLogHandler, { JJ_AUDIT_CONTACT_LINE } from '../services/AuditLogHandler';
import DbConnectionHandler from '../services/DbConnectionHandler';
import { addUserToDatabaseIfNotPresent, getCardsByMappingIds } from './users';
import * as escape from 'pg-escape';

interface TradeInfo {
    id: number
    fromUser: string
    toUser: string
    /**
     * The cards that the fromUser is offering to the toUser
     * (toUser will receive these cards if accepted)
     */
    fromCardIds: number[]
    /**
     * The cards that the toUser is offering to the fromUser
     * (fromUser will receive these cards if accepted)
     */
    toCardIds: number[]
    tradeStatus: string
    createdTimestamp: string
    fromUserAccepted: boolean
    toUserAccepted: boolean
};

const mapRowToTradeData = (row: any): TradeInfo => {
    const tradeInfo: TradeInfo = {
        id: row.id,
        fromUser: row.from_user,
        toUser: row.to_user,
        fromCardIds: row.from_cards,
        toCardIds: row.to_cards,
        tradeStatus: row.trade_status,
        createdTimestamp: row.timestamp,
        fromUserAccepted: row.from_user_accepted,
        toUserAccepted: row.to_user_accepted
    };
    return tradeInfo;
};

export async function insertTradeRequest (
    fromUser: string,
    toUser: string,
    fromCards: number[],
    toCards: number[]
): Promise<string | null> {
    const sql = `INSERT INTO trade_requests(from_user, to_user, from_cards, to_cards, from_user_accepted)
    VALUES(${escape.literal(fromUser)}, ${escape.literal(toUser)}, ARRAY [${fromCards.toString()}]::integer[], ARRAY [${toCards.toString()}]::integer[], TRUE)
    RETURNING id`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }
    return result.rows[0].id;
}

export async function getPendingTradesFromUser (fromUser: string): Promise<TradeInfo[]> {
    const sql = `SELECT 
        id, from_user, to_user, from_cards, to_cards, trade_status, created_timestamp, to_user_accepted, from_user_accepted
        FROM trade_requests
        WHERE trade_status = 'OPEN' AND from_user = ${escape.literal(fromUser)}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return [];
    }

    return result.rows.map((row) => mapRowToTradeData(row));
}

export async function getTradeFromId (tradeId: string): Promise<TradeInfo | null> {
    const sql = `SELECT 
        id, from_user, to_user, from_cards, to_cards, trade_status, created_timestamp, to_user_accepted, from_user_accepted
        FROM trade_requests 
        WHERE trade_status = 'OPEN' AND id = ${escape.literal(tradeId)}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 0) {
        return null;
    }

    return mapRowToTradeData(result.rows[0]);
}

export async function updateAcceptanceOfSideOfTrade (tradeId: string, sideOfTrade: 'from_user_accepted' | 'to_user_accepted'): Promise<void> {
    const sql = `UPDATE trade_requests 
    SET ${sideOfTrade} = TRUE 
    WHERE id = ${escape.literal(tradeId)}`;

    await DbConnectionHandler.getInstance().executeSQL(sql);
}

export async function closeTradeRequest (tradeId: number, fromUserId: string) {
    const sql = `DELETE FROM trade_requests
    WHERE id = ${tradeId}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (result.rowCount === 1) {
        return true;
    }

    // This shouldn't happen
    await AuditLogHandler.getInstance().publishAuditMessage('trade', fromUserId, [
        `Fatal error occurred while trying to close a trade: ${tradeId}`,
        JJ_AUDIT_CONTACT_LINE
    ]);
    return false;
}

export async function exchangeCardsBasedOnTrade (trade: TradeInfo) {
    const connection = await DbConnectionHandler.getInstance().getConnection();

    if (!connection) {
        throw new Error('Failed to get connection from database!');
    }

    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', { client: connection });

        await addUserToDatabaseIfNotPresent(trade.fromUser, { client: connection });
        await addUserToDatabaseIfNotPresent(trade.toUser, { client: connection });

        const userNoLongerHasCard = async (side: string, card: number) => {
            await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', { client: connection });
            return { success: false, error: `User <@${side}> no longer has one or more cards` };
        };
        /**
        * Takes cards from sideA and gives them to sideB based on cardIds
        */
        const transferCardsBetweenUsers = async (sideA: string, sideB: string, cardIds: number[]) => {
            for (const card of cardIds) {
                const cardDetailsList = await getCardsByMappingIds(sideA, [card]);
                if (cardDetailsList === null || cardDetailsList.length !== 1) {
                    return await userNoLongerHasCard(sideA, card);
                }

                const sql = `
                    UPDATE card_to_user 
                    SET user_id = ${escape.literal(sideB)}
                    WHERE CTID IN (
                        SELECT CTID 
                        FROM card_to_user
                        WHERE id = ${card} AND user_id = ${escape.literal(sideA)}
                        LIMIT 1
                    )`;
                const transferCard = await DbConnectionHandler.getInstance().executeSQL(sql, { client: connection });
                if (transferCard.rowCount !== 1) {
                    return await userNoLongerHasCard(sideA, card);
                }
            }
            return { success: true, error: null };
        };

        const fromExchange = await transferCardsBetweenUsers(trade.fromUser, trade.toUser, trade.fromCardIds);
        if (!fromExchange.success) {
            return fromExchange;
        }

        const toExchange = await transferCardsBetweenUsers(trade.toUser, trade.fromUser, trade.toCardIds);
        if (!toExchange.success) {
            return toExchange;
        }

        await DbConnectionHandler.getInstance().executeSQL('COMMIT', { client: connection });
        return { success: true, error: null };
    } catch (e) {
        console.error(`${e} ${(e as any).stack}`);
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', { client: connection });
        await AuditLogHandler.getInstance().publishAuditMessage('trade', trade.fromUser, [
            'Fatal error has occurred while attempting to trade, see logs for more details',
            JJ_AUDIT_CONTACT_LINE
        ]);
        return { success: false, error: 'Internal error occurred when attemping trade', fatal: true };
    } finally {
        connection.release();
    }
}
