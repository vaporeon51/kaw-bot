import { COIN_ICON, type PackDetails, SOULBOUND_ICON, packsForPurchase } from '../cardConstants';
import { safeWrapperFn } from '../common/safeCollector';
import { createRowWithSelect } from '../embedHelpers';
import { type CommandInterface } from '../services/CommandInteractionManager';
import * as Discord from 'discord.js';
import { PackOpeningType, displayCard, showPackOpeningEmbed } from '../common/cardDisplay';
import { addCardToInventory, modifyUserLastPackOpened } from '../db/users';
import DbConnectionHandler from '../services/DbConnectionHandler';
import AuditLogHandler from '../services/AuditLogHandler';
import CooldownRetriever, { Cooldowns } from '../services/CooldownRetriever';
import CooldownNotifier from '../services/CooldownNotifier';
import { PostCommand, PostCommandOperations } from '../services/PostCommandOperations';
import { CurrencyManager, CurrencyResult } from '../services/currency/Currency';

const OPEN_PACK_SELECT = 'OPEN_PACK_SELECT_CUSTOM';

const handleTransactionForOpenPack = async (
    response: Discord.InteractionResponse,
    interaction: Discord.ChatInputCommandInteraction,
    selectEvent: Discord.StringSelectMenuInteraction,
    selectedPack: PackDetails
) => {
    const client = await DbConnectionHandler.getInstance().getConnection();

    if (!client) {
        throw new Error('Unable to obtain connection for opening pack');
    }

    await selectEvent.deferReply();

    let cardToAward = null;
    let cardInstanceId = null;
    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', { client });
        await modifyUserLastPackOpened(interaction.user.id, Date.now(), { client });
        cardToAward = await selectedPack.generatorFn();
        cardInstanceId = await addCardToInventory(interaction.user.id, cardToAward.id, {
            reason: `Purchase pack ${selectedPack.id}`,
            withCheckForGroupProgress: true,
            soulbound: selectedPack.soulboundOutput
        }, { client });
        const deductResult = await CurrencyManager.getInstance().deduct(interaction.user.id, selectedPack.value, `Purchasing pack ${selectedPack.id}`);
        if (deductResult === CurrencyResult.ERROR || deductResult === CurrencyResult.NOT_ENOUGH) {
            throw new Error(`Unable to deduct ${selectedPack.value} from ${interaction.user.id}`);
        }

        await DbConnectionHandler.getInstance().executeSQL('COMMIT', { client });
        await CooldownNotifier.getInstance().resetUserNotificationTimeoutForEvent(Cooldowns.OPEN_PACK, interaction.user.id);
        PostCommandOperations.getInstance().addCommand(PostCommand.CARDS_CHANGE, { userId: interaction.user.id });
    } catch (e) {
        await selectEvent.editReply({
            content: 'There was an error opening the pack, please try again'
        });
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', { client });
        await AuditLogHandler.getInstance().publishAuditMessageError('Issue with burning card',
            [
                `User <@${interaction.user.id}> attempted to open pack ${selectedPack.id} with a DB error occuring during it`
            ]);
        return null;
    } finally {
        client.release();
    }

    if (cardToAward) {
        const waitFn = await showPackOpeningEmbed(selectEvent, selectEvent.user.username, PackOpeningType.NORMAL);
        await waitFn();
        await displayCard(selectEvent, cardToAward, {
            authorDetails: {
                iconURL: interaction.user.avatarURL() ?? undefined,
                name: `Obtained from purchasing ${selectedPack.name}`
            },
            isDefer: true,
            soulbound: selectedPack.soulboundOutput,
            cardInstanceId
        });
        await selectEvent.followUp({
            content: `Removed ${COIN_ICON} ${selectedPack.value.toLocaleString()} to purchase \`${selectedPack.name}\``,
            ephemeral: true
        });
        await response.delete();
    }
};

const command: CommandInterface = {
    name: 'open_pack',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Display list of packs that are available for purchase',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.OPEN_PACK);
        if (!cooldownInfo.elapsed) {
            await interaction.reply({
                content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.OPEN_PACK, cooldownInfo),
                ephemeral: true
            });
            return;
        }

        const descriptionLines = [];
        const options: Discord.APISelectMenuOption[] = [];
        const selectBuilder = new Discord.StringSelectMenuBuilder()
            .setPlaceholder('Select pack to purchase')
            .setCustomId(OPEN_PACK_SELECT);

        for (const pack of packsForPurchase) {
            if (!pack.enabled) {
                continue;
            }

            options.push({
                label: pack.name,
                value: pack.id,
                description: pack.description
            });
            descriptionLines.push(`<:CollectionCards:1177797372135350312> **\`${pack.name}\`**`);
            descriptionLines.push(`**Description:** ${pack.description}`);
            descriptionLines.push(`**Cost:** ${pack.value.toLocaleString()} ${COIN_ICON}`);
            descriptionLines.push(`**ID:** ${pack.id}`);
            if (pack.soulboundOutput) {
                descriptionLines.push(`**Pack only drops ${SOULBOUND_ICON} cards**`);
            }
            descriptionLines.push('');
        }

        selectBuilder.setOptions(options);
        const storeEmbed = new Discord.EmbedBuilder()
            .setTitle('Pack Purchase Store')
            .setDescription(descriptionLines.join('\n'));

        const selectRow = createRowWithSelect([selectBuilder]);
        const response = await interaction.reply({
            embeds: [storeEmbed],
            components: [selectRow],
            ephemeral: true
        });

        const selectListener = response.createMessageComponentCollector({ componentType: Discord.ComponentType.StringSelect, time: 10_000 });
        const onPackSelected = async (selectEvent: Discord.StringSelectMenuInteraction) => {
            if (selectEvent.customId === OPEN_PACK_SELECT && interaction.user.id === selectEvent.user.id) {
                const updatedCooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.OPEN_PACK);
                if (!updatedCooldownInfo.elapsed) {
                    await interaction.reply({
                        content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.OPEN_PACK, updatedCooldownInfo),
                        ephemeral: true
                    });
                    return;
                }
                const selectedPack = packsForPurchase.find((item) => item.id === selectEvent.values[0]);
                if (!selectedPack) {
                    await selectEvent.reply({
                        content: 'Could not find the selected pack, please try again',
                        ephemeral: true
                    });
                    await response.delete();
                    return;
                }

                const balance = await CurrencyManager.getInstance().balance(interaction.user.id);
                if (typeof balance !== 'number') {
                    await selectEvent.reply({
                        content: 'Unable to retrieve balance, please try again',
                        ephemeral: true
                    });
                    await response.delete();
                    return;
                }

                if (balance < selectedPack.value) {
                    await selectEvent.reply({
                        content: 'You cannot afford to open the selected pack',
                        ephemeral: true
                    });
                    await response.delete();
                    return;
                }
                await handleTransactionForOpenPack(response, interaction, selectEvent, selectedPack);
            }
        };

        selectListener.on('collect', safeWrapperFn('onPackSelected', onPackSelected));
    }
};

export default command;
