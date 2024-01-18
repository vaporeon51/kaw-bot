import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { type CardData, getMissingCardsForUser } from '../db/cards';
import { handleListBasedEmbed, type Page } from '../common/listBasedEmbed';
import { getCardListStringWithHidden } from '../common/cardDisplay';
import { convertSeriesAliasToStandard } from '../cardConstants';
import { Series } from '../config/types';

const PAGINATION_SIZE = 15.0;
export const generatePagesBasedOnCards = (cards: CardData[]) => {
    const pages: Page[] = [];
    const totalPages = Math.max(Math.ceil(cards.length / PAGINATION_SIZE), 1);
    for (let i = 1; i <= totalPages; i++) {
        pages.push(generateMissingEmbed(cards, totalPages, i));
    }
    return pages;
};

export function generateMissingEmbed (cards: CardData[], totalPages: number, page = 1) {
    if (cards.length === 0 && page === 1) {
        return {
            ephemeral: true,
            components: [],
            embeds: [new Discord.EmbedBuilder().setDescription('You have no missing cards congrats!`)')]
        };
    }

    const descriptionLines = [];

    const pageStart = (page - 1) * PAGINATION_SIZE;
    const pageEnd = page * PAGINATION_SIZE;

    for (let i = pageStart; i < pageEnd; i++) {
        // Exceeded size of array
        if (i >= cards.length) {
            continue;
        }
        descriptionLines.push(getCardListStringWithHidden(cards[i]));
    }

    const inventoryEmbed = new Discord.EmbedBuilder()
        .setTitle('Missing Cards')
        .setDescription(descriptionLines.join('\n'))
        .setFooter({
            text: `Page ${page}/${totalPages}`
        });

    return {
        embeds: [inventoryEmbed]
    };
}

const command: CommandInterface = {
    name: 'missing_cards',
    dmAllowed: false,
    isPublicCommand: true,
    options: [
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
        }
    ],
    description: 'Displays all cards you are currently missing with filters',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        if (!interaction.isRepliable() || interaction.replied) {
            return;
        }
        const rarityFilter = interaction.options.getString('rarity_filter');
        const groupFilter = interaction.options.getString('group_filter');
        const memberFilter = interaction.options.getString('member_filter');
        const seriesFilter = interaction.options.getString('series_filter');
        const cards = await getMissingCardsForUser(interaction.user.id, rarityFilter, groupFilter, memberFilter, convertSeriesAliasToStandard(seriesFilter));

        if (cards === null) {
            await interaction.reply({
                content: 'No cards match that search criteria',
                ephemeral: true
            });
            return;
        }

        const pages = generatePagesBasedOnCards(cards);
        await handleListBasedEmbed(interaction, interaction.user.id, pages, 'Message expired use /missing again', { ephemeral: true, clearOnlyComponents: true });
    }
};

export default command;
