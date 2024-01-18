import type pg from 'pg';
import { Pool } from 'pg';
import Configuration from './Configuration';

export interface ExecuteSQLOptions {
    retries?: number
    client?: pg.PoolClient
};

export default class DbConnectionHandler {
    private static handler: DbConnectionHandler;
    private readonly pool!: pg.Pool;

    constructor () {
        const config = Configuration.getInstance().getConfig();
        const isSSLEnabled = config.isDev ? false : { rejectUnauthorized: false };

        try {
            this.pool = new Pool({
                connectionString: config.databaseUrl,
                idle_in_transaction_session_timeout: 15_000, // 15_000ms (15sec)
                idleTimeoutMillis: 0,
                connectionTimeoutMillis: 0,
                ssl: isSSLEnabled,
                query_timeout: 0,
                statement_timeout: 0
            });

            this.pool.on('error', (e) => {
                console.error(`Pool connection error: ${e}`);
            });
        } catch (e) {
            console.error('Connection terminated');
        }
    }

    /**
     * Required when doing transactions based stuff
     */
    public getConnection = async (): Promise<pg.PoolClient | undefined> => {
        const connection = await this.pool.connect();
        connection.removeAllListeners();
        connection.on('error', (e) => {
            console.error(`Connection for transaction errored: ${e}`);
        });
        return connection;
    };

    public executeSQL = async (queryString: string, options: ExecuteSQLOptions = { retries: 2 }): Promise<pg.QueryResult> => {
        const retries = options.retries ?? 2;
        const client = options.client ? options.client : this.pool;
        try {
            const result = await client.query(queryString);

            return result;
        } catch (e) {
            console.error(`Error occurred while querying database: ${e as any}`);
            if (retries > 0) {
                return await this.executeSQL(queryString, { ...options, retries: retries - 1 });
            } else {
                console.log(`Failed query: ${queryString}`);
                throw new Error('Exhaused executeSQL retries');
            }
        }
    };

    public connect = async (): Promise<void> => {
        try {
            await this.pool.connect();
        } catch (e) {
            console.error(`Failed to connect to database ${e as any}`);
            throw Error();
        }
    };

    public static getInstance = (): DbConnectionHandler => {
        if (DbConnectionHandler.handler === undefined) {
            DbConnectionHandler.handler = new DbConnectionHandler();
        }
        return DbConnectionHandler.handler;
    };
}
