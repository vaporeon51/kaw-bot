/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.dropTable('new_years_cards');
};

exports.down = pgm => {
    pgm.createTable('new_years_cards', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true }
    });
};
