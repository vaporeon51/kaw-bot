import type * as Discord from 'discord.js';
import { addCardToInventory } from '../../../db/users';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { displayCard } from '../../../common/cardDisplay';
import { COMMON_PACK_RARITY_RATES, convertSeriesAliasToStandard, getListOfValidSeriesOptions } from '../../../cardConstants';
import GenerateDrop from '../../../services/GenerateDrop';
import { PostCommand, PostCommandOperations } from '../../../services/PostCommandOperations';
import { Rarity, Series } from '../../../config/types';
import { TOOLS_SECTION } from './_tools';

const COMMAND_NAME = 'gift_roll';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    subCommandOf: TOOLS_SECTION,
    isPublicCommand: false,
    options: [
        {
            name: 'target',
            description: 'The user to receieve the gift roll',
            required: true,
            type: 'USER'
        },
        {
            name: 'soulbound',
            description: 'If the gifted card will be soulbound',
            required: true,
            type: 'BOOLEAN'
        },
        {
            name: 'series',
            description: 'The series the card should come from',
            required: false,
            type: 'STRING'
        },
        {
            name: 'rarity',
            description: 'The rarity of the card to gift',
            required: false,
            type: 'STRING'
        },
        {
            name: 'allow_non_droppable_cards',
            description: 'If cards that are not allowed to drop via /drop should be rolled',
            required: false,
            type: 'BOOLEAN'
        }
    ],
    description: 'Give a user a specific card based on ID',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const targetMember = interaction.options.getUser('target');
        const rarity = interaction.options.getString('rarity');
        const series = convertSeriesAliasToStandard(interaction.options.getString('series')) ?? undefined;
        const soulbound = interaction.options.getBoolean('soulbound') ?? false;
        const allowNonDroppableCards = interaction.options.getBoolean('allow_non_droppable_cards') ?? false;

        if (!targetMember) {
            await interaction.reply({
                content: 'Unexpected error occurred while attempting to look at users inventory',
                ephemeral: true
            });
            return;
        }

        if (rarity !== null && !Object.values(Rarity).includes(rarity as Rarity)) {
            const allRarities = Object.values(Rarity).map(i => `\`${i}\``).join(', ');
            await interaction.reply({
                content: `Unknown rarity please specify a known one: ${allRarities}`,
                ephemeral: true
            });
            return;
        }

        if (series !== null && !Object.values(Series).includes(series as Series)) {
            await interaction.reply({
                content: `Unknown series please specify a known one: ${getListOfValidSeriesOptions()}`,
                ephemeral: true
            });
            return;
        }

        const card = await GenerateDrop.getInstance().getCardToDrop({
            rarityInput: rarity as Rarity,
            series: series as Series | undefined,
            onlyDroppableCards: !allowNonDroppableCards,
            rarityRates: COMMON_PACK_RARITY_RATES
        });

        const cardInstanceId = await addCardToInventory(targetMember.id, card.id,
            {
                reason: `Gift (roll) from ${interaction.user.username}`,
                withCheckForGroupProgress: true,
                soulbound
            });
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: targetMember.id });

        await displayCard(interaction, card, {
            authorDetails: {
                name: 'They Received:',
                iconURL: targetMember.avatarURL() ?? undefined
            },
            soulbound,
            includeAtUser: true,
            includeUserOverride: targetMember.id,
            cardInstanceId
        });

        const withRarityLine = rarity ? `With rarity: ${rarity}` : '';
        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, [
            `Gifted user <@${targetMember.id}> a card via rolling card ${card.id} - ${card.memberName} (${card.groupName})`,
            withRarityLine
        ]);
    }
};

export default command;
