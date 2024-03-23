import { type CommandInterface } from '../services/CommandInteractionManager';
import type * as Discord from 'discord.js';
import { generatePagesBasedOnInventory } from '../common/sharedInventoryUtils';
import { getInventoryContentsWithFilters } from '../db/users';
import { handleListBasedEmbed } from '../common/listBasedEmbed';

const command: CommandInterface = {
    name: 'dupes',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'See your duplicates',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const user = interaction.user;

        const inventory = await getInventoryContentsWithFilters(user.id, null, null, null, null, null);

        // Filter inventory for only items that have more than 1
        const filteredInventory = inventory.filter(item => item.count > 1);

        const pages = generatePagesBasedOnInventory(user.username, filteredInventory);
        await handleListBasedEmbed(
            interaction,
            interaction.user.id,
            pages,
            'Message expired use /dupes again to see your dupes',
            { ephemeral: true, clearOnlyComponents: true }
        );
    }
};

export default command;
