/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable @typescript-eslint/no-misused-promises */
import 'dotenv/config';
import CommandManager from './services/CommandInteractionManager';
import DbConnectionHandler from './services/DbConnectionHandler';
import ClientManager from './services/ClientManager';
import Configuration from './services/Configuration';
import CooldownNotifier from './services/CooldownNotifier';
import { TerminationManager } from './services/TerminationManager';
import { Deferred, clearAllSleepingCommands } from './utils';
import { CollectorHolder } from './services/CollectorHolder';
import { PostCommandOperations } from './services/PostCommandOperations';

/**
 * Used to make TerminationManager wait for all commands and worker to finish before killing the process
 */
const mainShutdownFunction = async () => {
    clearAllSleepingCommands();

    const shutdownReady = new Deferred();
    const intervalId = setInterval(() => {
        const isWorkerIdle = PostCommandOperations.getInstance().getIsWorkerIdle();
        const allCommandsFinished = TerminationManager.getInstance().getNumberOfActiveCommands() === 0;
        if (isWorkerIdle && allCommandsFinished) {
            console.log('All commands finished and worker idle, shutting down...');
            shutdownReady.resolve(null);
            clearInterval(intervalId);
        } else {
            console.warn(`Waiting for ${TerminationManager.getInstance().getNumberOfActiveCommands()} commands to finish... (Worker is ${isWorkerIdle ? 'idle' : 'busy'})})`);
        }
    }, 1000);

    return await shutdownReady.promise;
};

const startup = async (): Promise<void> => {
    // Ensures we have neccessary config
    Configuration.getInstance();

    // Lets commandLoader preload all commands
    const commandManager = CommandManager.getInstance();
    await commandManager.init();

    ClientManager.init(false, commandManager.handleCommand);
    await CooldownNotifier.getInstance().init();

    // Make connection to database
    const dbHandler = DbConnectionHandler.getInstance();
    await dbHandler.connect();

    // Setup worker processes
    PostCommandOperations.getInstance();

    TerminationManager.getInstance().addTerminationListener(mainShutdownFunction);

    process.once('SIGTERM', async () => {
        console.log('SIGTERM received');
        CollectorHolder.getInstance().closeAll('Bot is restarting.');
        await TerminationManager.getInstance().performShutdownProcedure();
    });
};

startup();
