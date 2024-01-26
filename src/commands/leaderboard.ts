import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { type LeaderboardEntry, getRarityScoredLeaderboard, getProgressLeaderboard, getQuizLeaderboard } from '../db/users';
import { handleListBasedEmbed, type Page } from '../common/listBasedEmbed';
import { getCurrentQuizWeek } from '../db/quiz';

const PAGINATION_SIZE = 10.0;
export const generatePagesBasedOnLeaderboard = (title: string, leaderboard: LeaderboardEntry[], yourLeaderboardRank: string) => {
    const pages: Page[] = [];
    const totalPages = Math.max(Math.ceil(leaderboard.length / PAGINATION_SIZE), 1);
    for (let i = 1; i <= totalPages; i++) {
        pages.push(generateLeaderboardEmbedPage(title, leaderboard, yourLeaderboardRank, totalPages, i));
    }
    return pages;
};

function generateLeaderboardEmbedPage (title: string, leaderboard: LeaderboardEntry[], yourLeaderboardRank: string, totalPages: number, page = 1): Page {
    if (page === 1 && leaderboard.length === 0) {
        return {
            embeds: [new Discord.EmbedBuilder().setDescription('Empty inventory use `\\drop` to get some cards!')]
        };
    }

    const descriptionLines = [];

    const pageStart = (page - 1) * PAGINATION_SIZE;
    const pageEnd = page * PAGINATION_SIZE;

    for (let i = pageStart; i < pageEnd; i++) {
        // Exceeded size of array
        if (i >= leaderboard.length) {
            continue;
        }
        const item = leaderboard[i];
        descriptionLines.push(`**${i + 1}.** <@${item.userId}> • ${item.score.toLocaleString()}`);
    }

    const fullTitle = `**<:CollectionCards:1177797372135350312> ${title}**`;

    const inventoryEmbed = new Discord.EmbedBuilder()
        .setDescription([fullTitle, '', ...descriptionLines].join('\n'))
        .setFooter({
            text: `Page ${page}/${totalPages} • Your leaderboard rank: ${yourLeaderboardRank}`
        });

    return {
        embeds: [inventoryEmbed]
    };
}

enum LeaderboardSortType {
    QUIZ = 'Quiz',
    SCORE = 'Score',
    PROGRESS = 'Progress'
}

const command: CommandInterface = {
    name: 'leaderboard',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Display the leaderboard',
    options: [
        {
            name: 'type',
            type: 'STRING',
            choices: Object.values(LeaderboardSortType),
            description: 'The way to sort users on the leaderboard',
            required: true
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const type = interaction.options.getString('type') as LeaderboardSortType | null;
        if (!type) {
            await interaction.reply({
                content: 'Type must be supplied in order to show leaderboard',
                ephemeral: true
            });
        }

        let leaderboard, title;
        switch (type) {
            case LeaderboardSortType.SCORE:
                leaderboard = await getRarityScoredLeaderboard();
                title = 'Server Leaderboard (Score)';
                break;

            case LeaderboardSortType.PROGRESS:
                leaderboard = await getProgressLeaderboard();
                title = 'Server Leaderboard (Progress)';
                break;

            default:
                leaderboard = await getQuizLeaderboard();
                title = `Quiz Leaderboard (Week ${getCurrentQuizWeek(Date.now())})`;
        }

        if (!leaderboard) {
            await interaction.reply({
                content: 'Unable to load leaderboard, please try again',
                ephemeral: true
            });
            return;
        }

        const yourLeaderboardRank = leaderboard.findIndex((item) => item.userId === interaction.user.id) + 1;
        const stringfiedRank = yourLeaderboardRank === 0 ? 'Unknown' : yourLeaderboardRank.toString();

        const pages = generatePagesBasedOnLeaderboard(title, leaderboard, stringfiedRank);
        await handleListBasedEmbed(interaction, interaction.user.id, pages, 'Message expired use /leaderboard again', { ephemeral: true });
    }
};

export default command;
