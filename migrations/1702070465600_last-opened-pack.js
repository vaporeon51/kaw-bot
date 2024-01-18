/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        last_pack_opened: {
            type: 'bigint',
            notNull: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('users', ['last_pack_opened']);
};
