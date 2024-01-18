/* eslint-disable camelcase */

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumns('trade_requests', {
        from_user_accepted: {
            type: 'boolean',
            notNull: true,
            default: false
        },
        to_user_accepted: {
            type: 'boolean',
            notNull: true,
            default: false
        }
    });
};

exports.down = pgm => {
    pgm.dropColumns('card_to_user', ['from_user_accepted', 'to_user_accepted']);
};
