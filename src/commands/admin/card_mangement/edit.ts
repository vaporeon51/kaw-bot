import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import DbConnectionHandler from '../../../services/DbConnectionHandler';
import escape from 'pg-escape';
import AuditLogHandler from '../../../services/AuditLogHandler';
import CardCache from '../../../services/CardCache';
import { Rarity } from '../../../config/types';
import { CARDS_SECTION } from './_cards';

const editImageInDatabase = async (cardId: number, cardName: string, memberName: string, groupName: string, imageUrl: string, rarityClass: string) => {
    const sql = `UPDATE cards
    SET card_name = ${escape.literal(cardName)},
        member_name = ${escape.literal(memberName)},
        group_name = ${escape.literal(groupName)},
        image_url = ${escape.literal(imageUrl)},
        rarity_class = ${escape.literal(rarityClass)}
    WHERE id = '${cardId}'`;

    await DbConnectionHandler.getInstance().executeSQL(sql);
};

const COMMAND_NAME = 'edit';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: CARDS_SECTION,
    options: [
        {
            name: 'card_id',
            description: 'The id of the card you want to edit',
            required: true,
            type: 'NUMBER'
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
        }
    ],
    description: 'Upload new cards to the database',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardId = interaction.options.getNumber('card_id', true);
        const cardName = interaction.options.getString('card_name', true);
        const group = interaction.options.getString('group', true);
        const member = interaction.options.getString('member', true);
        const imageUrl = interaction.options.getString('image_url', true);
        const rarityClass = interaction.options.getString('rarity', true);

        if (!cardId || !cardName || !group || !member || !imageUrl || !rarityClass) {
            await interaction.reply({
                content: 'Please fill in all fields to edit a card',
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

        await editImageInDatabase(cardId, cardName, member, group, imageUrl, rarityClass);
        CardCache.getInstance().reset();
        await interaction.reply({
            content: 'Card successfully updated with new information',
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            'New card uploaded',
            `CardName: ${cardName}`,
            `ImageUrl: ${imageUrl}`,
            `CardId: ${cardId}`,
            `Group: ${group}`,
            `Member: ${member}`,
            `Rarity Class: ${rarityClass}`
        ]);
    }
};

export default command;
