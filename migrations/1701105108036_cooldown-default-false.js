/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.alterColumn('users', 'cooldown_notifications', {
        type: 'boolean',
        notNull: true,
        default: 'false'
    });
};

exports.down = pgm => {
    pgm.alterColumn('users', 'cooldown_notifications', {
        type: 'boolean',
        notNull: true,
        default: 'true'
    });
};
