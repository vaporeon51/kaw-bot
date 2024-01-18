import { closeTradeRequest, exchangeCardsBasedOnTrade, getTradeFromId, updateAcceptanceOfSideOfTrade } from '../../db/trades';
import ClientManager from '../../services/ClientManager';
import type * as Discord from 'discord.js';
import { type GlobalButtonInterface } from '../../services/CommandInteractionManager';
import { getCardsByMappingIds } from '../../db/users';
import { TRADE_GLOBAL_ACCEPT, generateTradeEmbed, getGlobalControlsRow } from '../../common/tradeUtils';
import { PostCommand, PostCommandOperations } from '../../services/PostCommandOperations';

const button: GlobalButtonInterface = {
    customId: TRADE_GLOBAL_ACCEPT,
    isPrefix: true,
    execute: async (interaction: Discord.ButtonInteraction, prefixResult) => {
        const tradeId = prefixResult;
        let tradeDetails = await getTradeFromId(tradeId);

        if (!tradeDetails) {
            throw new Error(`Failed to resolve trade details for ${tradeId}`);
        }

        const tradeAcceptor = interaction.user.id;

        if (tradeDetails.fromUser !== tradeAcceptor && tradeDetails.toUser !== tradeAcceptor) {
            await interaction.reply({
                content: 'You are neither the requestor/receiver of the trade request and cannot accept it!',
                ephemeral: true
            });
            return;
        }

        if (!interaction.replied) {
            // This process will take a while
            await interaction.deferUpdate();
        }

        const sideOfTrade = tradeDetails.fromUser === tradeAcceptor ? 'from_user_accepted' : 'to_user_accepted';
        await updateAcceptanceOfSideOfTrade(tradeId, sideOfTrade);

        tradeDetails = await getTradeFromId(tradeId);
        if (!tradeDetails) {
            throw new Error('Unable to retrieve updated trade details');
        }

        const client = ClientManager.getInstance().getClient();
        const toUserDetails = await client.users.fetch(tradeDetails.toUser);
        const fromUserDetails = await client.users.fetch(tradeDetails.fromUser);

        const toUserInventory = await getCardsByMappingIds(tradeDetails.toUser, tradeDetails.toCardIds);
        const fromUserInventory = await getCardsByMappingIds(tradeDetails.fromUser, tradeDetails.fromCardIds);

        if (!toUserDetails || !fromUserDetails || toUserInventory === undefined || fromUserInventory === undefined) {
            throw new Error('Unable to get to/from user details during trade or inventory contents');
        }

        let tradeTitle = `Trade request between ${fromUserDetails.username} and ${toUserDetails.username}`;
        let tradePrefix = `Trade requested by ${fromUserDetails} to trade below contents with ${toUserDetails}`;

        let isTradeFinished = false;
        if (tradeDetails.fromUserAccepted && tradeDetails.toUserAccepted) {
            // Perform the card exchange :)
            const result = await exchangeCardsBasedOnTrade(tradeDetails);
            isTradeFinished = true;
            await closeTradeRequest(tradeDetails.id, tradeDetails.fromUser);
            if (!result.success) {
                tradeTitle += ' (Cancelled)';
                tradePrefix += `\n\nTrade cancelled due to: ${result.error}`;
            }

            PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: tradeDetails.toUser });
            PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: tradeDetails.fromUser });
        }

        const embed = generateTradeEmbed(
            tradeTitle,
            fromUserInventory,
            toUserInventory,
            {
                fromUserId: tradeDetails.fromUser,
                toUserId: tradeDetails.toUser,
                tradeDescriptionPrefix: tradePrefix,
                showAcceptanceState: true,
                tradeAcceptanceState: {
                    fromUser: tradeDetails.fromUserAccepted,
                    toUser: tradeDetails.toUserAccepted
                }
            }
        );

        await interaction.message.edit({
            embeds: [embed],
            components: isTradeFinished ? [] : [getGlobalControlsRow(tradeDetails.id)]
        });
    }
};
export default button;
