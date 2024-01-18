import { COIN_ICON, getValueOfCardInventoryResult } from '../cardConstants';
import { type InventoryResult } from '../db/users';
import { createBtn, createRowWithBtns } from '../embedHelpers';
import { getCardListString } from './cardDisplay';
import * as Discord from 'discord.js';

export const TRADE_GLOBAL_ACCEPT = 'trade-request-global-accept';
export const TRADE_GLOBAL_DECLINE = 'trade-request-global-decline';

export interface TradeEmbedOptions {
    tradeDescriptionPrefix?: string
    fromUserId?: string
    toUserId?: string
    showAcceptanceState?: boolean
    tradeAcceptanceState?: {
        fromUser?: boolean
        toUser?: boolean
    }
};

const createCodeBlock = (type: string, content: string) => {
    const tripleQoutes = '```';
    const block = `${tripleQoutes}${type}\n${content}${tripleQoutes}`;
    return block;
};

const getWorthLine = (sideAWorth: number, sideBWorth: number, numSuffix = 'Coins') => {
    const wrapInColorBlock = (value: number) => {
        const fmtValue = Math.abs(value).toLocaleString();
        if (value > 0) {
            return createCodeBlock('yaml', `+ ${fmtValue} ${numSuffix}`);
        }
        if (value === 0) {
            return createCodeBlock('yaml', 'Perfectly even trade (No gain/loss)');
        }
        return createCodeBlock('diff', `- ${fmtValue} ${numSuffix}`);
    };
    const worthLine = `Total worth: **${sideAWorth.toLocaleString()} ${COIN_ICON}**`;
    const plLIne = `Profit/Loss: ${wrapInColorBlock(sideAWorth - sideBWorth)}`;
    return `\n${worthLine}\n${plLIne}`;
};

const buildDescriptionText = (fromLines: string[], fromTradeWorth: number, toLines: string[], toTradeWorth: number, options: TradeEmbedOptions) => {
    let description = '';
    const fromLinesNonEmpty = fromLines.length > 0 ? fromLines.join('\n') : 'Nothing';
    const toLinesNonEmpty = toLines.length > 0 ? toLines.join('\n') : 'Nothing';

    description += `${(options.tradeDescriptionPrefix ?? '')}`;

    // to user
    const toReceiveSectionText = options.toUserId ? `**<@${options.toUserId}> Receive's:**` : '**They Receive:**';
    // from user
    const fromReceiveSectionText = options.fromUserId ? `**<@${options.fromUserId}> Receive's:**` : '**You Receive:**';

    const toWorthLine = getWorthLine(fromTradeWorth, toTradeWorth);
    const fromWorthLine = getWorthLine(toTradeWorth, fromTradeWorth);

    const preCardsAreaSpacing = (options.tradeDescriptionPrefix ?? '').length > 0 ? '\n\n' : '';
    description += `${preCardsAreaSpacing}${toReceiveSectionText}\n${fromLinesNonEmpty}\n${toWorthLine}`;
    description += `\n\n${fromReceiveSectionText}\n${toLinesNonEmpty}\n${fromWorthLine}`;
    return description;
};

const convertSelectedToDescription = (cards: InventoryResult[]) => {
    const tradeLines = [];
    for (const card of cards) {
        tradeLines.push(getCardListString(card));
    }
    return tradeLines;
};

export const getGlobalControlsRow = (tradeId: string | number) => {
    const globalAccept = createBtn('Accept', Discord.ButtonStyle.Success, `${TRADE_GLOBAL_ACCEPT}${tradeId}`);
    const globalDecline = createBtn('Decline', Discord.ButtonStyle.Danger, `${TRADE_GLOBAL_DECLINE}${tradeId}`);
    const controlsRow = createRowWithBtns([globalAccept, globalDecline]);
    return controlsRow;
};

export const generateTradeEmbed = (
    title: string,
    fromCards: InventoryResult[],
    toCards: InventoryResult[],
    options: TradeEmbedOptions = {}
) => {
    const fromLines = convertSelectedToDescription(fromCards);
    const toLines = convertSelectedToDescription(toCards);
    const tradeWindow = new Discord.EmbedBuilder()
        .setTitle(`${title}`);

    const toTradeWorth = toCards.reduce((prev, curr) => {
        const value = getValueOfCardInventoryResult(curr);
        return prev + value;
    }, 0);
    const fromTradeWorth = fromCards.reduce((prev, curr) => {
        const value = getValueOfCardInventoryResult(curr);
        return prev + value;
    }, 0);

    let descriptionBase = buildDescriptionText(fromLines, fromTradeWorth, toLines, toTradeWorth, options);

    if (options.showAcceptanceState && options.toUserId && options.fromUserId) {
        const fromUserAccepted = options.tradeAcceptanceState?.fromUser ?? false;
        const toUserAccepted = options.tradeAcceptanceState?.toUser ?? false;

        const fromUserAcceptedText = fromUserAccepted ? `<@${options.fromUserId}>` : null;
        const toUserAcceptedText = toUserAccepted ? `<@${options.toUserId}>` : null;

        const acceptedBy = [fromUserAcceptedText, toUserAcceptedText].filter((i) => i !== null);

        if (fromUserAccepted || toUserAccepted) {
            descriptionBase += `\n\nAccepted by: ${acceptedBy.join(' & ')}`;
        }
    }
    tradeWindow.setDescription(descriptionBase);
    return tradeWindow;
};
