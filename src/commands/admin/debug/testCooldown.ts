import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import PermissionsCache from '../../../services/PermissionsCache';
import { msToTime } from '../../../utils';
import { DEBUG_SECTION } from './_debug';

const command: CommandInterface = {
    name: 'test_cooldown',
    dmAllowed: false,
    subCommandOf: DEBUG_SECTION,
    isPublicCommand: false,
    description: 'Returns the cooldown for the user',
    options: [
        {
            name: 'target',
            description: 'The user you want to see the cooldown of',
            required: true,
            type: 'USER'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const target = interaction.options.getUser('target');
        if (!target) {
            await interaction.reply({
                content: '`target is required for testing cooldown`',
                ephemeral: true
            });
            return;
        }

        const cooldown = await PermissionsCache.getInstance().getCooldownMsBasedOnRole(target.id);
        await interaction.reply({
            content: `User: <@${target.id}> cooldown interval is ${msToTime(cooldown)}`,
            ephemeral: true
        });
    }
};

export default command;
