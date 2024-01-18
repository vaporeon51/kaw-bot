import * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { getAllRoleSettings } from '../../../db/roles';
import PermissionsCache from '../../../services/PermissionsCache';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { msToTime } from '../../../utils';
import { PERMISSIONS_SECTION } from './_permissions';

const COMMAND_NAME = 'role_settings_list';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: PERMISSIONS_SECTION,
    description: 'Get list of applied role settings',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const roleSettings = await getAllRoleSettings();

        if (roleSettings.length === 0) {
            await interaction.reply({
                content: '`No custom role settings have been applied`'
            });
            return;
        }

        const descriptionLines = [];
        for (const role of roleSettings) {
            const roleObj = await PermissionsCache.getInstance().convertRoleIdToAPIRole(role.roleId);
            const cooldownTime = msToTime(role.refreshTimeMs);
            descriptionLines.push(`\`${roleObj.name}\` - Position: \`${role.position}\`, CooldownTime: \`${cooldownTime}\``);
        }

        const roleEmbed = new Discord.EmbedBuilder().setTitle('Role Settings').setDescription(descriptionLines.join('\n'));

        await interaction.reply({
            embeds: [roleEmbed],
            ephemeral: true
        });

        await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, interaction.user.id, []);
    }
};

export default command;
