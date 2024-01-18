import Configuration from '../services/Configuration';
import DbConnectionHandler from '../services/DbConnectionHandler';
import * as escape from 'pg-escape';

export const addToRoleSettingsTable = async (roleId: string, position: number, cooldownMs: number) => {
    const config = Configuration.getInstance().getConfig();
    const sql = `INSERT INTO role_settings(role_id, guild_id, position, refresh_time_ms) 
    VALUES(${escape.literal(roleId)}, ${escape.literal(config.guildId)}, ${position}, ${cooldownMs}) 
    ON CONFLICT (role_id) DO UPDATE SET refresh_time_ms = EXCLUDED.refresh_time_ms`;
    await DbConnectionHandler.getInstance().executeSQL(sql);
};

export const resetSettingsForRole = async (roleId: string) => {
    const sql = `DELETE FROM role_settings WHERE role_id = ${escape.literal(roleId)}`;
    await DbConnectionHandler.getInstance().executeSQL(sql);
};

export interface RoleSettings {
    roleId: string
    position: number
    refreshTimeMs: number
};
export const getAllRoleSettings = async () => {
    const config = Configuration.getInstance().getConfig();
    const sql = `SELECT role_id, position, refresh_time_ms FROM role_settings
    WHERE guild_id = ${escape.literal(config.guildId)}
    ORDER BY position ASC`;

    const data = await DbConnectionHandler.getInstance().executeSQL(sql);
    return data.rows.map((row) => {
        const mapped: RoleSettings = {
            roleId: row.role_id,
            position: row.position,
            refreshTimeMs: Number.parseInt(row.refresh_time_ms)
        };
        return mapped;
    });
};
