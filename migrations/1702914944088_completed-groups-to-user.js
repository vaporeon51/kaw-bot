/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('completed_groups', {
        user_id: { type: 'varchar(1000)', primaryKey: true, notNull: true, references: 'users(id)', onDelete: 'cascade' },
        groups: { type: 'varchar[][]', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('completed_groups');
};
