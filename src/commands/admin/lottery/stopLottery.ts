import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { LotteryManager } from './lottery';
import { EVENT_SECTION } from './_events';

const COMMAND_NAME = 'stop_lottery';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: EVENT_SECTION,
    description: 'Stops active lottery draw if one exists',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        await LotteryManager.getInstance().endLottery('Lottery stopped by admin');
        await interaction.reply({
            content: 'If lottery was active it has been stopped (may need 10 seconds to update)',
            ephemeral: true
        });
    }
};

export default command;
