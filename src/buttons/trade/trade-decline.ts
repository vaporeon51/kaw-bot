import { closeTradeRequest, getTradeFromId } from '../../db/trades';
import ClientManager from '../../services/ClientManager';
import type * as Discord from 'discord.js';
import { type GlobalButtonInterface } from '../../services/CommandInteractionManager';
import { getCardsByMappingIds } from '../../db/users';
import { TRADE_GLOBAL_DECLINE, generateTradeEmbed } from '../../common/tradeUtils';

const button: GlobalButtonInterface = {
    customId: TRADE_GLOBAL_DECLINE,
    isPrefix: true,
    execute: async (interaction: Discord.ButtonInteraction, prefixResult) => {
        const tradeId = prefixResult;
        const tradeDetails = await getTradeFromId(tradeId);

        if (!tradeDetails) {
            throw new Error(`Failed to resolve trade details for ${tradeId}`);
        }

        const tradeDeclineUser = interaction.user.id;

        if (tradeDetails.fromUser !== tradeDeclineUser && tradeDetails.toUser !== tradeDeclineUser) {
            await interaction.reply({
                content: 'You are neither the requestor/receiver of the trade request and cannot decline it!',
                ephemeral: true
            });
            return;
        }

        if (!interaction.replied) {
        // This process will take a while
            await interaction.deferUpdate();
        }

        const client = ClientManager.getInstance().getClient();
        const toUserDetails = await client.users.fetch(tradeDetails.toUser);
        const fromUserDetails = await client.users.fetch(tradeDetails.fromUser);

        const toUserInventory = await getCardsByMappingIds(tradeDetails.toUser, tradeDetails.toCardIds);
        const fromUserInventory = await getCardsByMappingIds(tradeDetails.fromUser, tradeDetails.fromCardIds);

        if (!toUserDetails || !fromUserDetails || toUserInventory === undefined || fromUserInventory === undefined) {
            throw new Error('Unable to get to/from user details during trade or inventory contents');
        }

        const tradeTitle = `Trade request between ${fromUserDetails.username} and ${toUserDetails.username} (Cancelled)`;

        const embed = generateTradeEmbed(
            tradeTitle,
            fromUserInventory,
            toUserInventory,
            {
                fromUserId: tradeDetails.fromUser,
                toUserId: tradeDetails.toUser,
                tradeDescriptionPrefix: `Request declined by <@${tradeDeclineUser}>`,
                showAcceptanceState: true,
                tradeAcceptanceState: {
                    fromUser: tradeDetails.fromUser === tradeDeclineUser ? false : tradeDetails.fromUserAccepted,
                    toUser: tradeDetails.toUser === tradeDeclineUser ? false : tradeDetails.toUserAccepted
                }
            }
        );

        await closeTradeRequest(tradeDetails.id, tradeDetails.fromUser);
        await interaction.message.edit({
            embeds: [embed],
            components: []
        });
    }
};
export default button;
