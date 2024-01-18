import { type CommandInterface } from '../services/CommandInteractionManager';
import * as Discord from 'discord.js';
import CooldownRetriever, { type Cooldowns } from '../services/CooldownRetriever';
import capitalize from 'lodash.capitalize';

const command: CommandInterface = {
    name: 'cooldowns',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Shows the remaining time for all current cooldowns',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cooldowns = await CooldownRetriever.getInstance().getAllCooldownsForUser(interaction.user.id);
        const descriptionLines = [];
        for (const cooldown of Object.keys(cooldowns) as Cooldowns[]) {
            const cooldownDisplay = CooldownRetriever.getShortDisplayFromInfo(cooldowns[cooldown]);
            descriptionLines.push(`**${cooldown}**: ${capitalize(cooldownDisplay)}`);
        }

        const embed = new Discord.EmbedBuilder()
            .setTitle(`Cooldown Info for \`${interaction.user.username}\``)
            .setDescription(descriptionLines.join('\n'));

        await interaction.reply({
            embeds: [embed],
            ephemeral: true
        });
    }
};

export default command;
