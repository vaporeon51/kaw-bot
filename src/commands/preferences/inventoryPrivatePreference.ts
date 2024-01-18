import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';
import { modifyInventoryIsPrivate } from '../../db/users';

const COMMAND_NAME = 'inventory_visibility';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: true,
    subCommandOf: 'preferences',
    options: [
        {
            name: 'private',
            description: 'Set to true for private inventory, false for public',
            required: true,
            type: 'BOOLEAN'
        }
    ],
    description: 'Allows setting your inventory to private or public',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const isEnabled = interaction.options.getBoolean('private') ?? true;

        await modifyInventoryIsPrivate(interaction.user.id, isEnabled);
        await interaction.reply({
            content: `Inventory is now \`${isEnabled ? 'private' : 'public'}\``,
            ephemeral: true
        });
    }
};

export default command;
