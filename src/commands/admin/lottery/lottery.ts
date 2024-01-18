import { type CardData } from '../../../db/cards';
import CardCache from '../../../services/CardCache';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import * as Discord from 'discord.js';
import { msToTime } from '../../../utils';
import ClientManager from '../../../services/ClientManager';
import { codeItem, createBtn, createRowWithBtns } from '../../../embedHelpers';
import { safeWrapperFn } from '../../../common/safeCollector';
import { CollectorHolder } from '../../../services/CollectorHolder';
import GenerateDrop from '../../../services/GenerateDrop';
import { TerminationManager } from '../../../services/TerminationManager';
import { addCardToInventory } from '../../../db/users';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { CurrencyManager, CurrencyResult } from '../../../services/currency/Currency';
import { getInstanceConfig } from '../../../config/config';
import { EVENT_SECTION } from './_events';
import { CELEBRATE_ICON } from '../../../cardConstants';

const JOIN_LOTTERY_BTN = 'join-lottery-button-new';

const createLotteryEmbed = (
    cardDetails: CardData,
    entryCost: number,
    users: Set<string>,
    msTillBegin: number,
    msgCooldownTime: number,
    role?: Discord.Role | Discord.APIRole | null,
    totalGuesses?: number,
    guessedNumbers?: Set<number>
) => {
    const hasStarted = msTillBegin === 0;
    const timer = !hasStarted ? `Time Remaining till start: **${msToTime(msTillBegin)}**` : '**Lottery has started, get typing!**';

    const costString = entryCost > 0 ? `${entryCost}` : 'FREE';
    const roleMention = role ? `<@&${role.id}>` : '';

    const client = ClientManager.getInstance().getClient();
    const instanceConfig = getInstanceConfig();
    const descriptionLines = [
        `**Lottery Draw!** ${roleMention}`,
        '\n',
        `**Card: ${instanceConfig.getIconForRarity(cardDetails.rarityClass, cardDetails.series)} ${cardDetails.groupName} - ${cardDetails.memberName}**`,
        timer,
        '\n',
        '**Play Instructions:**',
        `- When the event begins type a number between 1-100 and send it to the bot (You can type up to 1 number every ${msToTime(msgCooldownTime)} seconds)`,
        `- Example: "<@${client.user?.id}> 10" to guess the number 10`,
        '- The first user to guess the correct number between 1-100 will win the card!',
        '\n',
        `**${costString} to enter the draw, will be deducted when you press join!**`
    ];

    if (users.size > 0) {
        const userStrList = [];
        for (const user of users) {
            userStrList.push(`<@${user}>`);
        }

        descriptionLines.push(`\n **Entered Users**: ${userStrList.join(',')}`);
    }

    if (totalGuesses) {
        descriptionLines.push(`\n **Total Guesses**: ${totalGuesses}`);
    }

    if (guessedNumbers && guessedNumbers.size > 0) {
        descriptionLines.push(`\n **Guessed Numbers**: ${Array.from(guessedNumbers).sort((a, b) => a - b).join(', ')}`);
    }

    const lotteryEmbed = new Discord.EmbedBuilder().setDescription(descriptionLines.join('\n'));

    const btnRow = createRowWithBtns([createBtn(`Join Lottery - ${costString}`, Discord.ButtonStyle.Success, JOIN_LOTTERY_BTN)]);

    return {
        embeds: [lotteryEmbed],
        components: hasStarted ? [] : [btnRow]
    };
};

interface LotteryPayload {
    channel: Discord.TextBasedChannel
    msgCooldownTime: number
    cardDetails: CardData
    lotteryUserIds: Set<string>
    startTime: number
    entryCost: number
    roleMention: Discord.Role | Discord.APIRole | null
    lotteryJoinCollector?: Discord.InteractionCollector<Discord.ButtonInteraction>
    lotteryGuessCollector?: Discord.MessageCollector
    lotteryEmbed?: Discord.Message
    lotteryInProgress?: boolean
    interval?: NodeJS.Timer
    totalGuesses: number
    selectedNumber: number
    guessedNumbers: Set<number>
    lastMessagePerUser: Record<string, number>
    terminationId?: string
};

export class LotteryManager {
    private static instance: LotteryManager;

