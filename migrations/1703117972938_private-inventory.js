/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        private_inventory: {
            type: 'boolean',
            default: false,
            notNull: true,
        },
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['private_inventory']);
};
