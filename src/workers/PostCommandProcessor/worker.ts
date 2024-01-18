import { parentPort } from 'worker_threads';
import { type CommandPayloads, PostCommand, ParentSignals, type QueueItem } from '../../services/PostCommandOperations';
import DbConnectionHandler from '../../services/DbConnectionHandler';
import ClientManager from '../../services/ClientManager';
import { handleCardsChange } from './operations/cardChange';
import { logMessage } from './utils';
import { WorkerSignals, rewriteLoggingFunctions } from '../../common/workerUtils';

if (parentPort === null) {
    throw new Error('Parent port is null!');
}

const init = async () => {
    await DbConnectionHandler.getInstance().connect();
    ClientManager.init(true, null);
    parentPort?.postMessage(WorkerSignals.READY);
    rewriteLoggingFunctions(parentPort);
};

parentPort.on('message', (message) => {
    if (message.type === ParentSignals.WORK_BATCH) {
        for (const item of message.payload as QueueItem[]) {
            logMessage(`Processing ${item.type} for ${item.payload.userId}...`);

            performTask(item).catch((e) => {
                logMessage(e.message);
            });
        }
        parentPort?.postMessage(WorkerSignals.IDLE);
    }
});

async function performTask (taskData: QueueItem) {
    switch (taskData.type) {
        case PostCommand.CARDS_CHANGE:
            await handleCardsChange(taskData.payload as CommandPayloads[PostCommand.CARDS_CHANGE]);
            break;
        default:
            return;
    }
}

init().catch(() => {
    parentPort?.postMessage(WorkerSignals.ERROR);
});
