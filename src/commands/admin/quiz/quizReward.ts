import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { QUIZ_SECTION } from './_quiz';
import { getQuizWeekSummary } from '../../../db/quiz';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../../../services/DbConnectionHandler';
import { CurrencyManager, CurrencyResult } from '../../../services/currency/Currency';

const COMMAND_NAME = 'quiz_rewards';
const TOP_SCORER_COINS = [10000, 5000, 2500];
const WIN_STREAK_COINS = 1000;

const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: QUIZ_SECTION,
    description: 'Distribute rewards for quiz award winners',
    options: [
        {
            name: 'week',
            description: 'The week for of the awards',
            required: true,
            type: 'NUMBER'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const week = interaction.options.getNumber('week');

        if (typeof week !== 'number') {
            await interaction.reply({
                content: 'week must be a number',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });

        const connection = await DbConnectionHandler.getInstance().getConnection();
        const executeSQLOptions: ExecuteSQLOptions = { client: connection };
        const data = await getQuizWeekSummary(week, executeSQLOptions);
        if (data === null) {
            throw new Error('Query returned null');
        }
        for (const [index, user] of data.topScorers.entries()) {
            if (index >= TOP_SCORER_COINS.length) {
                throw new Error('There are more top scorers than awards specified');
            }
            const isFailure = await CurrencyManager.getInstance().deposit(user.userId, TOP_SCORER_COINS[index], `Awarded for top scorer position ${index + 1}`);
            if (isFailure === CurrencyResult.ERROR) {
                throw new Error('Unable to award coins');
            }
            console.log(isFailure);
        }
        for (const user of data.longestWinStreakers) {
            const isFailure = await CurrencyManager.getInstance().deposit(user.userId, WIN_STREAK_COINS, 'Awarded for longest winning streak');
            if (isFailure === CurrencyResult.ERROR) {
                throw new Error('Unable to award coins');
            }
            console.log(isFailure);
        }

        await interaction.editReply({
            content: 'Complete'
        });
    }
};

export default command;
