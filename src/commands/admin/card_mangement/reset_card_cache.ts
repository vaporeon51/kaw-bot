import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import CardCache from '../../../services/CardCache';
import { CARDS_SECTION } from './_cards';

const COMMAND_NAME = 'reset_card_cache';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: CARDS_SECTION,
    description: 'Reset card cache to propagate new data',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        CardCache.getInstance().reset();

        await interaction.reply({
            content: 'Reset card cache',
            ephemeral: true
        });
    }
};

export default command;
