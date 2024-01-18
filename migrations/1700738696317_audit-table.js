/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('bot_settings', {
        data_key: { type: 'varchar(1000)', notNull: true, primaryKey: true },
        value: { type: 'varchar(1000)', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('bot_settings');
};
