import { BotSettingKey, getBotSetting } from '../db/botSettings';
import { type UserData, getAllUserDataForGuild, getUserData } from '../db/users';
import ClientManager from './ClientManager';
import Configuration from './Configuration';
import CooldownRetriever, { Cooldowns } from './CooldownRetriever';

export default class CooldownNotifier {
    private static instance: CooldownNotifier;

    // UserId => NodeJs.Timeout
    private readonly timeoutMap: Record<string, Record<Cooldowns, NodeJS.Timeout>> = {};
    private readonly cooldownToChannelType: Partial<Record<Cooldowns, BotSettingKey>> = {
        [Cooldowns.DROP]: BotSettingKey.DROP_CHANNEL_DATA_KEY,
        [Cooldowns.QUIZ]: BotSettingKey.QUIZ_CHANNEL_DATA_KEY
    };

    private channelId: Partial<Record<BotSettingKey, string | null>> = {
        [BotSettingKey.DROP_CHANNEL_DATA_KEY]: null,
        [BotSettingKey.QUIZ_CHANNEL_DATA_KEY]: null
    };

    private async sendNotification (cooldown: Cooldowns, userId: string) {
        console.log(`Sending notification to: ${userId} for event ${cooldown}`);
        const channelKey: BotSettingKey | undefined = this.cooldownToChannelType[cooldown];
        const config = Configuration.getInstance().getConfig();
        const client = ClientManager.getInstance().getClient();
        const guildDetails = await client.guilds.fetch(config.guildId);
        const guildMember = await guildDetails.members.fetch(userId.toString()).catch((e) => {
            console.error(`Issue getting details for ${userId.toString()} probably left server`);
            return;
        });

        let linesOfContent: string[] = [];

        linesOfContent = [channelKey ? `You have another ${cooldown.toLowerCase()} available to use! Go to <#${this.channelId[channelKey]}>` : `You have another ${cooldown.toLowerCase()} available!`];

        if (guildMember) {
            const dmChannel = await guildMember.createDM();
            await dmChannel.send(linesOfContent.join('\n'));
        }
    }

    private async setNotificationForEvent (event: Cooldowns, user: UserData) {
        if (!user.allowedCooldownTypes.includes(event)) {
            return;
        }

        const cooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(user.id, event);

        if (cooldownInfo.elapsed) {
            return;
        }

        if (cooldownInfo.timeLeft === null) {
            return;
        }

        if (!this.timeoutMap[user.id]) {
            this.timeoutMap[user.id] = {} as any;
        }

        console.log(`Setup cooldown for ${user.id} ${event} - ${cooldownInfo.timeLeft}ms`);
        this.timeoutMap[user.id][event] = setTimeout(() => {
            this.sendNotification(event, user.id.toString()).catch((e) => {
                console.error(`Issue sending notification: ${e}`);
            });
        }, cooldownInfo.timeLeft);
    }

    public async resetUserNotificationTimeoutForEvent (event: Cooldowns, userId: string, userData?: UserData) {
        const currentValue = this.timeoutMap[userId];
        if (currentValue && this.timeoutMap[userId][event]) {
            clearTimeout(this.timeoutMap[userId][event]);
        }

        const user = userData ?? await getUserData(userId);
        if (user !== null) {
            await this.setNotificationForEvent(event, user);
        } else {
            console.error('Unable to get user details when refreshing notification timeout');
        }
    }

    public async resetUserNotificationTimeout (userId: string, userData?: UserData) {
        const currentValue = this.timeoutMap[userId];
        if (currentValue) {
            for (const timeout of Object.values(currentValue)) {
                if (timeout) {
                    clearTimeout(timeout);
                }
            }
        }

        const user = userData ?? await getUserData(userId);
        if (user !== null) {
            for (const cooldownType of Object.values(Cooldowns)) {
                await this.setNotificationForEvent(cooldownType, user);
            }
        } else {
            console.error('Unable to get user details when refreshing notification timeout');
        }
    }

    public async setBotChannelId (key?: BotSettingKey, channelId?: string) {
        if (key && channelId) {
            this.channelId[key] = channelId;
            return;
        }

        for (const key in this.channelId) {
            this.channelId[key as BotSettingKey] = await getBotSetting(key as BotSettingKey);
        }
    }

    public async init () {
        const config = Configuration.getInstance().getConfig();
        const users = await getAllUserDataForGuild(config.guildId);
        await this.setBotChannelId();
        for (const user of users) {
            await this.resetUserNotificationTimeout(user.id, user);
        }
    }

    public static getInstance (): CooldownNotifier {
        if (!CooldownNotifier.instance) {
            CooldownNotifier.instance = new CooldownNotifier();
        }
        return CooldownNotifier.instance;
    }
}
