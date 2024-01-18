import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';

import { updateProfileBioText } from '../../db/profile';

const command: CommandInterface = {
    name: 'set_bio',
    dmAllowed: false,
    subCommandOf: 'profile',
    isPublicCommand: true,
    description: 'Change the bio on your profile',
    options: [
        {
            name: 'text',
            required: false,
            description: 'Your new bio',
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const bioText = interaction.options.getString('text');
        if (bioText === null) {
            await interaction.reply({
                content: 'You need to provide a bio text',
                ephemeral: true
            });
            return;
        }

        if (bioText.includes('\n') || bioText.includes('\r') || bioText.includes('`') || bioText.includes('>')) {
            await interaction.reply({
                content: 'Your bio text cannot contain newlines, backticks, or >',
                ephemeral: true
            });
            return;
        }

        if (bioText.length > 255) {
            await interaction.reply({
                content: 'Your bio text is too long (Max 255 characters)',
                ephemeral: true
            });
            return;
        }

        await updateProfileBioText(interaction.user.id, bioText);
        await interaction.reply({
            ephemeral: true,
            content: 'Your bio text has been updated!'
        });
    }
};

export default command;
