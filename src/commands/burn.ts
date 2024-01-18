import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { getInventoryContents, modifyUserLastBurnedCard, removeCardFromInventory } from '../db/users';
import { verifyUserHasCards } from '../common/sharedInventoryUtils';
import CardCache from '../services/CardCache';
import { COIN_ICON, SOULBOUND_ICON } from '../cardConstants';
import { getCardListString } from '../common/cardDisplay';
import { createBtn, createRowWithBtns } from '../embedHelpers';
import DbConnectionHandler from '../services/DbConnectionHandler';
import AuditLogHandler from '../services/AuditLogHandler';
import { safeWrapperFn } from '../common/safeCollector';
import CooldownRetriever, { Cooldowns } from '../services/CooldownRetriever';
import CooldownNotifier from '../services/CooldownNotifier';
import { PostCommand, PostCommandOperations } from '../services/PostCommandOperations';
import { CurrencyManager, CurrencyResult } from '../services/currency/Currency';
import { getInstanceConfig } from '../config/config';

const ACCEPT_BURN_BTN = 'ACCEPT_BURN_BTN';
const DECLINE_BURN_BTN = 'DECLINE_BURN_BTN';

async function burnCardAndAwardMoney (userId: string, cardId: number, burnValue: number) {
    const client = await DbConnectionHandler.getInstance().getConnection();

    if (!client) {
        throw new Error('Unable to obtain connection for burning card');
    }

    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', { client });
        await removeCardFromInventory(userId, cardId, 1, { client });
        await modifyUserLastBurnedCard(userId, Date.now(), { client });
        const isFailure = await CurrencyManager.getInstance().deposit(userId, burnValue, `Awarded for burning card ${cardId}`);
        console.log(isFailure);
        if (isFailure === CurrencyResult.ERROR) {
            throw new Error('Unable to award coins, forcing rollback');
        }

        await DbConnectionHandler.getInstance().executeSQL('COMMIT', { client });
        await CooldownNotifier.getInstance().resetUserNotificationTimeoutForEvent(Cooldowns.BURN, userId);
    } catch (e) {
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', { client });
        await AuditLogHandler.getInstance().publishAuditMessageError('Issue with burning card',
            [
                `User <@${userId}> attempted to burn card ${cardId} with a DB error occuring during it`
            ]);
        return CurrencyResult.ERROR;
    } finally {
        client?.release();
    }
}

const command: CommandInterface = {
    name: 'burn',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Destroy a card in exchange for coins!',
    options: [
        {
            name: 'card_id',
            description: "The card to 'burn' in exchange for coins",
            required: true,
            type: 'NUMBER'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const userId = interaction.user.id;

        const cardId = interaction.options.getNumber('card_id');
        if (!cardId) {
            await interaction.reply({
                content: 'card_id is required to be supplied for burn command',
                ephemeral: true
            });
            return;
        }

        const userInventory = await getInventoryContents(userId);

        const hasCardResult = verifyUserHasCards(userInventory, [{ id: cardId, soulbound: false }]);
        if (!hasCardResult.result) {
            await interaction.reply({
                content: `You do not have card \`${cardId}\` to burn (or its ${SOULBOUND_ICON})`,
                ephemeral: true
            });
            return;
        }

        const cardDetails = await CardCache.getInstance().getCardDetails(cardId);
        if (!cardDetails) {
            await interaction.reply({
                content: 'Unable to retrieve details about card, please try again',
                ephemeral: true
            });
            return;
        }

        const cooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.BURN);
        if (!cooldownInfo.elapsed) {
            await interaction.reply({
                content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.BURN, cooldownInfo),
                ephemeral: true
            });
            return;
        }

        const raritySettings = getInstanceConfig().raritySettings;
        const burnValue = raritySettings[cardDetails.rarityClass].burnValue;
        const descriptionLines = [
            `The following card will be **consumed** in exchange for ${burnValue.toLocaleString()} ${COIN_ICON}`,
            getCardListString(cardDetails)
        ];
        const embed = new Discord.EmbedBuilder()
            .setTitle(`Burn card Request - ${interaction.user.username}`)
            .setDescription(descriptionLines.join('\n'));

        const buttons = createRowWithBtns([
            createBtn('Accept', Discord.ButtonStyle.Success, ACCEPT_BURN_BTN),
            createBtn('Decline', Discord.ButtonStyle.Danger, DECLINE_BURN_BTN)
        ]);

        const response = await interaction.reply({
            embeds: [embed],
            components: [buttons]
        });

        const collector = response.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 600_000 });

        const buttonHandler = async (buttonInteract: Discord.ButtonInteraction) => {
            if (buttonInteract.user.id === interaction.user.id) {
                const updatedCooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.BURN);
                if (!updatedCooldownInfo.elapsed) {
                    await buttonInteract.reply({
                        ephemeral: true,
                        content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.BURN, updatedCooldownInfo)
                    });
                    await response.delete();
                    return;
                }

                if (buttonInteract.customId === DECLINE_BURN_BTN) {
                    await response.edit({
                        content: '`Burn request cancelled.`',
                        embeds: [],
                        components: []
                    });
                }
                if (buttonInteract.customId === ACCEPT_BURN_BTN) {
                    const burnResult = await burnCardAndAwardMoney(interaction.user.id, cardId, burnValue);
                    if (burnResult === CurrencyResult.ERROR) {
                        await buttonInteract.reply({
                            content: 'Unable to award coins, please try again',
                            ephemeral: true
                        });
                        return;
                    }

                    PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: interaction.user.id });
                    const burntEmbed = new Discord.EmbedBuilder()
                        .setTitle(`Burn completed - ${interaction.user.username}`)
                        .setDescription([`Successfully burnt: ${getCardListString(cardDetails)}`, `For ${burnValue.toLocaleString()} ${COIN_ICON}`].join('\n'));
                    await response.edit({
                        embeds: [burntEmbed],
                        components: []
                    });
                }
            } else {
                await buttonInteract.reply({
                    content: 'Not your burn request to accept/reject',
                    ephemeral: true
                });
            }
        };

        collector.on('collect', safeWrapperFn('burnCollector', buttonHandler));
    }
};

export default command;
