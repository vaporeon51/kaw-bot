import * as Discord from 'discord.js';
import { CollectorHolder } from '../services/CollectorHolder';
import { safeWrapperFn } from './safeCollector';

export interface Page {
    embeds: Discord.EmbedBuilder[]
    ephemeral?: boolean
};

export const PREVIOUS_CUSTOM_ID = 'previous-page-inv';
export const NEXT_CUSTOM_ID = 'next-page-inv';

const getActionButtons = (page: number, pages: Page[]) => {
    const row = new Discord.ActionRowBuilder<Discord.ButtonBuilder>();

    let buttonsAdded = 0;
    const addPreviousBtn = page > 0;
    const notOnLastPage = page < pages.length - 1;
    if (addPreviousBtn) {
        const previous = new Discord.ButtonBuilder()
            .setCustomId(PREVIOUS_CUSTOM_ID)
            .setLabel('Previous')
            .setStyle(Discord.ButtonStyle.Danger);

        buttonsAdded += 1;
        row.addComponents(previous);
    }
    if (notOnLastPage) {
        const next = new Discord.ButtonBuilder()
            .setCustomId(NEXT_CUSTOM_ID)
            .setLabel('Next')
            .setStyle(Discord.ButtonStyle.Primary);

        buttonsAdded += 1;
        row.addComponents(next);
    }

    // No buttons edge case
    if (buttonsAdded === 0) {
        return null;
    }

    return [row];
};

const getPageContent = (pages: Page[], page: number): Page & { components: Array<Discord.ActionRowBuilder<Discord.ButtonBuilder>> } => {
    const pageIndx = page - 1;
    const actionButtons = getActionButtons(pageIndx, pages);
    const pageContent = pages[pageIndx];
    return {
        ...pageContent,
        components: actionButtons ?? []
    };
};

export interface ListEmbedOptions {
    ephemeral?: boolean
    clearOnlyComponents?: boolean
};
export const handleListBasedEmbed = async (
    msg: Discord.Interaction,
    userId: string,
    pages: Page[],
    expireMsg: string,
    options?: ListEmbedOptions
) => {
    let page = 1;

    if (!msg.isRepliable() || msg.replied) {
        return;
    }

    const response = await msg.reply({
        ...getPageContent(pages, page),
        ephemeral: options?.ephemeral ?? false
    });

    const collector = response.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 120_000 });
    const onListBtnPress = async (buttonInteract: Discord.ButtonInteraction) => {
        if (buttonInteract.user.id === userId) {
            if (buttonInteract.customId === NEXT_CUSTOM_ID) {
                // Next page
                page += 1;
                await buttonInteract.update(getPageContent(pages, page));
            }
            if (buttonInteract.customId === PREVIOUS_CUSTOM_ID) {
                // Prev page
                page -= 1;
                await buttonInteract.update(getPageContent(pages, page));
            }
        }
    };

    const collectorId = CollectorHolder.getInstance().addCollector(collector);
    const onListEnd = async (collected: Discord.Collection<Discord.Snowflake, Discord.Interaction>, reason: string) => {
        CollectorHolder.getInstance().removeCollector(collectorId);

        const reasonMsg = reason !== 'time' ? `Pagination removed due to: ${reason}` : expireMsg;
        if (options?.clearOnlyComponents) {
            await response.edit({
                content: `\`${reasonMsg}\``,
                components: []
            });
        } else {
            await response.edit({
                content: `\`${reasonMsg}\``,
                embeds: [],
                components: []
            });
        }
    };

    collector.on('collect', safeWrapperFn('onInventoryBtnPress', onListBtnPress));
    collector.on('end', safeWrapperFn('onInventoryEnd', onListEnd));
};
