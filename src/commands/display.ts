import type * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { displayCard } from '../common/cardDisplay';
import { verifyUserHasCards } from '../common/sharedInventoryUtils';
import { getInventoryContentsWithId } from '../db/users';
import { parseStringToCardsIds } from '../common/optionParsing';

const command: CommandInterface = {
    name: 'display',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Show off a collected card',
    options: [
        {
            name: 'card_id',
            description: 'The card you want to show off',
            required: true,
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardId = interaction.options.getString('card_id') ?? '';
        const parsedCardIds = parseStringToCardsIds(cardId.toString());
        if (!parsedCardIds) {
            await interaction.reply({
                content: '`cardId not in correct format!`',
                ephemeral: true
            });
            return;
        }

        const inventory = await getInventoryContentsWithId(interaction.user.id);
        const hasCard = verifyUserHasCards(inventory, parsedCardIds);
        if (!hasCard.result) {
            await interaction.reply({
                content: '`You don\'t own the cardId provided and cannot show it!`',
                ephemeral: true
            });
            return;
        }

        // FIXME: What happens if they have multiple cards of the same id?
        const cardToDisplay = hasCard.cards[0];
        await displayCard(interaction, cardToDisplay, {
            authorDetails: {
                name: `${interaction.user.username} is flexing:`,
                iconURL: interaction.user.avatarURL() ?? undefined
            },
            soulbound: cardToDisplay.soulbound,
            includeAtUser: false,
            cardInstanceId: cardToDisplay.id
        });
    }
};

export default command;
