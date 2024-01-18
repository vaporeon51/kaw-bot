import type * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import ClientManager from '../services/ClientManager';
import { codeItem } from '../embedHelpers';

const COMMAND_NAME = 'ping';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Get latency of the bot',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const now = Date.now();
        const userToBot = Math.abs(now - interaction.createdTimestamp);
        const descriptionLines = [
            `**User->Bot Latency**: ${codeItem(`${userToBot}ms`)}`
        ];

        interaction.reply({
            content: `Loading data...\n${descriptionLines}`,
            ephemeral: true
        }).then(async (msg) => {
            const client = ClientManager.getInstance().getClient();
            const botToUser = Math.abs(now - msg.createdTimestamp);
            descriptionLines.push(`**Bot->User Latency**: ${codeItem(`${botToUser}ms`)}`);
            descriptionLines.push(`**Ping**: ${codeItem(userToBot + botToUser)}ms`);
            descriptionLines.push(`**API Latency**: ${`${codeItem(Math.round(client.ws.ping))}ms`}`);
            await interaction.editReply({
                content: `${descriptionLines.join('\n')}`
            });
        }).catch((e) => {
            console.error('Issue with ping command!');
        });
    }
};

export default command;
