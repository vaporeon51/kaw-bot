import type * as Discord from 'discord.js';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { BotSettingKey, getBotSetting, setBotSetting } from '../../../db/botSettings';
import CooldownNotifier from '../../../services/CooldownNotifier';
import { SETTINGS_SECTION } from './_settings';

enum SetChannelNames {
    AUDIT = 'audit',
    TRADE = 'trade',
    EVENT = 'event',
    DROP = 'drop'
}

const channelTypeToBotSetting: Record<SetChannelNames, BotSettingKey> = {
    [SetChannelNames.AUDIT]: BotSettingKey.AUDIT_LOG_CHANNEL_DATA_KEY,
    [SetChannelNames.TRADE]: BotSettingKey.TRADE_CHANNEL_DATA_KEY,
    [SetChannelNames.EVENT]: BotSettingKey.EVENT_CHANNEL_DATA_KEY,
    [SetChannelNames.DROP]: BotSettingKey.DROP_CHANNEL_DATA_KEY
};

const afterSetHandles = async (commandUserId: string, type: SetChannelNames, newValue: Discord.Channel, previousValue: string | null) => {
    if (type === SetChannelNames.AUDIT) {
        AuditLogHandler.getInstance().resetAuditChannelId();
        if (previousValue !== null) {
            await AuditLogHandler.getInstance().publishAuditMessage(COMMAND_NAME, commandUserId, [
                `Audit channel was changed from <#${previousValue}> to <#${newValue.id}>`
            ]);
        }
    } else if (type === SetChannelNames.DROP) {
        await CooldownNotifier.getInstance().setBotChannelId(newValue.id);
    }
};

const COMMAND_NAME = 'channel';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: SETTINGS_SECTION,
    options: [
        {
            name: 'type',
            description: `The type of channel you want to set ${Object.values(SetChannelNames).join(', ')}`,
            required: true,
            type: 'STRING'
        },
        {
            name: 'channel',
            description: 'The channel you want audit messages to be sent in',
            required: true,
            type: 'CHANNEL'
        }
    ],
    description: 'Sets the channel for audit messages to appear in',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const type = interaction.options.getString('type');
        const channel = interaction.options.getChannel('channel');

        if (type === null || !Object.values(SetChannelNames).includes(type.toLowerCase() as SetChannelNames)) {
            await interaction.reply({
                content: `type supplied does not exist, valid options: ${Object.values(SetChannelNames).join(', ')}`,
                ephemeral: true
            });
            return;
        }

        if (channel === null) {
            await interaction.reply({
                content: 'Channel supplied was null, please supply a valid channel',
                ephemeral: true
            });
            return;
        }

        const key = channelTypeToBotSetting[type as SetChannelNames];

        const previousChannelID = await getBotSetting(key);
        await setBotSetting(key, channel.id);
        await interaction.reply({
            content: `${type} channel has been set.`,
            ephemeral: true
        });

        await afterSetHandles(interaction.user.id, type as SetChannelNames, channel as Discord.Channel, previousChannelID);
    }
};

export default command;
