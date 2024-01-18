/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('cards', {
        created_for: {
            type: 'VARCHAR(1000)',
            notNull: false,
        },
        created_reason: {
            type: 'VARCHAR(255)',
            notNull: false,
        },
    });
};

exports.down = pgm => {
    pgm.dropColumns('cards', ['created_for', 'created_reason']);
};
