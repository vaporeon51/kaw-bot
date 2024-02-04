import * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { ANNOUNCEMENTS_SECTION } from './_announcement';
import { getInstanceConfig } from '../../../config/config';
import ClientManager from '../../../services/ClientManager';
import { type QuizWeekResults, getQuizWeekSummary } from '../../../db/quiz';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../../../services/DbConnectionHandler';

const COMMAND_NAME = 'quiz_announcement';

const createLeaderboardMessageEmbed = (
    data: QuizWeekResults, week: number
) => {
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
        `Thanks to everyone who participated in week ${week} of the KAW quiz.`,
        '',
        'Here are your major prize winners:',
        '',
        `1st place: <@${data.topScorers[0]?.userId}> with a rating of ${data.topScorers[0]?.value}!`,
        `2nd place: <@${data.topScorers[1]?.userId}> with a rating of ${data.topScorers[1]?.value}!`,
        `3rd place: <@${data.topScorers[2]?.userId}> with a rating of ${data.topScorers[2]?.value}!`,
        '',
        'Then we have our special prize winners:',
        ''
    ];

    if (winStreakers.length === 1) {
        lines.push(
            `The longest streaker this week was <@${winStreakers[0]}> stringing together ${data.longestWinStreakers[0]?.value} correct answers!`,
            ''
        );
    } else {
        lines.push(
            `The longest streakers this week were <@${winStreakers.join('>, <@')}> stringing together ${data.longestWinStreakers[0]?.value} correct answers!`,
            ''
        );
    }

    lines.push(
        `And finally please give your condolences to <@${lossStreakers.join('>, <@')}> for missing ${data.longestLossStreakers[0]?.value} in a row...`
    );

    embed.setDescription(lines.join('\n'));
    embed.setFooter({
        text: 'Rewards are being dispersed.'
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
        try {
            console.log('data');
            const data = await getQuizWeekSummary(week, executeSQLOptions);
            if (data === null) {
                throw new Error('Query returned null');
            }

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
        // // calc earning

        // // deliver
        await interaction.editReply({
            content: 'Complete'
        });
    }

};

export default command;