    private isLotteryActive: boolean = false;
    private lotteryData: LotteryPayload | undefined;

    private constructor () {
        // Empty
    }

    private readonly getTimeRemaining = (startTime: number) => {
        const remaining = startTime - Date.now();
        return remaining > 0 ? remaining : 0;
    };

    private readonly updateEmbed = async (btnInteraction?: Discord.ButtonInteraction) => {
        if (!this.lotteryData) {
            return;
        }

        const { cardDetails, entryCost, lotteryUserIds, startTime, msgCooldownTime, roleMention, totalGuesses, guessedNumbers } = this.lotteryData;
        const updatedEmbed = createLotteryEmbed(cardDetails, entryCost, lotteryUserIds, this.getTimeRemaining(startTime), msgCooldownTime, roleMention, totalGuesses, guessedNumbers);
        if (btnInteraction) {
            await btnInteraction.update(updatedEmbed);
        } else {
            await this.lotteryData.lotteryEmbed?.edit(updatedEmbed);
        }
    };

    private readonly onLotteryUserGuess = async (message: Discord.Message) => {
        if (!this.lotteryData) {
            return;
        }

        const { msgCooldownTime } = this.lotteryData;
        const msgTimeMs = message.createdTimestamp;
        const lastMsg = this.lotteryData.lastMessagePerUser[message.author.id];
        const timeSinceLastMsg = msgTimeMs - lastMsg;

        let num = 0;
        const splitMessage = message.cleanContent.split(' ');
        for (const section of splitMessage) {
            const asInt = parseInt(section);
            if (!isNaN(asInt)) {
                num = asInt;
                break;
            }
        }

        if (timeSinceLastMsg <= msgCooldownTime) {
            const timeTillNextMsg = lastMsg + msgCooldownTime - msgTimeMs;
            await message.reply({
                content: `Too fast! Wait ${msToTime(timeTillNextMsg)}`
            });
            return;
        }

        if (num !== this.lotteryData.selectedNumber) {
            this.lotteryData.guessedNumbers.add(num);
            this.lotteryData.totalGuesses += 1;

            console.log(`Incorrect Guess ${message.author.username} - ${num}`);
            this.lotteryData.lastMessagePerUser[message.author.id] = msgTimeMs;
        } else {
            // Success
            this.lotteryData.guessedNumbers.add(num);
            this.lotteryData.totalGuesses += 1;

            console.log(`Correct Guess ${message.author.username} - ${num}`);
            this.lotteryData.lastMessagePerUser[message.author.id] = msgTimeMs;
            await message.react('<:Winner:1178791274891984956>');

            await this.closeAndAnnounceWinner(message.author.id);
        }
    };

    private readonly onLotteryBegin = async () => {
        if (!this.lotteryData) {
            return;
        }

        const { lotteryUserIds, channel } = this.lotteryData;

        this.lotteryData.selectedNumber = GenerateDrop.getInstance().generateNumberInRange(1, 100);
        console.log(`Lottery selected number: ${this.lotteryData.selectedNumber}`);

        const mentionUsers = Array.from(lotteryUserIds).map((id) => `<@${id}>`);
        await channel.send({
            content: `Lottery has begun start guessing: ${mentionUsers.join(', ')}`
        });

        const client = ClientManager.getInstance().getClient();
        const filter: Discord.MessageCollectorOptions['filter'] = (m) => {
            return lotteryUserIds.has(m.author.id) && m.mentions.has(client.user?.id ?? '');
        };

        const collector = channel.createMessageCollector({ filter });
        this.lotteryData.lotteryGuessCollector = collector;
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.lotteryData.interval = setInterval(this.updateEmbed, 1000);

        collector.on('collect', safeWrapperFn('lotteryGuess', this.onLotteryUserGuess));
    };

