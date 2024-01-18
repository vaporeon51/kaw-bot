import { parentPort } from 'worker_threads';
import { WorkerSignals } from '../../common/workerUtils';
import ClientManager from '../../services/ClientManager';
import { getInstanceConfig } from '../../config/config';
import { EmbedBuilder } from 'discord.js';

export function logMessage (message: string) {
    parentPort?.postMessage(`${WorkerSignals.LOG}${message}`);
}

export async function sendAnnouncementMessage (userId: string, title: string, message: string[]) {
    const client = ClientManager.getInstance().getClient();
    const channelId = getInstanceConfig().announcementChannel;

    if (channelId === null) {
        throw new Error('Unexpected audit channel id is null');
    }

    const userDetails = await client.users.fetch(userId).catch((e) => {
        console.warn(`Failed to fetch user details ${userId} for announcement message`);
        return null;
    });

    if (userDetails === null) {
        return;
    }

    const channel = client.channels.cache.get(channelId);
    if (channel?.isTextBased()) {
        const embed = new EmbedBuilder();
        embed.setAuthor({
            name: `${title}`,
            iconURL: userDetails.displayAvatarURL() ?? undefined
        });
        embed.setDescription(message.join('\n'));

        await channel.send({
            content: `<@${userId}>`,
            embeds: [embed],
            allowedMentions: {
                users: [userId]
            }
        });
    } else {
        throw new Error('Unexpected error while trying to send audit message to channel');
    }
}
