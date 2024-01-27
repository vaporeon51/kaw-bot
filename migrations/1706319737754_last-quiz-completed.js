/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        last_quiz_completed: {
            type: 'bigint',
            notNull: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['last_quiz_completed']);
};
