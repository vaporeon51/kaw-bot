import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { CurrencyManager } from '../../../services/currency/Currency';
import { DEBUG_SECTION } from './_debug';

const COMMAND_NAME = 'set_money';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: DEBUG_SECTION,
    options: [
        {
            name: 'target',
            description: 'The user to receieve the gift roll',
            required: true,
            type: 'USER'
        },
        {
            name: 'amount',
            description: 'Amount to set in the bank',
            required: true,
            type: 'NUMBER'
        }
    ],
    description: 'Set a users money',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const amount = interaction.options.getNumber('amount') ?? 0;
        const target = interaction.options.getUser('target');

        if (!target) {
            await interaction.reply({
                content: 'Target must be specified to execute command',
                ephemeral: true
            });
            return;
        }

        await CurrencyManager.getInstance().set(target.id, amount, `Set by ${interaction.user.username}`);
        await interaction.reply({
            content: 'Balance is set',
            ephemeral: true
        });
    }
};

export default command;
