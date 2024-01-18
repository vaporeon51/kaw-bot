import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';
import { updateProfileFavoriteCard } from '../../db/profile';
import { getCardDetails } from '../../db/cards';

const command: CommandInterface = {
    name: 'set_favorite',
    dmAllowed: false,
    subCommandOf: 'profile',
    isPublicCommand: true,
    description: 'Change your favorite card for your profile',
    options: [
        {
            name: 'card_id',
            required: false,
            description: 'Your new favorite card',
            type: 'NUMBER'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardId = interaction.options.getNumber('card_id');
        if (cardId === null) {
            await interaction.reply({
                content: 'You need to provide a card id',
                ephemeral: true
            });
            return;
        }

        const cardDetails = await getCardDetails(cardId);
        if (cardDetails === null) {
            await interaction.reply({
                content: 'That card does not exist',
                ephemeral: true
            });
            return;
        }

        await updateProfileFavoriteCard(interaction.user.id, cardId);
        await interaction.reply({
            ephemeral: true,
            content: 'Your favorite card has been updated!'
        });
    }
};

export default command;
