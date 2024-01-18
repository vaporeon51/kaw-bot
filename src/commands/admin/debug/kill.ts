import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { JJ_DISCORD_ID } from '../../../cardConstants';
import * as os from 'os';
import { DEBUG_SECTION } from './_debug';

const COMMAND_NAME = 'kill';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    subCommandOf: DEBUG_SECTION,
    isPublicCommand: false,
    description: 'Kills the bot (Useful for testing termination procedures)',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        if (interaction.user.id !== JJ_DISCORD_ID) {
            await interaction.reply({
                content: 'Insufficent permissions for this command',
                ephemeral: true
            });
            return;
        }

        if (os.platform() === 'win32') {
            // Below is hacky version of sigterm without actually emitting signal through the OS
            console.log('Cannot send SIGTERM not supported on windows (Proceeding with emulation)');
            process.emit('SIGTERM', 'SIGTERM');
        } else {
            process.kill(process.pid, 'SIGTERM');
        }
        setTimeout(() => {
            console.log('Killing process from /kill');
            process.kill(process.pid, 'SIGINT');
        }, 30_000);
        await interaction.reply({
            content: 'SIGTERM sent to process, process will be killed in 30 Seconds',
            ephemeral: true
        });
    }
};

export default command;
