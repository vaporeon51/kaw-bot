import { SOULBOUND_ICON, getPrimaryAliasForSeries, CELEBRATE_ICON } from '../cardConstants';
import { type CardData, getIssueAndOtherOwnersForCardInstance, getCardCreationReasonAndUser } from '../db/cards';
import * as Discord from 'discord.js';
import { type InventoryResult } from '../db/users';
import { sleep } from '../utils';
import { codeItem } from '../embedHelpers';
import { getInstanceConfig } from '../config/config';
import { type Series } from '../config/types';

const getActualCardId = (card: CardData | InventoryResult) => {
    const cardId = 'cardId' in card ? card.cardId : card.id;
    return cardId;
};

/**
 * Takes into account if the card is hidden and shows a special string if it is
 */
export const getCardListStringWithHidden = (card: CardData, isSoulbound?: boolean) => {
    const instanceConfig = getInstanceConfig();
    if (card.hidden) {
        return `${instanceConfig.getIconForRarity(card.rarityClass, card.series as Series)} (${codeItem('HIDDEN')}, ${codeItem(getPrimaryAliasForSeries(card.series as Series))})`;
    }
    return getCardListString(card, isSoulbound);
};

/**
 * Provides a string to be used when listing a card in an embed such as inventory/lottery etc
 */
export const getCardListString = (card: CardData | InventoryResult, isSoulbound?: boolean) => {
    const instanceConfig = getInstanceConfig();
    const imageLink = `[${card.groupName} - ${card.memberName}](${card.imageUrl})`;

    const soulbound = ('soulbound' in card && card.soulbound) || isSoulbound;
    const soulboundFlag = soulbound ? `, ${SOULBOUND_ICON}` : '';

    const cardId = getActualCardId(card);
    const modifiedCardid = codeItem(soulbound ? `${cardId}SB` : cardId);
    const aliasSeries = codeItem(getPrimaryAliasForSeries(card.series as Series));
    return `${instanceConfig.getIconForRarity(card.rarityClass, card.series as Series)} (${modifiedCardid}, ${aliasSeries}${soulboundFlag}) ${imageLink}`;
};

const createBaseEmbed = async (userId: string, card: CardData | InventoryResult, options: DisplayOptions = {}) => {
    const instanceConfig = getInstanceConfig();
    const soulboundIcon = options.soulbound ? `, ${SOULBOUND_ICON} ` : '';
    const title = `${instanceConfig.getIconForRarity(card.rarityClass, card.series)} ${card.groupName} - ${card.memberName}`;

    const additionalInfo = options.cardInstanceId ? await getIssueAndOtherOwnersForCardInstance(userId, options.cardInstanceId) : null;
    const createdInfo = await getCardCreationReasonAndUser(getActualCardId(card));

    const descriptionLines = [
        `**${title}**`,
        `${codeItem(getActualCardId(card))}, ${codeItem(card.series)}${soulboundIcon}`,
        ''
    ];

    if (additionalInfo !== null) {
        // FIXME: Re-add when there is a move to instance ID's
        // descriptionLines.push(`Issue: ${codeItem(`${additionalInfo.issue}`)} out of ${codeItem(additionalInfo.totalInstances)}`);
        if (additionalInfo.numOfOtherOwners > 0) {
            descriptionLines.push(`${codeItem(additionalInfo.numOfOtherOwners)} other user(s) own this card`);
        } else {
            descriptionLines.push(`You are the only owner of this card! ${CELEBRATE_ICON}`);
        }
        descriptionLines.push('');
    }

    if (createdInfo !== null) {
        descriptionLines.push('Created for and awarded to ');
        descriptionLines.push(`<@${createdInfo.createdFor}>`);
        descriptionLines.push(`for ${createdInfo.createdReason}`);
        descriptionLines.push('');
    }

    descriptionLines.push(...(options.extraDescriptionLines ?? []));

    if (options.includeAtUser) {
        const userMention = options.includeUserOverride ?? userId;
        descriptionLines.push(`<@${userMention}>`);
    }

    const colorFnOrString = instanceConfig.raritySettings[card.rarityClass].color;
    const color = colorFnOrString instanceof Function ? colorFnOrString(card.series as Series) : colorFnOrString;

    const textEmbed = new Discord.EmbedBuilder()
        .setDescription(descriptionLines.join('\n'))
        .setColor(color as Discord.HexColorString)
        .setAuthor(options.authorDetails ?? null);

    return textEmbed;
};

