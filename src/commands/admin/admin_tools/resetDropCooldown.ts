import type * as Discord from 'discord.js';
import { modifyUserLastBurnedCard, modifyUserLastPackOpened, modifyUserLastQuizCompleted, modifyUserLastReceivedCard } from '../../../db/users';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CooldownNotifier from '../../../services/CooldownNotifier';
import { TOOLS_SECTION } from './_tools';
import { Cooldowns } from '../../../services/CooldownRetriever';

const COMMAND_NAME = 'reset_cooldown';

const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: TOOLS_SECTION,
    options: [
        {
            name: 'type',
            description: 'The type of cooldown you want to reset',
            required: true,
            type: 'STRING',
            choices: Object.values(Cooldowns)
        },
        {
            name: 'target',
            description: 'The user to reset the drop cooldown for',
            required: true,
            type: 'USER'
        }
    ],
    description: 'reset a specific user\'s specified cooldown',
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

        const type = interaction.options.getString('type') as Cooldowns;

        switch (type) {
            case Cooldowns.DROP:
                await modifyUserLastReceivedCard(targetMember.id, null);
                await interaction.reply({
                    content: 'User now has recent daily timer and can use /drop again',
                    ephemeral: true
                });
                break;

            case Cooldowns.QUIZ:
                await modifyUserLastQuizCompleted(targetMember.id, null);
                await interaction.reply({
                    content: 'User now has recent daily timer and can use /quiz again',
                    ephemeral: true
                });
                break;

            case Cooldowns.BURN:
                await modifyUserLastBurnedCard(targetMember.id, null);
                await interaction.reply({
                    content: 'User now has recent daily timer and can use /burn again',
                    ephemeral: true
                });
                break;

            case Cooldowns.OPEN_PACK:
                await modifyUserLastPackOpened(targetMember.id, null);
                await interaction.reply({
                    content: 'User now has recent daily timer and can use /open_pack again',
                    ephemeral: true
                });
                break;

            default:
                await interaction.reply({
                    content: 'Type must be supplied in order to reset cooldown',
                    ephemeral: true
                });
        }

        await CooldownNotifier.getInstance().resetUserNotificationTimeout(targetMember.id);
        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `User <@${targetMember.id}> had their drop timer reset`
        ]);
    }
};

export default command;
