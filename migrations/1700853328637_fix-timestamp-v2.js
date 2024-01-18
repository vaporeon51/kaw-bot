/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.sql('ALTER TABLE card_to_user ALTER COLUMN obtained_timestamp SET DEFAULT now();');
    pgm.sql('ALTER TABLE trade_requests ALTER COLUMN created_timestamp SET DEFAULT now();');
};

exports.down = pgm => {
    pgm.alterColumn('card_to_user', 'obtained_timestamp', {
        default: 'now()'
    });
    pgm.alterColumn('trade_requests', 'created_timestamp', {
        default: 'now()'
    });
};
