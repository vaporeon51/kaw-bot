/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.alterColumn('card_to_user', 'obtained_timestamp', {
        default: 'now'
    });
};

exports.down = pgm => {
    pgm.alterColumn('card_to_user', 'obtained_timestamp', {
        default: 'now()'
    });
};