    private readonly onLotteryJoinAttempt = async (btnInteract: Discord.ButtonInteraction) => {
        if (btnInteract.user.bot || this.lotteryData === undefined || !this.isLotteryActive) {
            return;
        }

        const { lotteryUserIds, entryCost } = this.lotteryData;
        if (lotteryUserIds.has(btnInteract.user.id)) {
            await btnInteract.reply({
                content: 'Already entered into the lottery draw!',
                ephemeral: true
            });
            return;
        }

        // Check if user has balance
        const result = await CurrencyManager.getInstance().deduct(btnInteract.user.id, entryCost, 'Lottery');
        if (result === CurrencyResult.NOT_ENOUGH) {
            await btnInteract.reply({
                content: `Not enough balance to enter the lottery (amount required: ${entryCost})`,
                ephemeral: true
            });
        } else if (CurrencyResult.SUCCESS) {
            lotteryUserIds.add(btnInteract.user.id);
            await this.updateEmbed(btnInteract);
        } else {
            console.error(`Issue deducting money from user for lottery: ${btnInteract.user.id} ${result}`);
            await btnInteract.reply({
                content: 'Issue joining lottery, please try again later',
                ephemeral: true
            });
            return;
        }
    };

    private readonly closeAndAnnounceWinner = async (userId: string) => {
        // eslint-disable-next-line @typescript-eslint/prefer-optional-chain
        if (!this.lotteryData) {
            return;
        }

        const { channel, cardDetails, selectedNumber } = this.lotteryData;

        const descriptionLines = [
            `**Winner - <@${userId}>** with guess \`${selectedNumber}\``,
            `${CELEBRATE_ICON} **Congratulations** ${CELEBRATE_ICON}!`,
            'Lottery event has now ended!'
        ];
        const winEmbed = new Discord.EmbedBuilder().setDescription(descriptionLines.join('\n'));

        await channel.send({
            embeds: [winEmbed]
        });
        await addCardToInventory(userId, cardDetails.id,
            {
                reason: 'Won lottery',
                soulbound: false
            });
        await AuditLogHandler.getInstance().publishAuditMessage('Lottery', userId, [`User won card ${cardDetails.id} through lottery!`]);

        this.isLotteryActive = false;
        await this.endLottery('Lottery has ended');
    };

    private readonly onLotteryWaitInterval = async () => {
        if (this.lotteryData === undefined || !this.isLotteryActive) {
            return;
        }

        await this.updateEmbed();
        const { startTime, lotteryUserIds } = this.lotteryData;
        const timeRemaining = this.getTimeRemaining(startTime);

        if (timeRemaining === 0) {
            if (lotteryUserIds.size === 0) {
                await this.endLottery('No users joined lottery');
            } else {
                // Begin lottery
                this.lotteryData.lotteryInProgress = true;
                this.lotteryData.lotteryJoinCollector?.stop('Lottery has started');

                await this.onLotteryBegin();
            }
        }
    };

