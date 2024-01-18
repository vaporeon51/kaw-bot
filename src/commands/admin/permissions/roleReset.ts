import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { resetSettingsForRole } from '../../../db/roles';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { PERMISSIONS_SECTION } from './_permissions';

const COMMAND_NAME = 'role_reset';
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
        }
    ],
    description: 'Reset any settings for a particular role',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const role = interaction.options.getRole('role');

        if (role === null) {
            await interaction.reply({
                content: 'Role supplied was null, please supply a valid role',
                ephemeral: true
            });
            return;
        }

        await resetSettingsForRole(role.id);
        await interaction.reply({
            content: 'Role settings for role have been cleared!',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `Role <@&${role.id}> was reset to default cooldown time`
        ]);
    }
};

export default command;
