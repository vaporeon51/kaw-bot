import { type CommandInterface } from '../services/CommandInteractionManager';
import type * as Discord from 'discord.js';
import { generatePagesBasedOnInventory } from '../common/sharedInventoryUtils';
import { getInventoryContentsWithFilters, getUserData } from '../db/users';
import { handleListBasedEmbed } from '../common/listBasedEmbed';
import { codeItem } from '../embedHelpers';
import { isAdminUser } from '../utils';
import { Series } from '../config/types';

const command: CommandInterface = {
    name: 'inventory',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'See your card inventory',
    options: [
        {
            name: 'target',
            description: 'The user to see the inventory of (must be public)',
            required: false,
            type: 'USER'
        },
        {
            name: 'rarity_filter',
            description: 'Get details about only cards of a specific rarity',
            required: false,
            type: 'STRING'
        },
        {
            name: 'group_filter',
            description: 'Get details about only cards of a specific group',
            required: false,
            type: 'STRING'
        },
        {
            name: 'member_filter',
            description: 'Get details about only cards of a specific member',
            required: false,
            type: 'STRING'
        },
        {
            name: 'series_filter',
            description: 'Get details about cards only for a specific series',
            required: false,
            type: 'STRING',
            choices: Object.values(Series)
        },
        {
            name: 'soulbound_filter',
            description: 'Get details about only soulbound cards',
            required: false,
            type: 'BOOLEAN'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const user = interaction.options.getUser('target') ?? interaction.user;
        const rarityFilter = interaction.options.getString('rarity_filter');
        const groupFilter = interaction.options.getString('group_filter');
        const memberFilter = interaction.options.getString('member_filter');
        const seriesFilter = interaction.options.getString('series_filter');
        const soulboundFilter = interaction.options.getBoolean('soulbound_filter');

        const userData = await getUserData(user.id);
        if (userData === null) {
            await interaction.reply({
                content: 'User does not have an inventory',
                ephemeral: true
            });
            return;
        }

        const isAdmin = isAdminUser(interaction.user.id);
        if (!isAdmin && userData.hasPrivateInventory && user.id !== interaction.user.id) {
            await interaction.reply({
                content: `${codeItem(user.username)}'s inventory is private`,
                ephemeral: true
            });
            return;
        }

        const inventory = await getInventoryContentsWithFilters(user.id, rarityFilter, groupFilter, memberFilter, seriesFilter, soulboundFilter);

        const pages = generatePagesBasedOnInventory(user.username, inventory);
        await handleListBasedEmbed(
            interaction,
            interaction.user.id,
            pages,
            'Message expired use /inventory again to see other pages',
            { ephemeral: true, clearOnlyComponents: true }
        );
    }
};

export default command;
