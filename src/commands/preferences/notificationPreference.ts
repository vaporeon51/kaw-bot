import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../services/CommandInteractionManager';
import { modifyUserNotificationPreference } from '../../db/users';
import CooldownNotifier from '../../services/CooldownNotifier';
import { Cooldowns } from '../../services/CooldownRetriever';

const COMMAND_NAME = 'notification';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: true,
    subCommandOf: 'preferences',
    options: [
        {
            name: 'type',
            description: 'The type of notification you want to allow/disallow',
            required: true,
            type: 'STRING',
            choices: Object.values(Cooldowns)
        },
        {
            name: 'enabled',
            description: 'Enables/Disables sending drop notifications when available',
            required: true,
            type: 'BOOLEAN'
        }
    ],
    description: 'Sets what notification(s) you receive in your DMs',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const isEnabled = interaction.options.getBoolean('enabled') ?? true;
        const type = interaction.options.getString('type');

        if (!type || !Object.values(Cooldowns).includes(type as Cooldowns)) {
            await interaction.reply({
                content: `Invalid type must be one of: ${Object.values(Cooldowns).join(', ')}`,
                ephemeral: true
            });
            return;
        }

        await modifyUserNotificationPreference(interaction.user.id, type, isEnabled);
        await CooldownNotifier.getInstance().resetUserNotificationTimeout(interaction.user.id);
        await interaction.reply({
            content: `Notifications for \`${type}\` are now \`${isEnabled ? 'enabled' : 'disabled'}\``,
            ephemeral: true
        });
    }
};

export default command;
