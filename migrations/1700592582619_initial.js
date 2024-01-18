/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('users', {
        id: { type: 'varchar(1000)', notNull: true, primaryKey: true },
        last_card_received: { type: 'bigint', notNull: false }
    });
};

exports.down = pgm => {
    pgm.dropTable('users');
};
