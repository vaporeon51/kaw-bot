/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('christmas_cards', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('christmas_cards');
};
