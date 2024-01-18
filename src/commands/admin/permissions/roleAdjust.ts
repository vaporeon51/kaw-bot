import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import PermissionsCache from '../../../services/PermissionsCache';
import { addToRoleSettingsTable } from '../../../db/roles';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { msToTime } from '../../../utils';
import { PERMISSIONS_SECTION } from './_permissions';

const COMMAND_NAME = 'role_adjust';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: PERMISSIONS_SECTION,
    options: [
        {
            name: 'role',
            description: 'The role you want to edit',
            required: true,
            type: 'ROLE'
        },
        {
            name: 'drop_cooldown_seconds',
            description: 'Number of seconds until they can use drop again',
            required: true,
            type: 'NUMBER'
        }
    ],
    description: 'Give a user a specific card based on ID',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        if (!interaction.isRepliable() || interaction.replied) {
            return;
        }
        const role = interaction.options.getRole('role');
        const cooldownSeconds = interaction.options.getNumber('drop_cooldown_seconds');

        if (cooldownSeconds === null) {
            await interaction.reply({
                content: 'Cooldown_ms supplied was null, please supply a number',
                ephemeral: true
            });
            return;
        }
        if (role === null) {
            await interaction.reply({
                content: 'Role supplied was null, please supply a valid role',
                ephemeral: true
            });
            return;
        }

        const position = await PermissionsCache.getInstance().convertRoleIdToPosition(role.id);
        await addToRoleSettingsTable(role.id, position, cooldownSeconds * 1000);
        await interaction.reply({
            content: 'Role settings have been updated',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `Role <@&${role.id}> was adjusted to have a cooldown of ${msToTime(cooldownSeconds * 1000)}`
        ]);
    }
};

export default command;
