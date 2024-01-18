import type * as Discord from 'discord.js';
import { modifyUserLastReceivedCard } from '../../../db/users';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CooldownNotifier from '../../../services/CooldownNotifier';
import { TOOLS_SECTION } from './_tools';

const COMMAND_NAME = 'reset_drop_cooldown';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: TOOLS_SECTION,
    options: [
        {
            name: 'target',
            description: 'The user to reset the drop cooldown for',
            required: true,
            type: 'USER'
        }
    ],
    description: 'reset a specific user\'s drop cooldown',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const targetMember = interaction.options.getUser('target');

        if (!targetMember) {
            await interaction.reply({
                content: 'Unexpected error occurred while attempting to look at users inventory',
                ephemeral: true
            });
            return;
        }

        if (targetMember.bot) {
            await interaction.reply({
                content: 'Cannot check inventory of a bot',
                ephemeral: true
            });
            return;
        }

        await modifyUserLastReceivedCard(targetMember.id, null);
        await interaction.reply({
            content: 'User now has recent daily timer and can use /drop again',
            ephemeral: true
        });

        await CooldownNotifier.getInstance().resetUserNotificationTimeout(targetMember.id);
        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `User <@${targetMember.id}> had their drop timer reset`
        ]);
    }
};

export default command;
