import * as Discord from 'discord.js';
import Configuration from './Configuration';

type DiscordInteractionListener = (interaction: Discord.Interaction) => Promise<void>;
export default class ClientManager {
    private static instance: ClientManager;
    private readonly client: Discord.Client;

    /**
     * @param thinClient If to set status and set an interaction listener, to be used by worker processes
     * @param interactionCreateLister an interaction listener to be set if thinClient is false
     */
    constructor (thinClient: boolean, interactionCreateLister: DiscordInteractionListener | null) {
        this.client = new Discord.Client({
            intents: [Discord.IntentsBitField.Flags.Guilds, Discord.IntentsBitField.Flags.GuildMessages]
        });

        const token = Configuration.getInstance().getConfig().token;
        this.client.login(token).then(() => {
            if (!thinClient) {
                const noop = () => {};
                this.client.on(Discord.Events.InteractionCreate, (interactionCreateLister ?? noop));

                this.client.user?.setPresence({
                    activities: [{
                        name: 'Hiding all the SSS cards',
                        type: Discord.ActivityType.Custom
                    }],
                    status: 'online'
                });
            }

            console.log('Started!');
        }).catch((e) => {
            console.log('Failed to login, exiting!');
            throw new Error(e);
        });
    }

    public getClient (): Discord.Client {
        return this.client;
    }

    public static init (thinClient: boolean, interactionCreateLister: DiscordInteractionListener | null) {
        ClientManager.instance = new ClientManager(thinClient, interactionCreateLister);
    }

    public static getInstance (): ClientManager {
        if (!ClientManager.instance) {
            throw new Error('ClientManager was not initialised!');
        }
        return ClientManager.instance;
    }
}