    private async sendJoinMessageToChannel () {
        if (!this.lotteryData) {
            throw new Error('Cannot send join message with undefined lottery payload');
        }

        const { channel, cardDetails, lotteryUserIds, startTime, entryCost, msgCooldownTime, roleMention } = this.lotteryData;
        const lotteryEmbed = await channel.send(createLotteryEmbed(cardDetails, entryCost, lotteryUserIds, this.getTimeRemaining(startTime), msgCooldownTime, roleMention));
        this.lotteryData.lotteryEmbed = lotteryEmbed;

        const imageMsg = await channel.send({
            content: cardDetails.imageUrl
        });

        const collector = this.lotteryData.lotteryEmbed.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 600_000 });

        const collectorId = CollectorHolder.getInstance().addCollector(collector);
        collector.on('collect', safeWrapperFn('lotteryJoin', this.onLotteryJoinAttempt));
        collector.on('end', async (_, reason) => {
            if (this.lotteryData?.interval) {
                clearInterval(this.lotteryData.interval);
                this.lotteryData.interval = undefined;
            }
            CollectorHolder.getInstance().removeCollector(collectorId);
            if (!this.lotteryData?.lotteryInProgress) {
                await imageMsg.delete();
                await lotteryEmbed.edit({
                    embeds: [],
                    components: [],
                    content: `Lottery has been cancelled due to: ${codeItem(reason)}`
                });
            }
        });
        this.lotteryData.lotteryJoinCollector = collector;
    }

    private readonly refundAllEnteredUsers = async () => {
        if (!this.lotteryData) {
            return;
        }

        const { entryCost, lotteryUserIds, channel } = this.lotteryData;
        if (entryCost > 0) {
            for (const user of lotteryUserIds) {
                await CurrencyManager.getInstance().deposit(user, entryCost, 'Refund lottery entry cost');
            }
        }
        await channel.send({ content: 'All lottery participants were refunded, due to manual close.' });
    };

    public async startLottery (lotteryData: LotteryPayload): Promise<void> {
        this.lotteryData = lotteryData;
        this.isLotteryActive = true;
        await this.sendJoinMessageToChannel();

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.lotteryData.terminationId = TerminationManager.getInstance().addTerminationListener(async () => {
            await this.endLottery('Bot is shutting down');
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.lotteryData.interval = setInterval(this.onLotteryWaitInterval, 1000);
    }

    public async endLottery (reason: string): Promise<void> {
        if (!this.lotteryData) {
            return;
        }

        if (this.lotteryData.terminationId) {
            TerminationManager.getInstance().removeTerminationListener(this.lotteryData.terminationId);
            this.lotteryData.terminationId = undefined;
        }

        if (this.lotteryData.interval) {
            clearInterval(this.lotteryData.interval);
            this.lotteryData.interval = undefined;
        }
        if (this.lotteryData.lotteryUserIds.size > 0 && this.isLotteryActive) {
            await this.refundAllEnteredUsers();
        }
        this.isLotteryActive = false;

        this.lotteryData.lotteryGuessCollector?.stop(reason);
        this.lotteryData.lotteryJoinCollector?.stop(reason);

        this.lotteryData = undefined;
    }

    public getIsLotteryActive (): boolean {
        return this.isLotteryActive;
    }

    public static getInstance (): LotteryManager {
        if (!LotteryManager.instance) {
            LotteryManager.instance = new LotteryManager();
        }
        return LotteryManager.instance;
    }
}

const COMMAND_NAME = 'lottery';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    isPublicCommand: false,
    subCommandOf: EVENT_SECTION,
    options: [
        {
            name: 'seconds_till_begin',
            description: 'Time till the lottery begins after opening',
            required: true,
            type: 'NUMBER'
        },
        {
            name: 'card_id',
            description: 'The card you wish the user to receive on winning (leave blank for random)',
            required: false,
            type: 'NUMBER'
        },
        {
            name: 'guess_cooldown_seconds',
            description: 'The number of seconds between guesses',
            required: false,
            type: 'NUMBER'
        },
        {
            name: 'entry_cost',
            description: 'The cost to purchase a lottery ticket',
            required: false,
            type: 'NUMBER'
        },
        {
            name: 'role_mention',
            description: 'The role to mention when sending out the event',
            required: false,
            type: 'ROLE'
        }
    ],
    description: 'Start a lottery draw',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        if (!interaction.isRepliable() || interaction.replied) {
            return;
        }

        const cardId = interaction.options.getNumber('card_id') ?? 1;
        const secondsTillBegin = interaction.options.getNumber('seconds_till_begin') ?? 0;
        const guessCooldownSeconds = interaction.options.getNumber('guess_cooldown_seconds') ?? 10;
        const entryCost = interaction.options.getNumber('entry_cost') ?? 200;
        const roleMention = interaction.options.getRole('role_mention');
        const cardDetails = await CardCache.getInstance().getCardDetails(cardId);

        if (!cardDetails) {
            await interaction.reply({
                content: 'Could not get details of the card',
                ephemeral: true
            });
            return;
        }
        if (secondsTillBegin === 0) {
            await interaction.reply({
                content: 'seconds till begin needs to be greater than zero!',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply();
        await interaction.deleteReply();

        const startTime = Date.now() + (secondsTillBegin * 1000);

        const lotteryUserIds = new Set<string>();
        const channel = interaction.channel;

        if (!channel || !channel?.isTextBased() || interaction.channel.isDMBased()) {
            await interaction.reply({
                content: 'Lottery can only be run in text channels (and not in DMs)',
                ephemeral: true
            });
            return;
        }

        // FIXME: Have a creator that defaults a bunch of this stuff
        const lotteryPayload: LotteryPayload = {
            channel,
            cardDetails,
            lotteryUserIds,
            startTime,
            entryCost,
            msgCooldownTime: guessCooldownSeconds * 1000,
            roleMention,
            totalGuesses: 0,
            selectedNumber: 0,
            guessedNumbers: new Set<number>(),
            lastMessagePerUser: {}
        };
        await LotteryManager.getInstance().startLottery(lotteryPayload);
    }
};

export default command;
