/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('card_to_user', {
        obtained_timestamp: {
            type: 'timestamp',
            notNull: true,
            default: 'now()'
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('card_to_user', ['obtained_timestamp']);
};
