/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('cards', {
        hidden: {
            type: 'boolean',
            notNull: true,
            default: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('cards', 'hidden');
};
