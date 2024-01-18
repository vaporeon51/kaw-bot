import AuditLogHandler from '../services/AuditLogHandler';

export const safeWrapperFn = (name: string, wrapperFn: (...args: any[]) => Promise<any>) => {
    return async (...args: any[]) => {
        try {
            await wrapperFn(...args);
        } catch (e) {
            console.error(`Error occurred: ${name} => ${e} ${(e as any).stack}`);
            void AuditLogHandler.getInstance().publishAuditMessageError(`Wrapper Fn: ${name}`, ['Issue occurred with collector please investigate']);
        }
    };
};