const displayImageCard = async (interaction: Discord.RepliableInteraction, card: CardData | InventoryResult, options: DisplayOptions) => {
    const userId = options.includeUserOverride ?? interaction.user.id;
    const textEmbed = await createBaseEmbed(userId, card, options);
    textEmbed.setImage(card.imageUrl);

    const content = {
        embeds: [textEmbed],
        components: []
    };

    let response;
    if (options.isDefer) {
        response = await interaction.editReply(content);
    } else if (interaction.isButton()) {
        response = await interaction.update(content);
    } else if (interaction.replied) {
        response = await interaction.followUp(content);
    } else {
        response = await interaction.reply(content);
    }
    return [response];
};

const displayVideoCard = async (interaction: Discord.RepliableInteraction, card: CardData | InventoryResult, options: DisplayOptions) => {
    const includeAtUser = options.includeAtUser ?? true;
    const userId = options.includeUserOverride ?? interaction.user.id;
    const smallEmbed = await createBaseEmbed(userId, card, { ...options, includeAtUser });

    const replyContent = { content: card.imageUrl, embeds: [], components: [] };
    let response;
    if (options.isDefer) {
        response = await interaction.editReply(replyContent);
    } else if (interaction.isButton()) {
        response = await interaction.update(replyContent);
    } else if (interaction.replied) {
        response = await interaction.followUp(replyContent);
    } else {
        response = await interaction.reply(replyContent);
    }

    const channelMsgResponse = await interaction.channel?.send({
        embeds: [smallEmbed],
        components: []
    });

    return [channelMsgResponse, response];
};

export interface DisplayOptions {
    includeUserOverride?: string
    includeAtUser?: boolean
    authorDetails?: Discord.EmbedAuthorOptions
    extraDescriptionLines?: string[]
    soulbound?: boolean
    isDefer?: boolean
    cardInstanceId?: number | null
};
export const displayCard = async (interaction: Discord.Interaction, card: CardData | InventoryResult, options: DisplayOptions = {}) => {
    if (!interaction.isRepliable()) {
        return;
    }

    if (card.imageUrl.endsWith('.mp4')) {
        return await displayVideoCard(interaction, card, options);
    }
    return await displayImageCard(interaction, card, options);
};

export enum PackOpeningType {
    NORMAL = 'NORMAL',
    CRAFT_REROLL = 'CRAFT_REROLL',
    CRAFT_UPGRADE = 'CRAFT_UPGRADE'
}

const getGifForPackType = (type: PackOpeningType) => {
    switch (type) {
        case PackOpeningType.NORMAL:
            return { url: 'https://i.imgur.com/25UtGXX.gif', duration: 3_200 };
        case PackOpeningType.CRAFT_REROLL:
            return { url: 'https://i.imgur.com/mYtYg7y.gif', duration: 4_700 };
        case PackOpeningType.CRAFT_UPGRADE:
            return { url: 'https://i.imgur.com/RZqEKKp.gif', duration: 3_100 };
    }
};

const getTextBasedOnType = (type: PackOpeningType, username: string) => {
    switch (type) {
        case PackOpeningType.NORMAL:
            return { title: `${username} is opening a card!`, description: 'Lets see what they get!' };
        case PackOpeningType.CRAFT_REROLL:
            return { title: `${username} is re-rolling a card!`, description: 'Lets see what they get!' };
        case PackOpeningType.CRAFT_UPGRADE:
            return { title: `${username} is upgrading a card!`, description: 'Lets see what they get!' };
    }
};

export const showPackOpeningEmbed = async (interaction: Discord.Interaction, username: string, type: PackOpeningType, isDefer = true) => {
    if (!interaction.isRepliable()) {
        // no op function to make TS happy
        return async () => { };
    }

    const text = getTextBasedOnType(type, username);
    const gif = getGifForPackType(type);

    const content = {
        embeds: [
            new Discord.EmbedBuilder()
                .setTitle(text.title)
                .setDescription(text.description)
                .setImage(gif.url)
        ],
        components: []
    };

    if (isDefer) {
        await interaction.editReply(content);
    } else if (interaction.isButton()) {
        await interaction.update(content);
    }

    const startTime = Date.now();
    return async () => {
        const now = Date.now();
        const elapsed = now - startTime;
        const timeToWait = elapsed < gif.duration ? gif.duration - elapsed : null;
        await sleep(timeToWait);
    };
};
