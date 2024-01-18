import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';
import { updateProfileLookingFor } from '../../db/profile';
import { parseStringToCardsIds } from '../../common/optionParsing';
import CardCache from '../../services/CardCache';

const command: CommandInterface = {
    name: 'set_looking_for',
    dmAllowed: false,
    subCommandOf: 'profile',
    isPublicCommand: true,
    description: 'Change the cards you are currently looking for',
    options: [
        {
            name: 'card_ids',
            required: false,
            description: 'Cards you are looking for seperated by commas',
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cards = interaction.options.getString('card_ids') ?? '';
        const parsedIds = parseStringToCardsIds(cards);
        if (parsedIds === null) {
            await interaction.reply({
                content: 'Invalid card ids, must be seperated by commas',
                ephemeral: true
            });
            return;
        }

        if (parsedIds.length > 10) {
            await interaction.reply({
                content: 'You can only have a maximum of 10 cards you are looking for',
                ephemeral: true
            });
            return;
        }

        try {
            const allExist = parsedIds.map(async (id) => await CardCache.getInstance().getCardDetails(id.id));
            await Promise.all(allExist);
        } catch (e) {
            await interaction.reply({
                content: 'One or more of the cards you provided does not exist',
                ephemeral: true
            });
            return;
        }

        await updateProfileLookingFor(interaction.user.id, cards);
        await interaction.reply({
            ephemeral: true,
            content: 'Your looking for cards have been updated!'
        });
    }
};

export default command;
