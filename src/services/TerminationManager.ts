// FIXME: Move all services under a one singleton rather than like 20 different ones

import { v4 as uuidv4 } from 'uuid';
import { PostCommandOperations } from './PostCommandOperations';

export enum TerminationState {
    RUNNING = 'RUNNING',
    PENDING_SHUTDOWN = 'PENDING_SHUTDOWN'
}

export class TerminationManager {
    private static instance: TerminationManager;
    private terminationState = TerminationState.RUNNING;
    private readonly terminationListeners: Record<string, () => Promise<void> | void> = {};

    /**
     * A set of userIds that are currently running commands used to check if the process can terminate
     */
    private readonly activeCommands = new Set<string>();

    public isTerminating (): boolean {
        return this.terminationState === TerminationState.PENDING_SHUTDOWN;
    }

    public async performShutdownProcedure (): Promise<void> {
        if (this.terminationState !== TerminationState.PENDING_SHUTDOWN) {
            this.terminationState = TerminationState.PENDING_SHUTDOWN;
            console.log(`Terminating - Running termination handler(s) ${this.terminationListeners.length}...}`);
            // Run cleanup listeners
            for (const handler of Object.values(this.terminationListeners)) {
                await handler();
            }

            // Once all cleanup handlers have finished running it **should** be safe to shutdown the process.
            await PostCommandOperations.getInstance().shutdownWorker();
            process.exit(0);
        }
    }

    public getNumberOfActiveCommands (): number {
        return this.activeCommands.size;
    }

    public addActiveCommand (userId: string): void {
        this.activeCommands.add(userId);
    }

    public removeActiveCommand (userId: string): void {
        this.activeCommands.delete(userId);
    }

    public addTerminationListener (fn: () => void): string {
        const id = uuidv4();
        this.terminationListeners[id] = fn;
        return id;
    }

    public removeTerminationListener (id: string) {
        if (this.terminationListeners[id]) {
            // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
            delete this.terminationListeners[id];
        }
    }

    public static getInstance (): TerminationManager {
        if (!TerminationManager.instance) {
            TerminationManager.instance = new TerminationManager();
        }
        return TerminationManager.instance;
    }
}
