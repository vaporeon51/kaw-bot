/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('quiz_stats', {
        max_streak: { type: 'INTEGER', notNull: true, default: 0 },
        min_streak: { type: 'INTEGER', notNull: true, default: 0 },
    })
};

exports.down = pgm => {
    pgm.dropColumns('quiz_stats', ['max_streak', 'min_streak'])
};
