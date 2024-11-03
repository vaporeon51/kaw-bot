import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { SOULBOUND_ICON } from '../cardConstants';
import { createBtn, createRowWithBtns } from '../embedHelpers';
import { createCraftingRequest, doesOtherCardsExistInSeriesForRarity, doesSeriesHaveGodCard, getCraftingRequestByUserId } from '../db/crafting';
import { getCardListString } from '../common/cardDisplay';
import { parseStringToCardsIds } from '../common/optionParsing';
import { verifyUserHasCards } from '../common/sharedInventoryUtils';
import { type InventoryResult, getInventoryContentsWithId } from '../db/users';
import { Rarity, type Series } from '../config/types';
import { getInstanceConfig } from '../config/config';

export enum CraftTypes {
    Upgrade = 'UPGRADE',
    RarityReroll = 'RARITY_REROLL'
}

interface CraftAction {
    type: CraftTypes
    cardsToConsume: InventoryResult[]
    fromRarity: Rarity
    toRarity: Rarity
    toSeries: Series
    outputIsSoulbound: boolean
}

interface CardCheckResult {
    cards: InventoryResult[]
    rarity: Rarity
    series: Series
    outputIsSoulbound: boolean
}
interface CardCheckError {
    errorReason: string
}

export const CRAFT_BUTTON_ACCEPT_ID = 'craft-button-accept';
export const CRAFT_BUTTON_REJECT_ID = 'craft-button-reject';

const UPGRADE_CRAFT_NUM_OF_CARDS = 3;
const REROLL_CRAFT_NUM_OF_CARDS = 2;
const POSSIBLE_CRAFTING_CARDS = [UPGRADE_CRAFT_NUM_OF_CARDS, REROLL_CRAFT_NUM_OF_CARDS];
const MAX_CARDS_FOR_REQUEST = Math.max(...POSSIBLE_CRAFTING_CARDS);

// Performs various validations on crafting
const checkCraftContents = async (cards: InventoryResult[]): Promise<CardCheckResult | CardCheckError> => {
    if (!POSSIBLE_CRAFTING_CARDS.includes(cards.length)) {
        return {
            errorReason: `Crafting cannot be performed with ${cards.length} cards needs either (${POSSIBLE_CRAFTING_CARDS.join(', ')})`
        };
    }

    const firstSoulbound = cards[0].soulbound;
    const firstRarity = cards[0].rarityClass;
    const firstSeries = cards[0].series;
    for (let i = 1; i < cards.length; i++) {
        if (cards[i].rarityClass !== firstRarity) {
            return {
                errorReason: 'Not all cards are of the same rarity!'
            };
        }
        if (cards[i].series !== firstSeries) {
            return {
                errorReason: 'Not all cards are from the same series!'
            };
        }
        if (cards[i].soulbound !== firstSoulbound) {
            return {
                errorReason: `All cards must be either ${SOULBOUND_ICON} or non-${SOULBOUND_ICON}`
            };
        }
    }

    const haveGodCard = await doesSeriesHaveGodCard(firstSeries);

    if (!haveGodCard && cards.length === UPGRADE_CRAFT_NUM_OF_CARDS && firstRarity === Rarity.SSS) {
        return {
            errorReason: 'Upgrade crafting cannot be performed on SSS cards (of this series)'
        };
    }

    if (cards.length === UPGRADE_CRAFT_NUM_OF_CARDS && firstRarity === Rarity.GOD) {
        return {
            errorReason: 'Upgrade crafting cannot be performed on God cards'
        };
    }

    if (cards.length === UPGRADE_CRAFT_NUM_OF_CARDS && firstRarity === Rarity.DEPTH) {
        return {
            errorReason: 'Upgrade crafting cannot be performed on Admin cards'
        };
    }

    const otherCards = await doesOtherCardsExistInSeriesForRarity(firstSeries, firstRarity, Array.from(new Set(cards.map(card => card.cardId))));
    if (!otherCards) {
        return {
            errorReason: "No cards exist in the series that aren't being consumed!"
        };
    }

    return {
        rarity: firstRarity,
        series: firstSeries,
        cards,
        outputIsSoulbound: firstSoulbound
    };
};

const getCompatibleTrade = (checkResult: CardCheckResult): CraftAction => {
    if (checkResult.cards.length === REROLL_CRAFT_NUM_OF_CARDS) {
        return {
            type: CraftTypes.RarityReroll,
            cardsToConsume: checkResult.cards,
            fromRarity: checkResult.rarity,
            toRarity: checkResult.rarity,
            toSeries: checkResult.series,
            outputIsSoulbound: checkResult.outputIsSoulbound
        };
    }

    return {
        type: CraftTypes.Upgrade,
        fromRarity: checkResult.rarity,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        toRarity: getInstanceConfig().getNextRarity(checkResult.rarity)!,
        toSeries: checkResult.series,
        cardsToConsume: checkResult.cards,
        outputIsSoulbound: checkResult.outputIsSoulbound
    };
};

