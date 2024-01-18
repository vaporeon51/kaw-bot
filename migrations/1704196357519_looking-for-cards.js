/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        looking_for_cards: {
            type: 'text'
        },
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['looking_for_cards']);
};
