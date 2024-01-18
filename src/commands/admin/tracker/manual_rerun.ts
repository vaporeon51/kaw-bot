import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { TRACKER_SECTION } from './_tracker';
import { PostCommand, PostCommandOperations } from '../../../services/PostCommandOperations';

const COMMAND_NAME = 'card_change';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: TRACKER_SECTION,
    options: [
        {
            name: 'target',
            description: 'The user to re-run for',
            required: true,
            type: 'USER'
        }
    ],
    description: 'Re-runs the card change tracker process for that user',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const user = interaction.options.getUser('target', true);

        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: user.id });
        await interaction.reply({
            content: 'cardChange event submitted to tracker process',
            ephemeral: true
        });
    }
};

export default command;
