/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.alterColumn('users', 'id', {
        type: 'varchar(64)'
    });
    pgm.alterColumn('card_to_user', 'user_id', {
        type: 'varchar(64)'
    });
};

exports.down = pgm => {
    pgm.alterColumn('users', 'id', {
        type: 'varchar(1000)'
    });
    pgm.alterColumn('card_to_user', 'user_id', {
        type: 'varchar(1000)'
    });
};
