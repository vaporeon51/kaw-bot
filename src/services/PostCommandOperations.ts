import { Worker } from 'worker_threads';
import * as path from 'path';
import { TerminationManager } from './TerminationManager';
import { WorkerSignals } from '../common/workerUtils';

// Commands that we care about in terms of badge/achievement progress
export enum PostCommand {
    CARDS_CHANGE = 'CARDS_CHANGE',
}

export enum ParentSignals {
    WORK_BATCH = 'WORK_BATCH'
}

export interface CommandPayloads {
    [PostCommand.CARDS_CHANGE]: {
        userId: string
    }
};

export interface QueueItem {
    type: PostCommand
    payload: any
}

export class PostCommandOperations {
    private static instance: PostCommandOperations;
    private queue: QueueItem[] = [];
    private readonly worker: Worker;
    private isWorkerIdle = true;

    private constructor () {
        const workerPath = path.join(__dirname, '../workers/PostCommandProcessor/index.js');
        this.worker = new Worker(workerPath);
        this.worker.on('message', (message) => {
            if (message === undefined || message === null) {
                return;
            }

            if (message === WorkerSignals.READY) {
                console.log('Worker ready! (PostCommandProcessor)');
                return;
            } else if (message === WorkerSignals.IDLE) {
                this.isWorkerIdle = true;
                console.log('Worker idle! (PostCommandProcessor)');
                return;
            } else if (message === WorkerSignals.ERROR) {
                throw new Error('Worker error! (PostCommandProcessor) -- see logs');
            }

            if (message.startsWith(WorkerSignals.LOG)) {
                console.log(`[PostCommandProcessor] ${message.replace(WorkerSignals.LOG, '')}`);
            }
        });

        const intervalId = setInterval(() => {
            // Duplicate and then clear the queue
            const data = this.queue.slice();
            this.queue = [];
            this.sendDataToChildProcess(data);
        }, 5000);

        TerminationManager.getInstance().addTerminationListener(() => {
            clearInterval(intervalId);
            this.sendDataToChildProcess();
        });
    }

    public getIsWorkerIdle () {
        return this.isWorkerIdle;
    }

    public async shutdownWorker () {
        await this.worker.terminate();
    }

    public addCommand <T extends PostCommand>(command: T, payload: CommandPayloads[T]) {
        const queueItem: QueueItem = {
            type: command,
            payload
        };

        // If application is terminating, send data to worker process immediately
        if (TerminationManager.getInstance().isTerminating()) {
            console.log('Immediately sending data to worker process (PostCommandProcessor)');
            this.sendDataToChildProcess([queueItem]);
        } else {
            this.queue.push(queueItem);
        }
    }

    public sendDataToChildProcess (data: QueueItem[] = this.queue) {
        if (data.length > 0) {
            console.log(`Sending ${data.length} commands to worker process (PostCommandProcessor)`);
            this.worker.postMessage({
                type: ParentSignals.WORK_BATCH,
                payload: [
                    ...data
                ]
            });
        }
    }

    public static getInstance () {
        if (!PostCommandOperations.instance) {
            PostCommandOperations.instance = new PostCommandOperations();
        }
        return PostCommandOperations.instance;
    }
}
