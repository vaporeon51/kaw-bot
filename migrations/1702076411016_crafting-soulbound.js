/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('craft_requests', {
        soulbound_output: {
            type: 'boolean',
            default: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('craft_requests', ['soulbound_output']);
};
