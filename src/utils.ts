import { v4 as uuidv4 } from 'uuid';
import { TerminationManager } from './services/TerminationManager';

export function msToTime(duration: number): string {
    const seconds = Math.floor((duration / 1000) % 60);
    const minutes = Math.floor((duration / (1000 * 60)) % 60);
    const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    const segements = [
        {
            value: hours,
            suffix: 'h'
        },
        {
            value: minutes,
            suffix: 'm'
        },
        {
            value: seconds,
            suffix: 's'
        }
    ];

    const filteredSegements = segements.filter((segement) => segement.value !== 0);
    if (filteredSegements.length === 0) {
        filteredSegements.push({
            value: duration,
            suffix: 'ms'
        });
    }
    const segementsAsCombined = filteredSegements.map((segement) => `${segement.value}${segement.suffix}`).join(' ');
    return segementsAsCombined;
}

export class Deferred {
    public promise: Promise<unknown>;
    public reject!: (reason?: any) => void;
    public resolve!: (value: unknown) => void;

    constructor() {
        this.promise = new Promise((resolve, reject) => {
            this.reject = reject;
            this.resolve = resolve;
        });
    }
}

interface SleepingFn {
    deferredObj: Deferred
    timeout: NodeJS.Timeout
};
const pendingFunctions: Record<string, SleepingFn | null> = {};

const adminUsers = new Set([
    '1172605903921500232',
    '294407875655237633',
    '837357628812296262',
    '1185373336948199576',
    '1127807615800459304',
    '708138557553770577'
]);
export function isAdminUser(userId: string): boolean {
    return adminUsers.has(userId);
}

export async function sleep(ms: number | null) {
    if (ms === 0 || ms === null) {
        return;
    }

    // If terminating just send back a resolved promise
    if (TerminationManager.getInstance().isTerminating()) {
        return await Promise.resolve(null);
    }

    let setTimeoutID: NodeJS.Timeout | null = null;
    const selectedId = uuidv4();
    const deferred = new Deferred();
    setTimeoutID = setTimeout(() => {
        if (pendingFunctions[selectedId]) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete pendingFunctions[selectedId];
        }
        deferred.resolve(null);
    }, ms);
    pendingFunctions[selectedId] = {
        deferredObj: deferred,
        timeout: setTimeoutID
    };
    return await deferred.promise;
}

export function clearAllSleepingCommands() {
    for (const key of Object.keys(pendingFunctions)) {
        const value = pendingFunctions[key];
        if (value !== null) {
            console.log(`Clearing sleeping command - ${key}`);
            clearTimeout(value.timeout);
            value.deferredObj.resolve(null);
        }
    }
}

export function getPerc(amount: number, total: number) {
    return Math.floor((amount / total) * 100);
}
