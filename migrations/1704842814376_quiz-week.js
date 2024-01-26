/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.dropTable('quiz_stats');
    pgm.createTable('quiz_stats', {
        user_id: { type: 'VARCHAR(1000)', primaryKey: true, references: 'users(id)' },
        week: {
            type: 'integer',
            notNull: true,
            primaryKey: true,
        },
        win_streak: { type: 'INTEGER', notNull: true, default: 0 },
        max_streak: { type: 'INTEGER', notNull: true, default: 0 },
        min_streak: { type: 'INTEGER', notNull: true, default: 0 },
        ranking_value: { type: 'INTEGER', notNull: true, default: 0 },
        completed_questions: { type: 'integer[]', notNull: true, default: '{}' },
    });
};

exports.down = pgm => {
    pgm.dropColumns('quiz_stats', 'week')
    pgm.dropTable('quiz_stats_weekly_snapshot');
};
