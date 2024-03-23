import * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';

import { getProfileInfo } from '../../db/profile';
import { codeItem } from '../../embedHelpers';
import { COIN_ICON } from '../../cardConstants';
import { getCardListString } from '../../common/cardDisplay';
import { getInstanceConfig } from '../../config/config';
import { Series, Rarity, type AchievementConfig } from '../../config/types';
import { parseStringToCardsIds } from '../../common/optionParsing';
import CardCache from '../../services/CardCache';

const achievementConfigs: AchievementConfig[] = [
    { name: 'Card Collector', icon: '<:CardCollector:1198245592183349299>', threshold: 4 },
    { name: 'Card Disciple', icon: '<:CardDisciple:1198245699565928568>', threshold: 8 },
    { name: 'Card Practitioner', icon: '<:CardPractitioner:1198245822228336701>', threshold: 12 },
    { name: 'Card Master', icon: '<:CardMaster:1198246438442893422>', threshold: 16 },
    { name: 'Card Grandmaster', icon: '<:CardGrandmaster:1198246587835633704>', threshold: 20 },
    { name: 'Card Spirit', icon: '<:CardSpirit:1198246728911032412>', threshold: 24 },
    { name: 'Card King', icon: '<:CardKing:1198246805419331616>', threshold: 28 },
    { name: 'Card Emperor', icon: '<:CardEmperor:1198246978753151116>', threshold: 32 },
    { name: 'Card Ancestor', icon: '<:CardAncestor:1198247075339587594>', threshold: 36 },
    { name: 'Card Venerate', icon: '<:CardVenerate:1198247227768971384>', threshold: 40 },
    { name: 'Card Saint', icon: '<:CardSaint:1198247543709110322>', threshold: 44 },
    { name: 'Card God', icon: '<:CardGod:1198247624189431859>', threshold: 48 }
];

function getAchievementText (count: number): string {
    let closestName: string | null = null;
    let closestIcon: string | null = null;
    let closestThreshold = 0;

    for (const achievementConfig of achievementConfigs) {
        if (achievementConfig.threshold <= count && achievementConfig.threshold > closestThreshold) {
            closestName = achievementConfig.name;
            closestIcon = achievementConfig.icon;
            closestThreshold = achievementConfig.threshold;
        }
    }

    if (closestThreshold === 0) {
        return 'No achievements yet';
    }

    return `${closestIcon} [${closestName}] ${count} set(s) completed`;
}

const command: CommandInterface = {
    groupName: 'profile',
    name: 'view',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Commands around profile(s)',
    options: [
        {
            name: 'target',
            required: false,
            description: 'The persons profile to view',
            type: 'USER'
        },
        {
            name: 'public',
            required: false,
            description: 'Send the message in the current channel not just to you',
            type: 'BOOLEAN'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const user = interaction.options.getUser('target') ?? interaction.user;
        const isPublicMessage = interaction.options.getBoolean('public') ?? false;

        const profileData = await getProfileInfo(user.id);

        const descriptionLines = [];

        descriptionLines.push('**Bio:**');
        descriptionLines.push(`> ${profileData.bio}`);
        descriptionLines.push('');

        descriptionLines.push('**Achievements:**');
        descriptionLines.push(`> ${getAchievementText(profileData.numCompletedGroups)}`);
        descriptionLines.push('');

        descriptionLines.push('**Balance:**');
        descriptionLines.push(`> ${COIN_ICON} ${codeItem(profileData.balance.toLocaleString())}`);
        descriptionLines.push('');

        descriptionLines.push('**Cards:**');

        const cardsDescriptionLine = [];
        const getIconForRarity = getInstanceConfig().getIconForRarity;
        const rarityOrder = [Rarity.GOD, Rarity.SSS, Rarity.SS, Rarity.S, Rarity.A, Rarity.B, Rarity.C, Rarity.D];
        for (const rarity of rarityOrder) {
            const icon = getIconForRarity(rarity as Rarity, Series.SERIES_1);
            const amount = profileData.totalsByRarity.totalByRarity[rarity as Rarity];
            cardsDescriptionLine.push(`${icon} ${amount}`);
        }

        descriptionLines.push(`> Total: ${codeItem(profileData.totalsByRarity.overallTotal)} \n> ${cardsDescriptionLine.join(', ')}`);
        descriptionLines.push('');

        let favCard = '> None set. Use **/set_favorite**';
        let thumbnail: string | null = null;
        if (profileData.favoriteCard !== null && !profileData.favoriteCardOwnership.owned) {
            favCard = '> No longer owns their favorite card!';
        } else if (profileData.favoriteCard !== null && profileData.favoriteCardOwnership.owned) {
            favCard = `> ${getCardListString(profileData.favoriteCard, profileData.favoriteCardOwnership.soulbound)}`;
            thumbnail = profileData.favoriteCard.staticUrl ?? null;
        }

        let lookingForCards = '> None set. Use **/set_looking_for**';
        if (profileData.lookingForCards.length > 0) {
            const resolvedLookingForCards = profileData.lookingForCards.map(async (card) => {
                const parsedId = parseStringToCardsIds(card)?.[0];
                if (parsedId === undefined) {
                    throw new Error(`Unable to parse card id ${card}`);
                }
                const cardDetails = await CardCache.getInstance().getCardDetails(parsedId.id);
                return `> ${getCardListString(cardDetails, parsedId.soulbound)}`;
            });
            const lookingForCardsItems = await Promise.all(resolvedLookingForCards);
            lookingForCards = `${lookingForCardsItems.join('\n ')}`;
        }
        descriptionLines.push('**Looking for:**');
        descriptionLines.push(lookingForCards);
        descriptionLines.push('');

        descriptionLines.push('**Favorite Card:**');
        descriptionLines.push(favCard);
        descriptionLines.push('');

        const embed = new Discord.EmbedBuilder()
            .setAuthor({
                name: `Profile - ${user.username}`,
                iconURL: user.avatarURL() ?? undefined
            })
            .setThumbnail(thumbnail)
            .setDescription(descriptionLines.join('\n'));

        await interaction.reply({
            ephemeral: !isPublicMessage,
            embeds: [embed]
        });
    }
};

export default command;
