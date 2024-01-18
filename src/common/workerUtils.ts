import type { MessagePort } from 'worker_threads';

export enum WorkerSignals {
    READY = 'READY',
    IDLE = 'IDLE',
    ERROR = 'ERROR',
    LOG = 'LOG'
}

export const rewriteLoggingFunctions = (parentPort: MessagePort | null) => {
    if (parentPort === null) {
        return;
    }

    const consoleProxyFn = (...args: any[]) => {
        parentPort?.postMessage(`${WorkerSignals.LOG}${args.join(' ')}`);
    };
    console.log = consoleProxyFn;
    console.warn = consoleProxyFn;
    console.error = consoleProxyFn;
};
