/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('quiz_stats', {
        user_id: { type: 'VARCHAR(1000)', primaryKey: true, references: 'users(id)' },
        win_streak: { type: 'INTEGER', notNull: true, default: 0 },
        ranking_value: { type: 'INTEGER', notNull: true, default: 0 },
        completed_questions: { type: 'integer[]', notNull: true, default: '{}' },
    });
    pgm.createTable('quiz_stats_weekly_snapshot', {
        user_id: { type: 'VARCHAR(1000)', primaryKey: true, references: 'users(id)' },
        winstreak: { type: 'INTEGER', notNull: true, default: 0 },
        ranking_value: { type: 'INTEGER', notNull: true, default: 0 },
        week: { type: 'INTEGER', notNull: true },
    });
};

exports.down = pgm => {
    pgm.dropTable('quiz_stats');
    pgm.dropTable('quiz_stats_weekly_snapshot');
};
