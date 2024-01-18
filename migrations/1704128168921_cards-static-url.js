/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('cards', {
        static_url: {
            type: 'text',
            notNull: false,
            default: null,
        },
    });
    pgm.sql(`ALTER TABLE cards ALTER COLUMN image_url DROP NOT NULL`);
};

exports.down = pgm => {
    pgm.dropColumns('cards', ['static_url']);   
    pgm.sql(`ALTER TABLE cards ALTER COLUMN image_url SET NOT NULL`);
};
