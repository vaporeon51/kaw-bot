import type * as Discord from 'discord.js';
import { removeCardFromInventory } from '../../../db/users';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CardCache from '../../../services/CardCache';
import { PostCommand, PostCommandOperations } from '../../../services/PostCommandOperations';
import { TOOLS_SECTION } from './_tools';

const COMMAND_NAME = 'purge';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: TOOLS_SECTION,
    options: [
        {
            name: 'target',
            description: 'The user to reset their daily limit on',
            required: true,
            type: 'USER'
        },
        {
            name: 'card_id',
            description: 'The card you wish the user to remove from the user',
            required: true,
            type: 'NUMBER'
        },
        {
            name: 'count',
            description: 'The max amount of copies of the card to remove',
            required: true,
            type: 'NUMBER'
        }
    ],
    description: 'Remove card(s) from a specific user based on ID',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardId = interaction.options.getNumber('card_id');
        const count = interaction.options.getNumber('count');
        const targetMember = interaction.options.getUser('target');

        if (!targetMember) {
            await interaction.reply({
                content: 'Unexpected error occurred while to purge for user',
                ephemeral: true
            });
            return;
        }

        if (!cardId || !cardId || !count) {
            await interaction.reply({
                content: 'cardId and count must be specified to purge a card',
                ephemeral: true
            });
            return;
        }

        const cardDetails = await CardCache.getInstance().getCardDetails(cardId);
        if (cardDetails === null) {
            await interaction.reply({
                content: 'This cardId does not exist, please try another',
                ephemeral: true
            });
            return;
        }

        await removeCardFromInventory(targetMember.id, cardDetails.id, count);
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: targetMember.id });

        await interaction.reply({
            content: 'User has had cards successfully removed (if present)',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `User <@${targetMember.id}> had cardId ${cardId} removed from inventory (up to x${count})`
        ]);
    }
};

export default command;
