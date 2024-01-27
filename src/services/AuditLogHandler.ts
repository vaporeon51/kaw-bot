import * as Discord from 'discord.js';
import { BotSettingKey, getBotSetting } from '../db/botSettings';
import ClientManager from './ClientManager';

const JJ_USER_ID = '1185373336948199576';
export const JJ_AUDIT_CONTACT_LINE = `<@${JJ_USER_ID}> please check logs`;

export default class AuditLogHandler {
    private static instance: AuditLogHandler;
    private channelId: string | null = null;

    public resetAuditChannelId = () => {
        this.channelId = null;
    };

    public retrieveChannelId = async () => {
        if (this.channelId === null) {
            this.channelId = await getBotSetting(BotSettingKey.AUDIT_LOG_CHANNEL_DATA_KEY);
        }
        return this.channelId;
    };

    public async publishAuditMessageError (errorTitle: string, errorDetails: string[]) {
        try {
            const client = ClientManager.getInstance().getClient();
            const channelId = await this.retrieveChannelId();

            if (channelId === null) {
                throw new Error('Unexpected audit channel id is null');
            }

            const channel = client.channels.cache.get(channelId);
            if (channel?.isTextBased()) {
                const embed = new Discord.EmbedBuilder()
                    .setTitle(`Audit Event - ${errorTitle}`)
                    .setDescription(errorDetails.join('\n'));

                await channel.send({
                    embeds: [embed]
                });
            }
        } catch (e) {
            console.error(`Failed to publish error: ${e}`);
        }
    }

    public async publicAuditMessageCustom (title: string, description: string[]) {
        const embed = new Discord.EmbedBuilder()
            .setTitle(`Audit Event - ${title}`)
            .setDescription(description.join('\n'));

        const client = ClientManager.getInstance().getClient();
        const channelId = await this.retrieveChannelId();

        if (channelId === null) {
            throw new Error('Unexpected audit channel id is null');
        }

        const channel = client.channels.cache.get(channelId);
        if (channel?.isTextBased()) {
            await channel.send({
                embeds: [embed]
            });
        } else {
            throw new Error('Unexpected error while trying to send audit message to channel');
        }
    }

    public async publishAuditMessage (commandName: string, userId: string | null, additionalInfo: string[], customTitle?: string) {
        const description = [
            userId ? `User that executed command: <@${userId}>` : '',
            ...additionalInfo
        ];

        const embed = new Discord.EmbedBuilder()
            .setTitle(`Audit Event - ${customTitle ?? commandName}`)
            .setDescription(description.join('\n'));

        const client = ClientManager.getInstance().getClient();
        const channelId = await this.retrieveChannelId();

        if (channelId === null) {
            throw new Error('Unexpected audit channel id is null');
        }

        const channel = client.channels.cache.get(channelId);
        if (channel?.isTextBased()) {
            await channel.send({
                embeds: [embed]
            });
        } else {
            throw new Error('Unexpected error while trying to send audit message to channel');
        }
    }

    public static getInstance (): AuditLogHandler {
        if (!AuditLogHandler.instance) {
            AuditLogHandler.instance = new AuditLogHandler();
        }
        return AuditLogHandler.instance;
    }
}
