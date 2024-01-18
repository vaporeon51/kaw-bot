/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('drop_logging', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true, references: 'users(id)', onDelete: 'cascade' },
        card_id: { type: 'serial', notNull: true, references: 'cards(id)', onDelete: 'cascade' },
        obtained_timestamp: { type: 'timestamp', default: 'now()', notNull: true }
    });
    pgm.sql('ALTER TABLE drop_logging ALTER COLUMN obtained_timestamp SET DEFAULT now();');
};

exports.down = pgm => {
    pgm.dropTable('drop_logging');
};
