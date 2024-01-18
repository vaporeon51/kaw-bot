/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('cards', {
        card_name: {
            type: 'varchar(1000)',
            notNull: true,
            default: ''
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('cards', ['card_name']);
};
