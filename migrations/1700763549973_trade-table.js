/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('trade_requests', {
        id: 'id',
        from_user: { type: 'varchar(1000)', notNull: true, refrences: 'users(id)' },
        to_user: { type: 'varchar(1000)', notNull: true, refrences: 'users(id)' },
        from_cards: { type: 'integer[]', notNull: true },
        to_cards: { type: 'integer[]', notNull: true },
        trade_status: { type: 'varchar(200)', notNull: true, default: 'OPEN' },
        created_timestamp: { type: 'timestamp', default: 'now()', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('trade_requests');
};
