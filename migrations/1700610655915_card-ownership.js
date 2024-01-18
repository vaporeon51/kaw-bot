/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('card_to_user', {
        id: 'id',
        card_id: { type: 'serial', notNull: true },
        user_id: { type: 'varchar(1000)', notNull: true }
    });

    pgm.createConstraint('card_to_user', 'card_id_references', {
        foreignKeys: {
            columns: 'card_id',
            references: 'cards(id)',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }
    });

    pgm.createConstraint('card_to_user', 'user_id_references', {
        foreignKeys: {
            columns: 'user_id',
            references: 'users(id)',
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE'
        }
    });
};

exports.down = pgm => {
    pgm.dropConstraint('card_to_user', 'card_id_references');
    pgm.dropConstraint('card_to_user', 'user_id_references');
    pgm.dropTable('card_to_user');
};
