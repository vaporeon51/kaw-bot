/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.dropTable('christmas_cards', { ifExists: true });
    pgm.createTable('new_years_cards', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('new_years_cards');
    pgm.createTable('christmas_cards', {
        id: 'id',
        user_id: { type: 'varchar(1000)', notNull: true }
    });
};
