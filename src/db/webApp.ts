import * as escape from 'pg-escape';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import { request } from 'undici';
import type * as discord from 'discord.js';

export async function insertSession (userId: string, sessionId: string, accessKey: string, refreshKey: string, expiresAt: number, options?: ExecuteSQLOptions): Promise<void> {
    const sql = `INSERT INTO sessions (user_id, sid, access_key, refresh_key, expires_at) 
    VALUES (${escape.literal(userId)}, ${escape.literal(sessionId)}, ${escape.literal(accessKey)}, ${escape.literal(refreshKey)}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE 
        SET sid=${escape.literal(sessionId)}, access_key=${escape.literal(accessKey)}, refresh_key=${escape.literal(refreshKey)}, expires_at=${expiresAt}`;

    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount !== 1) {
        throw new Error('Error when inserting session');
    }
}

export async function removeSession (userId: string) {
    const sql = `DELETE FROM sessions WHERE user_id=${escape.literal(userId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql);
}

export interface Session {
    userId: string
    accessKey: string
    refreshKey: string
    expiresAt: number
}

export async function getSession (sessionId: string, options?: ExecuteSQLOptions): Promise<Session | null> {
    if (sessionId === undefined || sessionId === null || sessionId === '') {
        return null;
    }

    const sql = `SELECT * FROM sessions WHERE sid=${escape.literal(sessionId)}`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result.rowCount === 0) {
        return null;
    }

    return {
        userId: result.rows[0].user_id,
        accessKey: result.rows[0].access_key,
        refreshKey: result.rows[0].refresh_key,
        expiresAt: result.rows[0].expires_at
    };
}

export async function getUserDataSession (session: Session) {
    const userResult = await request('https://discord.com/api/users/@me', {
        headers: {
            authorization: `Bearer ${session.accessKey}`
        }
    });

    const json = await userResult.body.json();
    return json as discord.RESTGetAPIUserResult;
}
