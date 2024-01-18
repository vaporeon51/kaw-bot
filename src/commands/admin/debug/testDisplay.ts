import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { displayCard } from '../../../common/cardDisplay';
import CardCache from '../../../services/CardCache';
import { DEBUG_SECTION } from './_debug';

const command: CommandInterface = {
    name: 'test_display',
    dmAllowed: false,
    subCommandOf: DEBUG_SECTION,
    isPublicCommand: false,
    description: 'Test displaying an image as it would be for drop/display',
    options: [
        {
            name: 'card_id',
            description: 'The card you want to show off',
            required: true,
            type: 'NUMBER'
        },
        {
            name: 'soulbound',
            description: 'To show the card with soulbound or not',
            required: false,
            type: 'BOOLEAN'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardId = interaction.options.getNumber('card_id');
        const soulbound = interaction.options.getBoolean('soulbound') ?? false;

        if (!cardId) {
            await interaction.reply({
                content: '`cardId is required for display!`',
                ephemeral: true
            });
            return;
        }

        const ownedDetails = await CardCache.getInstance().getCardDetails(cardId);
        if (ownedDetails === null) {
            await interaction.reply({
                content: '`The specified card does not exist`',
                ephemeral: true
            });
            return;
        }

        await displayCard(interaction, ownedDetails, {
            authorDetails: {
                name: `${interaction.user.username} is showing off:`,
                iconURL: interaction.user.avatarURL() ?? undefined
            },
            soulbound
        });
    }
};

export default command;
