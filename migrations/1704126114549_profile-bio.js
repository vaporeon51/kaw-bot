/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('users', {
        bio: {
            type: 'text',
            notNull: false,
        },
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['bio']);
};
