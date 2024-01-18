import type * as Discord from 'discord.js';
import { addCardToInventory } from '../../../db/users';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CardCache from '../../../services/CardCache';
import { PostCommand, PostCommandOperations } from '../../../services/PostCommandOperations';
import { TOOLS_SECTION } from './_tools';

const COMMAND_NAME = 'gift';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: TOOLS_SECTION,
    options: [
        {
            name: 'card_id',
            description: 'The card you wish the user to receive',
            required: true,
            type: 'STRING'
        },
        {
            name: 'target',
            description: 'The user to reset their daily limit on',
            required: true,
            type: 'USER'
        },
        {
            name: 'soulbound',
            description: 'If the gifted card will be soulbound',
            required: true,
            type: 'BOOLEAN'
        }
    ],
    description: 'Give a user a specific card based on ID',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const targetMember = interaction.options.getUser('target');
        const cardId = interaction.options.getString('card_id');
        const soulbound = interaction.options.getBoolean('soulbound') ?? false;

        if (!targetMember) {
            await interaction.reply({
                content: 'Unexpected error occurred while attempting to look at users inventory',
                ephemeral: true
            });
            return;
        }

        if (!cardId || isNaN(parseInt(cardId))) {
            await interaction.reply({
                content: 'cardId must be specified in order to gift a user',
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

        const cardDetails = await CardCache.getInstance().getCardDetails(parseInt(cardId));
        if (cardDetails === null) {
            await interaction.reply({
                content: 'This cardId does not exist, please try another',
                ephemeral: true
            });
            return;
        }

        await addCardToInventory(targetMember.id, cardDetails.id, {
            reason: `Gift from ${interaction.user.username}`,
            withCheckForGroupProgress: true,
            soulbound
        });
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: targetMember.id });

        await interaction.reply({
            content: 'User now card added to their inventory',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `Gifted user <@${targetMember.id}>, card ${cardId}`
        ]);
    }
};

export default command;
