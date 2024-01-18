import * as Discord from 'discord.js';

export const codeItem = (text: string | number) => {
    const quote = '`';
    if (typeof text === 'string' && text === '') {
        return `${quote}Nothing${quote}`;
    }

    return `${quote}${text}${quote}`;
};

export const createBtn = (label: string, style: Discord.ButtonStyle, customId: string, disabled = false) => {
    return new Discord.ButtonBuilder()
        .setCustomId(customId)
        .setStyle(style)
        .setLabel(label)
        .setDisabled(disabled);
};

export const createRowWithSelect = (buttons: Discord.StringSelectMenuBuilder[]) => {
    const row = new Discord.ActionRowBuilder<Discord.StringSelectMenuBuilder>();
    for (const btn of buttons) {
        row.addComponents(btn);
    }
    return row;
};

export const createRowWithBtns = (buttons: Discord.ButtonBuilder[]) => {
    const row = new Discord.ActionRowBuilder<Discord.ButtonBuilder>();
    for (const btn of buttons) {
        row.addComponents(btn);
    }
    return row;
};
