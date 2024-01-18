export enum BotInstance {
    KARMA = 'KARMA',
    KAW = 'KAW'
}

interface StrConfigProps {
    instance: string
    guildId: string
    token: string
    applicationId: string
    databaseUrl: string
    clientId: string
    clientSecret: string
    unbelievaBoatToken: string
};

interface BooleanConfigProps {
    isDev: boolean
};

type Config = BooleanConfigProps & StrConfigProps;

export default class Configuration {
    private static instance: Configuration;
    private config: Config = {} as any;

    constructor () {
        this.mapEnvironmentVariableToConfigPropString('DATABASE_URL', 'databaseUrl');
        this.mapEnvironmentVariableToConfigPropString('GUILD_ID', 'guildId');
        this.mapEnvironmentVariableToConfigPropString('APPLICATION_ID', 'applicationId');
        this.mapEnvironmentVariableToConfigPropString('TOKEN', 'token');
        this.mapEnvironmentVariableToConfigPropString('CLIENT_ID', 'clientId');
        this.mapEnvironmentVariableToConfigPropString('CLIENT_SECRET', 'clientSecret');

        this.mapEnvironmentVariableToConfigPropString('INSTANCE', 'instance', BotInstance.KARMA);
        this.mapEnvironmentVariableToConfigPropString('UNBELIEVA_BOAT_TOKEN', 'unbelievaBoatToken', '');

        this.mapEnvironmentVariableToConfigPropBoolean('IS_DEV', 'isDev');
    }

    private mapEnvironmentVariableToConfigPropBoolean (envVariable: string, key: keyof BooleanConfigProps, defaultValue?: boolean) {
        const envValue = process.env[envVariable];
        if (envValue === undefined && defaultValue === undefined) {
            throw new Error(`Error when starting up: ${envVariable} is undefined`);
        }

        this.config[key] = (envValue === 'true') ?? defaultValue;
    }

    private mapEnvironmentVariableToConfigPropString (envVariable: string, key: keyof StrConfigProps, defaultValue?: string) {
        const envValue = process.env[envVariable];
        if (envValue === undefined && defaultValue === undefined) {
            throw new Error(`Error when starting up: ${envVariable} is undefined`);
        }

        this.config[key] = envValue ?? defaultValue ?? '';
    }

    public getConfig (): Config {
        return this.config;
    }

    public static getInstance (): Configuration {
        if (!Configuration.instance) {
            Configuration.instance = new Configuration();
        }
        return Configuration.instance;
    }
}
