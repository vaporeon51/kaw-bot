import * as Discord from 'discord.js';
import { type InventoryResult, getInventoryContentsWithId } from '../db/users';
import { type CommandInterface } from '../services/CommandInteractionManager';
import ClientManager from '../services/ClientManager';
import { BotSettingKey, getBotSetting } from '../db/botSettings';
import { createBtn, createRowWithBtns } from '../embedHelpers';
import { parseStringToCardsIds } from '../common/optionParsing';
import { generateTradeEmbed, getGlobalControlsRow } from '../common/tradeUtils';
import { getPendingTradesFromUser, insertTradeRequest } from '../db/trades';
import { verifyUserHasCards } from '../common/sharedInventoryUtils';
import { safeWrapperFn } from '../common/safeCollector';
import { CollectorHolder } from '../services/CollectorHolder';

const SEND_TRADE_REQUEST = 'send-trade-request';
const CANCEL_TRADE_REQUEST = 'cancel-trade-request';

const sendTradeRequest = async (
    fromUserId: string,
    fromCards: InventoryResult[],
    selectedFromCards: number[],
    toUserId: string,
    toCards: InventoryResult[],
    selectedToCards: number[]
) => {
    const client = ClientManager.getInstance().getClient();

    const tradeChannelId = await getBotSetting(BotSettingKey.TRADE_CHANNEL_DATA_KEY);
    if (tradeChannelId === null) {
        throw new Error('Failed to send trade request, tradeChannelId is null!');
    }

    const tradeChannel = client.channels.cache.get(tradeChannelId);
    if (!tradeChannel) {
        throw new Error('Failed to find trade channel, trade request failed!');
    }

    // Send request to trade channel and save trade data to the DB
    const id = await insertTradeRequest(fromUserId, toUserId, selectedFromCards, selectedToCards);
    if (!id) {
        throw new Error('Failed to store trade into database!');
    }

    // Send to the channel the trade request
    if (tradeChannel.isTextBased()) {
        const fromUserDetails = await client.users.fetch(fromUserId);
        const toUserDetails = await client.users.fetch(toUserId);

        const tradeTitle = `Trade request between ${fromUserDetails?.username} and ${toUserDetails?.username}`;

        const tradePrefix = `Trade requested by ${fromUserDetails} to trade below contents with ${toUserDetails}`;

        const tradeWindow = generateTradeEmbed(
            tradeTitle,
            fromCards,
            toCards,
            {
                tradeDescriptionPrefix: tradePrefix,
                toUserId,
                fromUserId,
                showAcceptanceState: true,
                tradeAcceptanceState: {
                    fromUser: true,
                    toUser: false
                }
            }
        );
        await tradeChannel.send({
            embeds: [tradeWindow],
            components: [getGlobalControlsRow(id)]
        });
    } else {
        throw new Error('Tried to send a message to a non-text based channel!');
    }
};

