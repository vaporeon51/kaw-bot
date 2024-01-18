/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        guild_id: {
            type: 'varchar(64)',
            notNull: true,
            default: '1161711943971774524'
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['guild_id']);
};
