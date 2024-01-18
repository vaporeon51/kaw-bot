/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.createTable('cards', {
        id: 'id',
        member_name: { type: 'varchar(1000)', notNull: true },
        group_name: { type: 'varchar(1000)', notNull: true },
        image_url: { type: 'varchar(1000)', notNull: true },
        rarity_class: { type: 'varchar(10)', notNull: true }
    });
};

exports.down = pgm => {
    pgm.dropTable('cards');
};
