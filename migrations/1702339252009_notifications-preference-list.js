/* eslint-disable camelcase */

// Important that this doesn't change in the main code!!
const STRING_FOR_DROP_NOTIFICATIONS = 'DROP';

exports.shorthands = undefined;

exports.up = pgm => {
    pgm.addColumn('users', {
        notification_types: {
            type: 'varchar[]'
        }
    });

    pgm.sql('ALTER TABLE users ALTER COLUMN notification_types SET DEFAULT array[]::varchar[];');
    pgm.sql(`UPDATE users 
        SET notification_types = ARRAY ['${STRING_FOR_DROP_NOTIFICATIONS}']::varchar[] 
        WHERE cooldown_notifications = TRUE
    `);
    pgm.sql(`UPDATE users 
        SET notification_types = ARRAY []::varchar[] 
        WHERE cooldown_notifications = FALSE 
    `);
    pgm.dropColumns('users', ['cooldown_notifications']);
};

exports.down = pgm => {
    pgm.addColumn('users', {
        cooldown_notifications: {
            type: 'boolean',
            notNull: true,
            default: false
        }
    });
    pgm.sql(`UPDATE users
        SET cooldown_notifications = TRUE
        WHERE '${STRING_FOR_DROP_NOTIFICATIONS}'=ANY(notification_types)`);
    pgm.dropColumns('users', ['notification_types']);
};
