import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { type ProgressForSeries, getProgressTowardsAllSeries, getProgressTowardsAllSeriesForgroup, getProgressTowardsAllGroupsInSeries } from '../db/users';
import { Groups, convertSeriesAliasToStandard, getListOfValidSeriesOptions } from '../cardConstants';
import { getPerc } from '../utils';
import { codeItem } from '../embedHelpers';
import { Series } from '../config/types';

const command: CommandInterface = {
    name: 'progress',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Get a summary of your progress towards all current series',
    options: [
        {
            name: 'group_filter',
            description: 'Show progress for a specific group',
            required: false,
            type: 'STRING'
        },
        {
            name: 'series_filter',
            description: 'Show progress for all groups for a particular series',
            required: false,
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const userId = interaction.user.id;

        const groupName = interaction.options.getString('group_filter');
        if (groupName !== null && !Object.values(Groups).includes(groupName as Groups)) {
            await interaction.reply({
                content: 'A valid group name must be used if `group_filter` is used',
                ephemeral: true
            });
            return;
        }

        const series = convertSeriesAliasToStandard(interaction.options.getString('series_filter'));
        if (series !== null && !Object.values(Series).includes(series as Series)) {
            await interaction.reply({
                content: `A valid series name must be used if \`series_filter\` is used (Valid options: ${getListOfValidSeriesOptions()})`,
                ephemeral: true
            });
            return;
        }

        if (series !== null && groupName !== null) {
            await interaction.reply({
                content: 'You cannot use `series_filter` and `group_filter` simultaneously',
                ephemeral: true
            });
            return;
        }

        let title = '';
        let progress: ProgressForSeries[] | null = [];
        if (groupName) {
            title = `${groupName} Progress`;
            progress = await getProgressTowardsAllSeriesForgroup(userId, groupName);
        } else if (series) {
            title = `${series} Progress`;
            progress = await getProgressTowardsAllGroupsInSeries(userId, series);
        } else {
            title = 'Overall Series Progress';
            progress = await getProgressTowardsAllSeries(userId);
        }

        if (progress === null) {
            await interaction.reply({
                content: 'Failed to obtain series progress',
                ephemeral: true
            });
            return;
        }

        const descriptionLines = [
            `**<:CollectionCards:1177797372135350312> \`${interaction.user.username}\` ${title}**`,
            ''
        ];

        let totalObtained = 0;
        let totalOverall = 0;
        const progressLines = [];
        for (const seriesObj of progress) {
            progressLines.push(`\`${seriesObj.name}\` - **${seriesObj.obtained}** out of **${seriesObj.total}** cards (${getPerc(seriesObj.obtained, seriesObj.total)}%)`);
            totalObtained += seriesObj.obtained;
            totalOverall += seriesObj.total;
        }

        descriptionLines.push(`${codeItem('Total')}: **${totalObtained}** out of **${totalOverall}** cards (${getPerc(totalObtained, totalOverall)}%)`);
        const embed = new Discord.EmbedBuilder()
            .setDescription(`${descriptionLines.join('\n')}\n\n${progressLines.join('\n')}`);

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};

export default command;
