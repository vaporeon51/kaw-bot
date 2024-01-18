/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('role_settings', {
        role_id: { type: 'varchar(1000)', primaryKey: true, notNull: true },
        guild_id: { type: 'varchar(1000)', notNull: true },
        position: { type: 'int', notNull: true },
        refresh_time_ms: { type: 'bigint', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('role_settings');
};
