/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        cooldown_notifications: {
            type: 'boolean',
            notNull: true,
            default: 'true'
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['cooldown_notifications']);
};
