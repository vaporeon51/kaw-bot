import type * as Discord from 'discord.js';
import { type GlobalButtonInterface } from '../../services/CommandInteractionManager';
import { CRAFT_BUTTON_ACCEPT_ID, CraftTypes, getEmbedForCraft } from '../../commands/craft';
import { type CraftingRequest, closeCraftingRequest, consumeCardsForSingleCard, getCraftingRequestById } from '../../db/crafting';
import GenerateDrop from '../../services/GenerateDrop';
import { PackOpeningType, displayCard, getCardListString, showPackOpeningEmbed } from '../../common/cardDisplay';
import DbConnectionHandler from '../../services/DbConnectionHandler';
import { type CardData } from '../../db/cards';
import AuditLogHandler from '../../services/AuditLogHandler';
import { type InventoryResult, getCardsByMappingIds } from '../../db/users';
import { PostCommand, PostCommandOperations } from '../../services/PostCommandOperations';
import { codeItem } from '../../embedHelpers';

const performCraftAsTransaction = async (
    userId: string,
    btnInteraction: Discord.ButtonInteraction,
    request: CraftingRequest,
    newCard: CardData,
    cardsToConsume: InventoryResult[]
) => {
    const client = await DbConnectionHandler.getInstance().getConnection();

    if (!client) {
        throw new Error('Failed to get connection from database!');
    }

    let interactionResponses = null;
    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', { client });
        const cardInstanceId = await consumeCardsForSingleCard(
            userId,
            request.type,
            request.consumingCards,
            newCard.id,
            request.soulboundOutput,
            { client }
        );
        await closeCraftingRequest(request.id, { client });

        // Perform the discord interactions too, this way if anything goes wrong during the discord interactions we can rollback the db
        // Otherwise users get confused why the animation didn't finish
        await btnInteraction.deferReply();
        const waitFn = await showPackOpeningEmbed(btnInteraction, btnInteraction.user.username, craftTypeToPackOpeningType(request.type));

        const newEmbed = getEmbedForCraft(
            request.type,
            cardsToConsume,
            request.toRarity,
            request.toSeries,
            request.soulboundOutput,
            btnInteraction.user.username,
            request.id,
            getCardListString(newCard, request.soulboundOutput)
        );

        await waitFn();
        interactionResponses = await displayCard(btnInteraction, newCard, {
            authorDetails: {
                name: 'Received from crafting!',
                iconURL: btnInteraction.user.avatarURL() ?? undefined
            },
            soulbound: request.soulboundOutput,
            isDefer: true,
            cardInstanceId
        });
        await btnInteraction.message.edit({
            embeds: newEmbed.embeds,
            components: []
        });

        await DbConnectionHandler.getInstance().executeSQL('COMMIT', { client });
        return cardInstanceId;
    } catch (e) {
        console.error(`Failed crafting: ${e} ${(e as any).stack}`);
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', { client });
        await AuditLogHandler.getInstance().publishAuditMessage(
            'Craft transaction',
            null,
            [`Failed to execute craft transaction see logs for details ${e}`]
        );

        // Close crafting request as its probably in a broken state
        await closeCraftingRequest(request.id, { client });

        // Remove messages if it managed to send any
        if (interactionResponses) {
            for (const response of interactionResponses) {
                await response?.delete();
            }
        }
        return null;
    } finally {
        client.release();
    }
};

const craftTypeToPackOpeningType = (type: CraftTypes) => {
    switch (type) {
        case CraftTypes.Upgrade:
            return PackOpeningType.CRAFT_UPGRADE;
        case CraftTypes.RarityReroll:
            return PackOpeningType.CRAFT_REROLL;
    }
};

const button: GlobalButtonInterface = {
    customId: CRAFT_BUTTON_ACCEPT_ID,
    isPrefix: true,
    execute: async (interaction: Discord.ButtonInteraction, prefixResult) => {
        const id = prefixResult;
        const openRequest = await getCraftingRequestById(id);
        if (!openRequest) {
            await interaction.reply({
                content: 'Unable to find craft request!',
                ephemeral: true
            });
            return;
        }

        if (interaction.user.id !== openRequest.userId) {
            await interaction.reply({
                content: 'Not your crafting request to accept!',
                ephemeral: true
            });
            return;
        }

        const cardsToConsume = await getCardsByMappingIds(openRequest.userId, openRequest.consumingCards);
        const newCard = await GenerateDrop.getInstance().getCardToDrop({
            rarityInput: openRequest.toRarity,
            excludedIds: cardsToConsume.map((card) => card.cardId),
            onlyDroppableCards: false,
            series: openRequest.toSeries
        });

        await interaction.message.edit({
            components: []
        });

        const result = await performCraftAsTransaction(interaction.user.id, interaction, openRequest, newCard, cardsToConsume);
        if (result === null) {
            await interaction.followUp({
                content: 'Failed to perform crafting request closed, likely missing cards please try again (No cards were consumed)\nRe-run command to try again',
                ephemeral: true
            });
            await interaction.message.edit({
                content: `${codeItem('Error occured during card grant, try again\n')}`,
                components: []
            });
        } else {
            PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: interaction.user.id });
        }
    }
};
export default button;
