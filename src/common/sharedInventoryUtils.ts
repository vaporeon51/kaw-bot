import { type InventoryResult } from '../db/users';
import * as Discord from 'discord.js';
import { type Page } from './listBasedEmbed';
import { getCardListString } from './cardDisplay';
import { type ParsedCardId } from './optionParsing';

const PAGINATION_SIZE = 10.0;
export const generatePagesBasedOnInventory = (username: string, inventory: InventoryResult[]) => {
    const pages: Page[] = [];
    const totalPages = Math.max(Math.ceil(inventory.length / PAGINATION_SIZE), 1);
    for (let i = 1; i <= totalPages; i++) {
        pages.push(generateInventoryEmbedPage(username, inventory, totalPages, i));
    }
    return pages;
};

const getSizeOfInventory = (inventory: InventoryResult[]) => {
    return inventory.reduce((prev, curr) => {
        return prev + curr.count;
    }, 0);
};

function generateInventoryEmbedPage (username: string, inventory: InventoryResult[], totalPages: number, page = 1): Page {
    if (page === 1 && inventory.length === 0) {
        return {
            embeds: [new Discord.EmbedBuilder().setDescription('Empty inventory use `\\drop` to get some cards! (or change filters)')]
        };
    }

    const descriptionLines = [];

    const pageStart = (page - 1) * PAGINATION_SIZE;
    const pageEnd = page * PAGINATION_SIZE;

    for (let i = pageStart; i < pageEnd; i++) {
        // Exceeded size of array
        if (i >= inventory.length) {
            continue;
        }
        const countStr = inventory[i].count > 1 ? `\`x${inventory[i].count}\`` : '';
        descriptionLines.push(`${getCardListString(inventory[i])}${countStr}`);
    }

    const title = `**\`${username}\`'s Card Collection**`;

    const inventoryEmbed = new Discord.EmbedBuilder()
        .setDescription([title, '', ...descriptionLines].join('\n'))
        .setFooter({
            text: `Page ${page}/${totalPages} • Total cards: ${getSizeOfInventory(inventory)}`
        });

    return {
        embeds: [inventoryEmbed]
    };
}

interface VerifyResult<T extends InventoryResult> {
    result: boolean
    cards: T[]
};
export const verifyUserHasCards = <T extends InventoryResult>(inventory: T[], cardsIds: ParsedCardId[]): VerifyResult<T> => {
    const inventoryClone = JSON.parse(JSON.stringify(inventory)) as T[];

    const selectedCards: T[] = [];
    for (const cardId of cardsIds) {
        const result = inventoryClone.findIndex((i) => {
            return i.cardId === cardId.id && i.soulbound === cardId.soulbound;
        });
        if (result === -1) {
            return { result: false, cards: selectedCards };
        }
        const card = inventoryClone[result];
        card.count -= 1;

        if (card.count <= 0) {
            inventoryClone.splice(result, 1);
        }
        selectedCards.push({
            ...card,
            count: 1
        });
    }
    return { result: true, cards: selectedCards };
};
