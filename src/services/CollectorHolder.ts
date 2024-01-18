import type * as Discord from 'discord.js';
import { v4 as uuidV4 } from 'uuid';

export class CollectorHolder {
    private static instance: CollectorHolder;
    private readonly collectors: Record<string, Discord.InteractionCollector<any> | Discord.MessageCollector>;

    private constructor () {
        this.collectors = {};
    }

    public static getInstance (): CollectorHolder {
        if (!CollectorHolder.instance) {
            CollectorHolder.instance = new CollectorHolder();
        }

        return CollectorHolder.instance;
    }

    public removeCollector (collectorId: string): void {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.collectors[collectorId];
    }

    public addCollector (collector: Discord.InteractionCollector<any> | Discord.MessageCollector): string {
        const collectorId = uuidV4();
        this.collectors[collectorId] = collector;
        return collectorId;
    }

    public closeAll (reason?: string): void {
        console.log('Closing all collectors');
        Object.keys(this.collectors).forEach((collectorKey) => {
            const collector = this.collectors[collectorKey];
            console.log(`Closing collector ${collectorKey}`);
            collector.stop(reason);
        });
    }
}
