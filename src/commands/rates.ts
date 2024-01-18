import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import GenerateDrop from '../services/GenerateDrop';
import { getInstanceConfig } from '../config/config';
import { Series, type Rarity } from '../config/types';

const command: CommandInterface = {
    name: 'rates',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'See your current drop rates!',
    options: [
        {
            name: 'public',
            description: 'Whether to show your rates publicly',
            required: false,
            type: 'BOOLEAN'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const isPublic = interaction.options.getBoolean('public') ?? false;
        const rateDetails = await GenerateDrop.getInstance().getRarityMapUsingPity({ userId: interaction.user.id }, false);

        if (rateDetails === null) {
            await interaction.reply({
                ephemeral: true,
                content: 'Issue obtaining rates, please try again'
            });
            return;
        }

        const raritySettings = getInstanceConfig().raritySettings;
        const embed = new Discord.EmbedBuilder();
        const descriptionLines = [];
        for (const rarity of Object.keys(rateDetails.raritySettings)) {
            const iconFnOrString = raritySettings[rarity as Rarity].icon;
            const icon = iconFnOrString instanceof Function ? iconFnOrString(Series.SERIES_1) : iconFnOrString;
            const pityRate = rateDetails.pityProgress[rarity as Rarity];
            let pityText = '';

            if (pityRate !== undefined) {
                const totalMaxPity = raritySettings[rarity as Rarity].maxPity;
                if (totalMaxPity === undefined) {
                    throw new Error(`Pity threshold not defined for rarity ${rarity}`);
                }
                pityText = ` (Pity: ${pityRate / 10}%)`;
            }
            descriptionLines.push(`${icon} **${rateDetails.raritySettings[rarity as Rarity] / 10}%**${pityText}`);
        }
        embed
            .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.avatarURL() ?? undefined
            })
            .setFooter({
                text: 'Rates update based on your pity!'
            })
            .setDescription(descriptionLines.join('\n'));

        await interaction.reply({
            embeds: [embed],
            ephemeral: !isPublic
        });
    }
};

export default command;
