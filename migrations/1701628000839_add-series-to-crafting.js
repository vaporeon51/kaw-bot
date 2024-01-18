/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('craft_requests', {
        destination_series: {
            type: 'varchar(300)',
            notNull: true
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('craft_requests', ['destination_series']);
};