const command: CommandInterface = {
    name: 'trade',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Send a trade request to a user',
    options: [
        {
            name: 'target',
            required: true,
            type: 'USER',
            description: 'The user to send a trade request to'
        },
        {
            name: 'to_receive',
            required: false,
            type: 'STRING',
            description: 'Comma seperated list of card ids you want to receive from the trade'
        },
        {
            name: 'to_send',
            required: false,
            type: 'STRING',
            description: 'Comma seperated list of card ids you want to send as part of the trade'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const target = interaction.options.getUser('target');
        const toReceive = interaction.options.getString('to_receive') ?? '';
        const toSend = interaction.options.getString('to_send') ?? '';

        if (toReceive === '' && toSend === '') {
            await interaction.reply({
                content: 'Trade must have something gained on either side, request sent was empty for both',
                ephemeral: true
            });
            return;
        }

        const selectedFromCards = parseStringToCardsIds(toSend);
        const selectedToCards = parseStringToCardsIds(toReceive);
        if (selectedFromCards === null || selectedToCards === null) {
            await interaction.reply({
                content: 'Failed to parse given cardIds for receive/send please check and try again',
                ephemeral: true
            });
            return;
        }

        if (selectedFromCards.length === 0 || selectedToCards.length === 0) {
            await interaction.reply({
                content: 'Both sides of a trade must offer a card for it to be valid',
                ephemeral: true
            });
            return;
        }

        if (!target) {
            await interaction.reply({
                content: 'target not supplied, cannot create trade request',
                ephemeral: true
            });
            return;
        }

        if (target.id === interaction.user.id) {
            await interaction.reply({
                content: 'You cannot start a trade with yourself',
                ephemeral: true
            });
            return;
        }

        const fromUserInventory = await getInventoryContentsWithId(interaction.user.id);
        const toUserInventory = await getInventoryContentsWithId(target.id);

        const fromUserHasCards = verifyUserHasCards(fromUserInventory, selectedFromCards);
        if (!fromUserHasCards.result) {
            await interaction.reply({
                content: 'You do not have all cards listed in toSend, please check and try again',
                ephemeral: true
            });
            return;
        }

        const toUserHasCards = verifyUserHasCards(toUserInventory, selectedToCards);
        if (!toUserHasCards.result) {
            await interaction.reply({
                content: 'The target does not have all cards listed in toReceive, please check and try again',
                ephemeral: true
            });
            return;
        }

        const pendingTrades = await getPendingTradesFromUser(interaction.user.id);
        if (pendingTrades.length > 0) {
            await interaction.reply({
                content: 'You can only have one open trade at a time, please decline your trade or get the recepient to accept it',
                ephemeral: true
            });
            return;
        }

        const addCardBtn = createBtn('Send request', Discord.ButtonStyle.Success, SEND_TRADE_REQUEST);
        const cancelBtn = createBtn('Cancel request', Discord.ButtonStyle.Danger, CANCEL_TRADE_REQUEST);

        const controlsRow = createRowWithBtns([addCardBtn, cancelBtn]);
        const tradeEmbed = generateTradeEmbed(
            `Open request to ${target.username}`,
            fromUserHasCards.cards,
            toUserHasCards.cards
        );

        const tradeRequest = await interaction.reply({
            embeds: [tradeEmbed],
            components: [controlsRow],
            ephemeral: true
        });

        const collector = tradeRequest.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 600_000 });

        let shouldEditTradeMessageOnClose = true;
        const onTradeButtonPressed = async (buttonInteract: Discord.ButtonInteraction) => {
            if (buttonInteract.user.id === interaction.user.id) {
                if (buttonInteract.customId === CANCEL_TRADE_REQUEST) {
                    await tradeRequest.edit({
                        content: '`Trade request cancelled.`',
                        embeds: [],
                        components: []
                    });
                    shouldEditTradeMessageOnClose = false;
                    collector.stop();
                }
                if (buttonInteract.customId === SEND_TRADE_REQUEST) {
                    const pendingTrades = await getPendingTradesFromUser(interaction.user.id);
                    if (pendingTrades.length > 0) {
                        await buttonInteract.reply({
                            content: 'You can only have one open trade at a time, please decline your trade or get the recepient to accept it',
                            ephemeral: true
                        });
                        await tradeRequest.delete();
                        return;
                    }

                    await sendTradeRequest(
                        interaction.user.id,
                        fromUserHasCards.cards,
                        fromUserHasCards.cards.map((card) => card.id),
                        target.id,
                        toUserHasCards.cards,
                        toUserHasCards.cards.map((card) => card.id)
                    );
                    const tradeChannelId = await getBotSetting(BotSettingKey.TRADE_CHANNEL_DATA_KEY);
                    if (!tradeChannelId) {
                        throw new Error('Unable to get trade channel id to send message');
                    }

                    await tradeRequest.edit({
                        content: `Trade request send please see <#${tradeChannelId}>`,
                        embeds: [],
                        components: []
                    });
                    shouldEditTradeMessageOnClose = false;
                    collector.stop();
                }
            }
        };

        const collectorId = CollectorHolder.getInstance().addCollector(collector);
        collector.on('collect', safeWrapperFn('tradeCreateCollector', onTradeButtonPressed));
        collector.on('end', safeWrapperFn('tradeCreateCollectorClose', async (_, reason) => {
            CollectorHolder.getInstance().removeCollector(collectorId);
            if (shouldEditTradeMessageOnClose) {
                await tradeRequest.edit({
                    content: `Trade request closed due to: ${reason}`,
                    embeds: [],
                    components: []
                });
            }
        }));
    }
};

export default command;
