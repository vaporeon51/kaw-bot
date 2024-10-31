import { CHECKMARK_ICON, ONE_HOUR_MS, TIMER_ICON, ONE_MINUTE_MS } from '../cardConstants';
import { type UserData, getUserData } from '../db/users';
import PermissionsCache from './PermissionsCache';

// Maps to the field in the users table for the cooldown, these are stored in DB so changing them without
// Updating the DB means people might stop getting notified!
export enum Cooldowns {
    BURN = 'BURN',
    DROP = 'DROP',
    OPEN_PACK = 'OPEN_PACK',
    QUIZ = 'QUIZ'
}

type KeysMatching<T, V> = { [K in keyof T]-?: T[K] extends V ? K : never }[keyof T];
interface CooldownSettings {
    userField: KeysMatching<UserData, number | undefined>
    defaultCooldown: number
    displayPrefix: string
};

const cooldownToSettings: Record<Cooldowns, CooldownSettings> = {
    [Cooldowns.BURN]: {
        userField: 'lastBurnPerformed',
        defaultCooldown: ONE_HOUR_MS * 12,
        displayPrefix: 'Burn'
    },
    [Cooldowns.DROP]: {
        userField: 'lastCardReceived',
        defaultCooldown: ONE_HOUR_MS * 12,
        displayPrefix: 'Drop'
    },
    [Cooldowns.OPEN_PACK]: {
        userField: 'lastPackOpened',
        defaultCooldown: ONE_HOUR_MS * 24,
        displayPrefix: 'Open pack'
    },
    [Cooldowns.QUIZ]: {
        userField: 'lastQuizCompleted',
        defaultCooldown: ONE_MINUTE_MS * 20,
        displayPrefix: 'Play quiz'
    }
};

export interface CooldownInfoOutput {
    timeLeft: number | null
    elapsed: boolean
    availableAtEpoch: number
};

export default class CooldownRetriever {
    public static instance: CooldownRetriever;

    private hasCooldownElapsed(msSinceLastCard: number | null | undefined, cooldown: number): boolean {
        if (msSinceLastCard === null || msSinceLastCard === undefined) {
            return true;
        }
        return msSinceLastCard >= cooldown;
    };

    private async handleDropCooldown(user: UserData, lastCardReceived: number | undefined): Promise<CooldownInfoOutput> {
        const msSinceLastCard = !lastCardReceived ? null : Date.now() - lastCardReceived;
        const roleCache = PermissionsCache.getInstance();
        const cooldownMs = await roleCache.getCooldownMsBasedOnRole(user.id);

        const hasElapsed = user.lastCardReceived === undefined ? true : this.hasCooldownElapsed(msSinceLastCard, cooldownMs);

        const timeLeft = msSinceLastCard === null ? null : cooldownMs - msSinceLastCard;
        return {
            elapsed: hasElapsed,
            availableAtEpoch: Math.floor(((user?.lastCardReceived ?? 0) + cooldownMs) / 1000),
            timeLeft
        };
    }

    private calculateCooldownInfo(lastTimeActionPerformed: number | undefined, cooldownAmount: number): CooldownInfoOutput {
        const timeSinceActionHappened = Date.now() - (lastTimeActionPerformed ?? 0);
        const timeLeft = cooldownAmount - timeSinceActionHappened;
        const elapsed = lastTimeActionPerformed === undefined ? true : timeSinceActionHappened > cooldownAmount;
        return {
            elapsed,
            availableAtEpoch: Math.floor(((lastTimeActionPerformed ?? 0) + cooldownAmount) / 1000),
            timeLeft
        };
    };

    private async calculateCooldownInfoBasedOnCooldown(userData: UserData, cooldown: Cooldowns, lastTimeActionPerformed: number | undefined) {
        const cooldownSettings = cooldownToSettings[cooldown];
        if (cooldown === Cooldowns.DROP) {
            return await this.handleDropCooldown(userData, lastTimeActionPerformed);
        } else {
            return this.calculateCooldownInfo(lastTimeActionPerformed, cooldownSettings.defaultCooldown);
        }
    }

    public static renderTime(epoch: number) {
        return `<t:${epoch}:F>`;
    };

    public static getDisplayStringFromInfo(cooldown: Cooldowns, cooldownInfo: CooldownInfoOutput, includePrefix = true): string {
        const cooldownSettings = cooldownToSettings[cooldown];
        const prefix = includePrefix ? `${cooldownSettings.displayPrefix} ` : '';
        if (!cooldownInfo.elapsed) {
            return `${prefix}unavailable, next available: ${CooldownRetriever.renderTime(cooldownInfo.availableAtEpoch)} ${TIMER_ICON}`;
        } else {
            return `${prefix}available! ${CHECKMARK_ICON}`;
        }
    }

    public static getShortDisplayFromInfo(cooldownInfo: CooldownInfoOutput): string {
        if (!cooldownInfo.elapsed) {
            return `${CooldownRetriever.renderTime(cooldownInfo.availableAtEpoch)} ${TIMER_ICON}`;
        } else {
            return `${CHECKMARK_ICON}`;
        }
    }

    public async getAllCooldownsForUser(userId: string): Promise<Record<Cooldowns, CooldownInfoOutput>> {
        const userData = await getUserData(userId);
        if (userData === null) {
            throw Error('Unable to retrieve user data');
        }

        const resultObj: Record<Cooldowns, CooldownInfoOutput> = {} as any;
        for (const cooldown of Object.values(Cooldowns)) {
            const cooldownSettings = cooldownToSettings[cooldown];
            const lastTimeActionHappened = userData[cooldownSettings.userField];

            resultObj[cooldown] = await this.calculateCooldownInfoBasedOnCooldown(userData, cooldown, lastTimeActionHappened);
        }
        return resultObj;
    }

    public async getCooldownInfo(userId: string, cooldown: Cooldowns) {
        const userData = await getUserData(userId);
        if (userData === null) {
            throw Error('Unable to retrieve user data');
        }

        const cooldownSettings = cooldownToSettings[cooldown];
        const lastTimeActionHappened = userData[cooldownSettings.userField];
        return await this.calculateCooldownInfoBasedOnCooldown(userData, cooldown, lastTimeActionHappened);
    }

    public static getInstance(): CooldownRetriever {
        if (!CooldownRetriever.instance) {
            CooldownRetriever.instance = new CooldownRetriever();
        }
        return CooldownRetriever.instance;
    }
}
