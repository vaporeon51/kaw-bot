/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('craft_requests', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true, refrences: 'users(id)' },
        type: { type: 'varchar(1000)', notNull: true },
        consuming_cards: { type: 'integer[]', notNull: true },
        destination_rarity: { type: 'varchar(1000)', notNull: true },
        created_timestamp: { type: 'timestamp', default: 'now()', notNull: true }
    });
    pgm.sql('ALTER TABLE craft_requests ALTER COLUMN created_timestamp SET DEFAULT now();');
};

exports.down = pgm => {
    pgm.dropTable('craft_requests');
};
