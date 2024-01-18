import * as Discord from 'discord.js';
import CommandInteractionManager, { type CommandInterface } from '../services/CommandInteractionManager';
import { type CardsForCurrentSeries, addCardToInventory, getProgressTowardsSeries, modifyUserLastReceivedCard } from '../db/users';
import { type CardData, getNumberOfCardInInventory } from '../db/cards';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import GenerateDrop from '../services/GenerateDrop';
import { PackOpeningType, displayCard, getCardListStringWithHidden, showPackOpeningEmbed } from '../common/cardDisplay';
import { hasCompletedGroupAfterAction } from '../common/progressUtils';
import CooldownRetriever, { Cooldowns } from '../services/CooldownRetriever';
import CooldownNotifier from '../services/CooldownNotifier';
import { insertDropLog } from '../db/dropLogging';
import { CELEBRATE_ICON, SPECIAL_DROP_PACK_RARITY_RATES } from '../cardConstants';
import { PostCommand, PostCommandOperations } from '../services/PostCommandOperations';
import { createBtn, createRowWithBtns } from '../embedHelpers';
import { CollectorHolder } from '../services/CollectorHolder';
import { safeWrapperFn } from '../common/safeCollector';
import { getInstanceConfig } from '../config/config';
import { TerminationManager } from '../services/TerminationManager';

const commandFinish = (userId: string) => {
    CommandInteractionManager.getInstance().changeLockStatus(userId, false);
    TerminationManager.getInstance().removeActiveCommand(userId);
};

interface DropData {
    numberOfCards: number
    progressBefore: CardsForCurrentSeries
    progressAfter: CardsForCurrentSeries
    cardInstanceId: number
}
const getAndSetRequiredData = async (userId: string, card: CardData): Promise<DropData> => {
    const connection = await DbConnectionHandler.getInstance().getConnection();

    if (!connection) {
        console.log('Failed to get connection from server!');
        throw new Error('Failed to get connection');
    }

    const options: ExecuteSQLOptions = { client: connection };
    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', options);
        // Make seperately to ensure the add hasn't happened yet
        const [numberOfCards, progressBefore] = await Promise.all([
            getNumberOfCardInInventory(card.id, userId, options),
            getProgressTowardsSeries(userId, card.groupName, card.series, options)
        ]);

        const [,cardInstanceId] = await Promise.all([
            modifyUserLastReceivedCard(userId, Date.now(), options),
            addCardToInventory(userId, card.id, {
                withCheckForGroupProgress: false,
                reason: 'Drop',
                soulbound: false
            }, options)
        ]);

        const progressAfter = await getProgressTowardsSeries(userId, card.groupName, card.series, options);

        // Numer of cards in inventory was null
        if (numberOfCards === null) {
            throw new Error('Numer of cards invalid');
        }

        if (progressAfter === null || progressBefore === null) {
            throw new Error('ProgressBefore/ProgressAfter in series was null');
        }

        await insertDropLog(userId, card.id, options);
        await DbConnectionHandler.getInstance().executeSQL('COMMIT', options);

        await CooldownNotifier.getInstance().resetUserNotificationTimeoutForEvent(Cooldowns.DROP, userId);
        return {
            numberOfCards,
            progressAfter,
            progressBefore,
            cardInstanceId
        };
    } catch (e) {
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', options);
        throw e;
    } finally {
        connection.release();
    }
};

const calculateProgressString = async (userId: string, card: CardData, progressBefore: CardsForCurrentSeries, progressAfter: CardsForCurrentSeries) => {
    if (await hasCompletedGroupAfterAction(progressBefore, progressAfter)) {
        return `You have now succesfully completed \`${card.series}\` for \`${card.groupName}\` ${CELEBRATE_ICON}!`;
    }

    return `\`${card.series}\` progress for \`${card.groupName}\` **${progressAfter.owned}/${progressAfter.total}**`;
};

const getNumOfCardsLine = (dropData: DropData) => {
    let numOfCardsLine = '';
    if (dropData.numberOfCards >= 1) {
        numOfCardsLine = `You already own this card! (**Total owned: ${dropData.numberOfCards + 1}**)`;
    } else {
        numOfCardsLine = 'This is your first time earning this card!';
    }
    return numOfCardsLine;
};

