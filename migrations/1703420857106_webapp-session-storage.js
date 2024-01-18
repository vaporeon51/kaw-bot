/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('sessions', {
        user_id: { type: 'VARCHAR(100)', primaryKey: true, notNull: true },
        sid: { type: 'VARCHAR(100)' },
        access_key: { type: 'VARCHAR(500)', notNull: true },
        refresh_key: { type: 'VARCHAR(500)', notNull: true },
        expires_at: { type: 'bigint', notNull: true },
        created_at: {
            type: 'TIMESTAMP',
            notNull: true,
            default: pgm.func('current_timestamp'),
        },
    });
};

exports.down = pgm => {
    pgm.dropTable('sessions');
};
