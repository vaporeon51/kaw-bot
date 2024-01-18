/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('card_to_user', {
        soulbound: {
            type: 'boolean',
            default: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('card_to_user', ['soulbound']);
};
