/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('groups', {
        name: { primaryKey: true, type: 'varchar(1000)', notNull: true },
    });
    pgm.createTable('idols', {
        id: 'id',
        name: { type: 'varchar(1000)', notNull: true },
        group_name: { type: 'varchar(1000)', notNull: true, references: 'groups(name)', onDelete: 'cascade' },
    });
    pgm.createTable('quiz_image_questions', {
        id: {type: 'bigint', primaryKey: true, notNull: true},
        image_url: { type: 'varchar(1000)', notNull: true },
        type: { type: 'int', notNull: true },
        idol: { type: 'bigint', notNull: false, references: 'idols(id)', onDelete: 'cascade' },
        // Only used if type is 1
        group_name: { type: 'varchar(1000)', notNull: false, references: 'groups(name)', onDelete: 'cascade' },
    });
};

exports.down = pgm => {
    pgm.dropTable('groups', { cascade: true });
    pgm.dropTable('idols', { cascade: true });
    pgm.dropTable('quiz_image_questions');
};
