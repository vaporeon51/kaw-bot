import * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { ANNOUNCEMENTS_SECTION } from './_announcement';
import { getInstanceConfig } from '../../../config/config';
import ClientManager from '../../../services/ClientManager';
import { type QuizWeekResults, getQuizWeekSummary } from '../../../db/quiz';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../../../services/DbConnectionHandler';
import { CurrencyManager, CurrencyResult } from '../../../services/currency/Currency';

const COMMAND_NAME = 'quiz_announcement';
const TOP_SCORER_COINS = [10000, 5000, 2500];
const WIN_STREAK_COINS = 1000;

const createLeaderboardMessageEmbed = (
    data: QuizWeekResults, week: number
) => {
    const quote = '`';
    const embed: Discord.EmbedBuilder = new Discord.EmbedBuilder();
    const winStreakers: string[] = [];
    const lossStreakers: string[] = [];
    data.longestWinStreakers.forEach(user => {
        winStreakers.push(user.userId);
    });
    data.longestLossStreakers.forEach(user => {
        lossStreakers.push(user.userId);
    });

    embed.setTitle(`**Week ${week} Quiz Final Standings**`);
    const lines = [
        `Thanks to everyone who participated in week ${week} of the KAW quiz!`,
        '',
        '**Major prize winners:**',
        `> 🥇 <@${data.topScorers[0]?.userId}> with a rating of ${quote}${data.topScorers[0]?.value}${quote}`,
        `> 🥈 <@${data.topScorers[1]?.userId}> with a rating of ${quote}${data.topScorers[1]?.value}${quote}`,
        `> 🥉 <@${data.topScorers[2]?.userId}> with a rating of ${quote}${data.topScorers[2]?.value}${quote}`,
        '',
        '**Special prize winners:**',
        `> 📈 Longest winning streak: <@${winStreakers.join('>, <@')}> stringing together ${quote}${data.longestWinStreakers[0]?.value}${quote} correct answers!`,
        '',
        '**Hall of shame**:',
        `> 📉 Longest losing streak: <@${lossStreakers.join('>, <@')}> for missing ${quote}${data.longestLossStreakers[0]?.value}${quote} questions in a row...`,
        ''
    ];

    embed.setDescription(lines.join('\n'));
    embed.setFooter({
        text: 'Rewards have been dispersed.'
    });
    return embed;
};

const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: ANNOUNCEMENTS_SECTION,
    description: 'Post weekly quiz leaderboard announcement',
    options: [
        {
            name: 'week',
            description: 'The week for of the announcement',
            required: true,
            type: 'NUMBER'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const week = interaction.options.getNumber('week');

        if (typeof week !== 'number') {
            await interaction.reply({
                content: 'week must be a number',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });
        const connection = await DbConnectionHandler.getInstance().getConnection();
        const executeSQLOptions: ExecuteSQLOptions = { client: connection };
        const data = await getQuizWeekSummary(week, executeSQLOptions);
        if (data === null) {
            throw new Error('Query returned null');
        }
        try {
            console.log('data');

            const usersToMention: string[] = [];
            data.topScorers.forEach(user => {
                usersToMention.push(user.userId);
            });
            data.longestWinStreakers.forEach(user => {
                usersToMention.push(user.userId);
            });
            data.longestLossStreakers.forEach(user => {
                usersToMention.push(user.userId);
            });
            const client = ClientManager.getInstance().getClient();
            const channelId = getInstanceConfig().announcementChannel;
            if (channelId === null) {
                throw new Error('Unexpected announcement channel id is null');
            }

            const channel = client.channels.cache.get(channelId);
            if (channel?.isTextBased()) {
                const embed = createLeaderboardMessageEmbed(data, week);
                await channel.send({
                    embeds: [embed],
                    allowedMentions: {
                        users: usersToMention
                    }
                });
            } else {
                throw new Error('Unexpected error while trying to send announcement message to channel');
            }
        } catch (e) {
            console.error(`Failed to send announcement message: ${e}`);
            await interaction.editReply({
                content: 'Error during embed creation'
            });
            return;
        }
        // // disperse rewards
        for (const user of data.longestWinStreakers) {
            const isFailure = await CurrencyManager.getInstance().deposit(user.userId, WIN_STREAK_COINS, 'Awarded for longest winning streak');
            if (isFailure === CurrencyResult.ERROR) {
                throw new Error('Unable to award coins');
            }
            console.log(isFailure);
        }
        for (const [index, user] of data.topScorers.entries()) {
            if (index >= TOP_SCORER_COINS.length) {
                throw new Error('There are more top scorers than awards specified');
            }
            const isFailure = await CurrencyManager.getInstance().deposit(user.userId, TOP_SCORER_COINS[index], `Awarded for top scorer position ${index + 1}`);
            if (isFailure === CurrencyResult.ERROR) {
                throw new Error('Unable to award coins');
            }
            console.log(isFailure);
        }

        // // deliver
        await interaction.editReply({
            content: 'Complete'
        });
    }
};

export default command;
