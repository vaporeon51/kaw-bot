/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        favorite_card_id: {
            type: 'bigint',
            references: 'cards(id)',
            notNull: false,
            default: null,
            onDelete: 'cascade',
        },
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['favorite_card']);
};
