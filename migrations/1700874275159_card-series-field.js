/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('cards', {
        series: {
            type: 'varchar(200)',
            notNull: true,
            default: 'Series 1'
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('cards', ['series']);
};
