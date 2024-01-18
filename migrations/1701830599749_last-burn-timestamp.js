/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        last_burn_performed: {
            type: 'bigint',
            notNull: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['last_burn_performed']);
};