export const getEmbedForCraft = (
    type: CraftTypes,
    cardsToConsume: InventoryResult[],
    toRarity: Rarity,
    toSeries: Series,
    soulboundOutput: boolean,
    username: string,
    craftId: number,
    output?: string
) => {
    const embed = new Discord.EmbedBuilder();
    let descriptionLines: string[] = [];

    const cardLines = cardsToConsume.map((card) => getCardListString(card, soulboundOutput));
    if (type === CraftTypes.RarityReroll) {
        descriptionLines = [
            `**The below cards will be consumed** to receive a new card of the same rarity! ${getInstanceConfig().getIconForRarity(toRarity, toSeries)}`,
            ...cardLines
        ];

        embed.setTitle(`Crafting: Rarity Re-roll for ${username}`);
    }
    if (type === CraftTypes.Upgrade) {
        descriptionLines = [
            `**The below cards will be consumed** to receive a new card of the next rarity ${getInstanceConfig().getIconForRarity(toRarity, toSeries)}!`,
            ...cardLines
        ];

        embed.setTitle(`Crafting: Upgrade for ${username}`);
    }

    if (soulboundOutput) {
        descriptionLines.push('');
        descriptionLines.push(`Due to the input cards being ${SOULBOUND_ICON} **this crafting request will produce a ${SOULBOUND_ICON} card**`);
        descriptionLines.push('');
    }

    descriptionLines.push(`The received card will be from the series: \`${toSeries}\``);

    if (output) {
        descriptionLines.push('');
        descriptionLines.push('**Received from crafting:**');
        descriptionLines.push(output);
    }

    embed.setDescription(descriptionLines.join('\n'));
    const craftBtn = createBtn('Craft', Discord.ButtonStyle.Success, `${CRAFT_BUTTON_ACCEPT_ID}${craftId}`);
    const declineBtn = createBtn('Cancel', Discord.ButtonStyle.Danger, `${CRAFT_BUTTON_REJECT_ID}${craftId}`);
    return {
        embeds: [embed],
        components: [createRowWithBtns([craftBtn, declineBtn])]
    };
};

const command: CommandInterface = {
    name: 'craft',
    dmAllowed: false,
    isPublicCommand: true,
    options: [
        {
            name: 'card_ids',
            description: 'The cards to input into the crafting operation (comma seperated)',
            required: true,
            type: 'STRING'
        }
    ],
    description: 'Gives the ability to re-roll/craft cards using cards you already own',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cardIds = interaction.options.getString('card_ids') ?? '';

        const selectedCardIds = parseStringToCardsIds(cardIds);
        if (selectedCardIds == null) {
            await interaction.reply({
                content: 'Failed to parse given cardIds for receive/send please check and try again',
                ephemeral: true
            });
            return;
        }

        if (selectedCardIds.length > MAX_CARDS_FOR_REQUEST) {
            await interaction.reply({
                content: `Crafting requests can only specify a max of ${MAX_CARDS_FOR_REQUEST} cards! (You specified: ${selectedCardIds.length})`,
                ephemeral: true
            });
            return;
        }

        const userInventory = await getInventoryContentsWithId(interaction.user.id);

        const hasCards = verifyUserHasCards(userInventory, selectedCardIds);
        if (!hasCards.result) {
            await interaction.reply({
                content: 'You do not have all cards listed, please check and try again',
                ephemeral: true
            });
            return;
        }

        const priorRequest = await getCraftingRequestByUserId(interaction.user.id);
        if (priorRequest !== null) {
            await interaction.reply({
                content: 'A crafting request is already open please close before attempting to open an additional one',
                ephemeral: true
            });
            return;
        }

        const cardRarityResult = await checkCraftContents(hasCards.cards);
        if ('errorReason' in cardRarityResult) {
            await interaction.reply({
                content: `${cardRarityResult.errorReason}`,
                ephemeral: true
            });
            return;
        }

        const trade = getCompatibleTrade(cardRarityResult);
        const craftId = await createCraftingRequest(
            interaction.user.id,
            trade.type,
            hasCards.cards.map(card => card.id),
            trade.toRarity,
            trade.toSeries,
            trade.outputIsSoulbound
        );
        await interaction.reply(
            getEmbedForCraft(
                trade.type,
                trade.cardsToConsume,
                trade.toRarity,
                trade.toSeries,
                trade.outputIsSoulbound,
                interaction.user.username,
                craftId
            )
        );
    }
};

export default command;
