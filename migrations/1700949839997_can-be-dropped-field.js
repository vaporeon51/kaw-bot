/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('cards', {
        can_be_dropped: {
            type: 'boolean',
            notNull: true,
            default: 'true'
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('cards', ['can_be_dropped']);
};
