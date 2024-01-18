import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import PermissionsCache from '../../../services/PermissionsCache';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { PERMISSIONS_SECTION } from './_permissions';

const COMMAND_NAME = 'refresh';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    subCommandOf: PERMISSIONS_SECTION,
    isPublicCommand: false,
    description: 'Refresh the permissions cache of the bot',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        PermissionsCache.getInstance().reset();

        await interaction.reply({
            content: '`Permissions cache refreshed`',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, []);
    }
};

export default command;
