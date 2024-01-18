import DbConnectionHandler from '../services/DbConnectionHandler';
import * as escape from 'pg-escape';

export enum BotSettingKey {
    AUDIT_LOG_CHANNEL_DATA_KEY = 'audit-log-channel-id',
    TRADE_CHANNEL_DATA_KEY = 'trade-channel-id',
    EVENT_CHANNEL_DATA_KEY = 'event-channel-id',
    DROP_CHANNEL_DATA_KEY = 'drop-channel-id'
}

export const getBotSetting = async (dataKey: BotSettingKey): Promise<string | null> => {
    const sql = `SELECT value FROM bot_settings WHERE data_key = ${escape.literal(dataKey)}`;
    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (response.rowCount === 0) {
        return null;
    }
    return response.rows[0].value;
};

export const setBotSetting = async (dataKey: BotSettingKey, channelId: string): Promise<void> => {
    const sql = `INSERT INTO bot_settings(data_key, value) 
    VALUES(${escape.literal(dataKey)}, ${escape.literal(channelId)}) 
    ON CONFLICT (data_key) DO UPDATE SET value = EXCLUDED.value`;

    await DbConnectionHandler.getInstance().executeSQL(sql);
};