const performSpecialDrop = async (interaction: Discord.ChatInputCommandInteraction) => {
    // Retrieve the three cards to display
    // Can't pass in pity otherwise they could just get three SSS if sitting on the threshold
    const cards = await GenerateDrop.getInstance().generateMultipleCards({ rarityRates: SPECIAL_DROP_PACK_RARITY_RATES, numberOfCards: 3 });

    const instanceSettings = getInstanceConfig();
    const bestCard = cards.reduce((prev, curr) => {
        const currCard = instanceSettings.raritySettings[curr.rarityClass];
        const prevCard = instanceSettings.raritySettings[prev.rarityClass];
        if (currCard.index < prevCard.index) {
            return curr;
        }
        return prev;
    });

    const colorFnOrString = instanceSettings.raritySettings[bestCard.rarityClass].color;
    const color = colorFnOrString instanceof Function ? colorFnOrString(bestCard.series) : colorFnOrString;

    const embed = new Discord.EmbedBuilder();
    embed.setDescription('You can pick from one of the following cards:');
    embed.setColor(color as Discord.ColorResolvable);
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Special Drop!'
    });
    embed.setThumbnail(bestCard.staticUrl);
    embed.setFooter({
        text: 'You only have 60 seconds to pick!'
    });

    const idxToEmoji = new Map([
        [0, '1️⃣'],
        [1, '2️⃣'],
        [2, '3️⃣']
    ]);

    const btns: Discord.ButtonBuilder[] = [];
    embed.setFields(cards.map((card, idx) => {
        const emoji = idxToEmoji.get(idx);
        if (emoji === undefined) throw new Error('Unexpected');
        btns.push(createBtn(emoji, Discord.ButtonStyle.Secondary, `drop_${idx}`));
        return {
            name: `Card ${emoji}`,
            value: `${getCardListStringWithHidden(card, false)}`
        };
    }));

    const embedResponse = await interaction.editReply({
        embeds: [embed],
        components: [createRowWithBtns(btns)]
    });

    const collector = embedResponse.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 60000 });
    const collectorId = CollectorHolder.getInstance().addCollector(collector);

    let isDropProcessing = false;
    const displayAndFinish = async (card: CardData, embedAction: Discord.Interaction, stopCollector = true) => {
        isDropProcessing = true;
        const waitFn = await showPackOpeningEmbed(embedAction, interaction.user.username, PackOpeningType.NORMAL, false);
        const dropData = await getAndSetRequiredData(interaction.user.id, card);
        await waitFn();
        await displayCard(interaction, card, {
            authorDetails: {
                name: 'You Received:',
                iconURL: interaction.user.avatarURL() ?? undefined
            },
            extraDescriptionLines: [
                await calculateProgressString(interaction.user.id, card, dropData.progressBefore, dropData.progressAfter),
                `${getNumOfCardsLine(dropData)}`,
                '',
                'This card was received via a special drop!'
            ],
            isDefer: true,
            cardInstanceId: dropData.cardInstanceId
        });
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: interaction.user.id });
        collector.stop('drop_obtained');
    };

    const onBtnClick = async (btnInteraction: Discord.ButtonInteraction) => {
        if (btnInteraction.user.id !== interaction.user.id) {
            await btnInteraction.reply({
                content: 'You cannot select a card for someone else!',
                ephemeral: true
            });
            return;
        };

        const selectedCard = btnInteraction.customId.split('_')[1];
        if (selectedCard !== '0' && selectedCard !== '1' && selectedCard !== '2') {
            await btnInteraction.reply({
                content: 'Invalid card selection!',
                ephemeral: true
            });
        };

        if (isDropProcessing) {
            await btnInteraction.reply({
                content: 'You cannot select more than one card...',
                ephemeral: true
            });
            return;
        }
        isDropProcessing = true;

        // Do all the normal drop animation and granting stuff
        const card = cards[parseInt(selectedCard)];
        await displayAndFinish(card, btnInteraction);
    };

    const onCollectorClose = async (_: Discord.Collection<string, Discord.ButtonInteraction>, reason: string) => {
        CollectorHolder.getInstance().removeCollector(collectorId);
        if (reason === 'time') {
            await displayAndFinish(bestCard, interaction, false);
        } else if (reason !== 'drop_obtained') {
            await interaction.editReply({
                content: 'Bot is shutting down, please try again later!',
                embeds: [],
                components: []
            });
        }
        commandFinish(interaction.user.id);
    };

    collector.on('collect', safeWrapperFn('onBtnClick', onBtnClick));
    collector.on('end', safeWrapperFn('onCollectorClose', onCollectorClose));
};

const dropFn = async (interaction: Discord.ChatInputCommandInteraction) => {
    const cooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.DROP);
    await interaction.deferReply({
        ephemeral: !cooldownInfo.elapsed
    });

    const CHANCE = 10;
    const rollSpecialDrop = GenerateDrop.getInstance().generateNumberInRange(1, 100);

    if (cooldownInfo.elapsed) {
        if (rollSpecialDrop <= CHANCE) {
            await performSpecialDrop(interaction);
            return;
        }

        const waitFn = await showPackOpeningEmbed(interaction, interaction.user.username, PackOpeningType.NORMAL);
        const card = await GenerateDrop.getInstance().getCardToDrop({ pityInformation: { userId: interaction.user.id } });
        const dropData = await getAndSetRequiredData(interaction.user.id, card);
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: interaction.user.id });

        await waitFn();
        await displayCard(interaction, card, {
            authorDetails: {
                name: 'You Received:',
                iconURL: interaction.user.avatarURL() ?? undefined
            },
            extraDescriptionLines: [
                await calculateProgressString(interaction.user.id, card, dropData.progressBefore, dropData.progressAfter),
                `${getNumOfCardsLine(dropData)}`
            ],
            isDefer: true,
            cardInstanceId: dropData.cardInstanceId
        });
        commandFinish(interaction.user.id);
        return;
    }

    if (cooldownInfo.timeLeft) {
        // hasn't been 24 hours since last card
        await interaction.followUp({
            content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.DROP, cooldownInfo),
            ephemeral: true
        });
        commandFinish(interaction.user.id);
    }
};

const command: CommandInterface = {
    name: 'drop',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Receive a card',
    finishAfterExecute: false,
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        // Need to do this so a user doesn't get stuck locked if an error occurs
        try {
            await dropFn(interaction);
        } catch (e) {
            CommandInteractionManager.getInstance().changeLockStatus(interaction.user.id, false);
            throw e;
        }
    }
};

export default command;
