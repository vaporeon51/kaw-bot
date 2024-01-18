import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import DbConnectionHandler from '../../../services/DbConnectionHandler';
import { Groups, convertSeriesAliasToStandard, getListOfValidSeriesOptions } from '../../../cardConstants';
import escape from 'pg-escape';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CardCache from '../../../services/CardCache';
import { Rarity, Series } from '../../../config/types';
import { CARDS_SECTION } from './_cards';

const addImageToDatabaseIfNotPresent = async (
    cardName: string,
    memberName: string,
    groupName: string,
    series: Series,
    imageUrl: string,
    rarityClass: string,
    canBeDropped: boolean
): Promise<number> => {
    const sql = `INSERT INTO 
        cards(card_name, member_name, group_name, image_url, series, rarity_class, can_be_dropped) 
        VALUES(
            ${escape.literal(cardName)}, 
            ${escape.literal(memberName)}, 
            ${escape.literal(groupName)}, 
            ${escape.literal(imageUrl)}, 
            ${escape.literal(series)}, 
            ${escape.literal(rarityClass)},
            ${canBeDropped}
        ) 
    ON CONFLICT DO NOTHING
    RETURNING id`;

    const response = await DbConnectionHandler.getInstance().executeSQL(sql);
    if (response.rowCount === 0) {
        throw new Error('Unable to insert card!');
    }
    const insertRow = response.rows[0];
    return insertRow.id as number;
};

const COMMAND_NAME = 'upload';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: CARDS_SECTION,
    options: [
        {
            name: 'series',
            description: 'The series the card belongs to',
            required: true,
            choices: Object.values(Series),
            type: 'STRING'
        },
        {
            name: 'group',
            description: 'The group of the member',
            required: true,
            type: 'STRING'
        },
        {
            name: 'member',
            description: 'The name of the member',
            required: true,
            type: 'STRING'
        },
        {
            name: 'card_name',
            description: 'The name of the card',
            required: true,
            type: 'STRING'
        },
        {
            name: 'image_url',
            description: 'The url to the image',
            required: true,
            type: 'STRING'
        },
        {
            name: 'rarity',
            description: 'The rarity of the card',
            required: true,
            type: 'STRING'
        },
        {
            name: 'can_be_dropped',
            description: 'If the card can be dropped normally via /drop',
            required: false,
            type: 'BOOLEAN'
        }
    ],
    description: 'Upload new cards to the database',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardName = interaction.options.getString('card_name', true);
        const group = interaction.options.getString('group', true);
        const member = interaction.options.getString('member', true);
        const imageUrl = interaction.options.getString('image_url', true);
        const rarityClass = interaction.options.getString('rarity', true);
        const series = convertSeriesAliasToStandard(interaction.options.getString('series', true)) as Series;
        const canBeDropped = interaction.options.getBoolean('can_be_dropped', false) ?? true;

        if (!cardName || !group || !member || !imageUrl || !rarityClass || !series) {
            await interaction.reply({
                content: 'Please fill in all fields to upload a new card (aside from can_be_dropped)',
                ephemeral: true
            });
            return;
        }

        if (series !== null && !Object.values(Series).includes(series as Series)) {
            await interaction.reply({
                content: `A valid series name must be used if \`series_filter\` is used (Valid options: ${getListOfValidSeriesOptions()})`,
                ephemeral: true
            });
            return;
        }

        if (!Object.values(Groups).includes(group as Groups)) {
            const allGroups = Object.values(Groups).map(i => `\`${i}\``).join(', ');
            await interaction.reply({
                content: `Unknown group please specify a known one: ${allGroups}`,
                ephemeral: true
            });
            return;
        }

        if (!Object.values(Rarity).includes(rarityClass as Rarity)) {
            const allRarities = Object.values(Rarity).map(i => `\`${i}\``).join(', ');
            await interaction.reply({
                content: `Unknown rarity please specify a known one: ${allRarities}`,
                ephemeral: true
            });
            return;
        }

        const result = await addImageToDatabaseIfNotPresent(cardName, member, group, series, imageUrl, rarityClass, canBeDropped);
        CardCache.getInstance().reset();

        await interaction.reply({
            content: `Card \`${group}:${member} (Series: ${series})\` for rarity \`${rarityClass}\` added! (ID: \`${result}\`)`,
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            'New card uploaded',
            `CardName: ${cardName}`,
            `ImageUrl: ${imageUrl}`,
            `CardId: ${result}`,
            `Group: ${group}`,
            `Member: ${member}`,
            `Series: ${series}`,
            `Rarity Class: ${rarityClass}`,
            `Can be dropped: ${canBeDropped}`
        ]);
    }
};

export default command;
