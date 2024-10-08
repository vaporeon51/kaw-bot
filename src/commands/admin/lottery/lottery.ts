import { type CardData } from '../../../db/cards';
import CardCache from '../../../services/CardCache';
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import * as Discord from 'discord.js';
import { msToTime } from '../../../utils';
import GenerateDrop from '../../../services/GenerateDrop';
import { TerminationManager } from '../../../services/TerminationManager';
import { addCardToInventory } from '../../../db/users';
import AuditLogHandler from '../../../services/AuditLogHandler';
import { CurrencyManager, CurrencyResult } from '../../../services/currency/Currency';
import { getInstanceConfig } from '../../../config/config';
import { EVENT_SECTION } from './_events';
import { CELEBRATE_ICON } from '../../../cardConstants';

const createLotteryEmbed = (
    cardDetails: CardData,
    entryCost: number,
    users: Set<string>,
    msTillBegin: number,
    role?: Discord.Role | Discord.APIRole | null,
) => {
    const hasStarted = msTillBegin === 0;
    const timer = !hasStarted ? `Time Remaining to join: **${msToTime(msTillBegin)}**` : '**Lottery has ended, join us next time!**';

    const costString = entryCost > 0 ? `${entryCost}` : 'FREE';
    const roleMention = role ? `<@&${role.id}>` : '';

    const instanceConfig = getInstanceConfig();
    const descriptionLines = [
        `**Lottery Draw!** ${roleMention}`,
        '\n',
        `**Card: ${instanceConfig.getIconForRarity(cardDetails.rarityClass, cardDetails.series)} ${cardDetails.groupName} - ${cardDetails.memberName}**`,
        timer,
        '\n',
        '**Play Instructions:**',
        '- Use the /lotto command and enter three numbers 1-100 seperated by spaces or commas',
        '- When the entry period ends the correct guess will be announced',
        '- All users who guess the number will win the card!',
        '\n',
        `**Entry Fee: ${costString}, will be deducted when you use /lotto!**`
    ];

    if (users.size > 0) {
        const userStrList = [];
        for (const user of users) {
            userStrList.push(`<@${user}>`);
        }

        descriptionLines.push(`\n **Entered Users**: ${userStrList.join(',')}`);
    }

    const lotteryEmbed = new Discord.EmbedBuilder().setDescription(descriptionLines.join('\n'));

    return {
        embeds: [lotteryEmbed],
    };
};

interface LotteryPayload {
    channel: Discord.TextBasedChannel
    cardDetails: CardData
    lotteryUserIds: Set<string>
    lotteryGuesses: Record<number, Set<string>>
    endTime: number
    entryCost: number
    roleMention: Discord.Role | Discord.APIRole | null
    lotteryJoinCollector?: Discord.InteractionCollector<Discord.ButtonInteraction>
    lotteryGuessCollector?: Discord.MessageCollector
    lotteryEmbed?: Discord.Message
    lotteryImageMsg?: Discord.Message
    interval?: NodeJS.Timer
    selectedNumbers: Set<number>
    terminationId?: string
};

export class LotteryManager {
    private static instance: LotteryManager;

    private isLotteryActive: boolean = false;
    private lotteryData: LotteryPayload | undefined;

    private constructor () {
        // Empty
    }

    private readonly getTimeRemaining = (endTime: number) => {
        const remaining = endTime - Date.now();
        return remaining > 0 ? remaining : 0;
    };

    private readonly updateEmbed = async () => {
        if (!this.lotteryData) {
            return;
        }

        const { cardDetails, entryCost, lotteryUserIds, endTime, roleMention } = this.lotteryData;
        const updatedEmbed = createLotteryEmbed(cardDetails, entryCost, lotteryUserIds, this.getTimeRemaining(endTime), roleMention);
        await this.lotteryData.lotteryEmbed?.edit(updatedEmbed);
    };

    private readonly onLotteryBegin = async () => {
        if (!this.lotteryData) {
            return;
        }

        const { lotteryGuesses, channel, cardDetails, selectedNumbers } = this.lotteryData;

        while (selectedNumbers.size != 3) {
            selectedNumbers.add(GenerateDrop.getInstance().generateNumberInRange(1, 100))
        }

        console.log(`Lottery selected numbers: ${[...selectedNumbers]}`);

        const winningUsersSet = new Set<string>()
        for (const num of selectedNumbers) {
            if (lotteryGuesses[num]) {
                for (const user of lotteryGuesses[num]) {
                    winningUsersSet.add(user)
                }
            }
        }

        if (winningUsersSet.size === 0) {
            await channel.send({
                content: `No one guessed any of ${[...selectedNumbers].sort((a, b) => a - b)}. Therefore there's no Winner for this Lottery. We'll see you again.`
            })
        } else {
            const winningUsers = Array.from(winningUsersSet)
            const mentionWinners = winningUsers.map((id) => `<@${id}>`)
            
            const descriptionLines = [
                `**Winners - ${mentionWinners.join(', ')}** the numbers were \`${[...selectedNumbers].sort()}\``,
                `${CELEBRATE_ICON} **Congratulations** ${CELEBRATE_ICON}!`,
                'Lottery event has now ended!'
            ];
            const winEmbed = new Discord.EmbedBuilder().setDescription(descriptionLines.join('\n'));

            await channel.send({
                embeds: [winEmbed]
            });
        
            winningUsers.forEach(async (id) => {
                await addCardToInventory(id, cardDetails.id,
                    {
                        reason: 'Won lottery',
                        soulbound: false
                    });

                await AuditLogHandler.getInstance().publishAuditMessage('Lottery', id, [`User won card ${cardDetails.id} through lottery!`]);
            })
        }

        this.isLotteryActive = false

        await this.endLottery();
    };

    public readonly addUser = async (user: Discord.User, guesses: number[]) => {
        if (user.bot || this.lotteryData === undefined || !this.isLotteryActive) {
            throw new Error("No active lottery");
        }

        const { lotteryUserIds, lotteryGuesses, entryCost } = this.lotteryData;

        if (lotteryUserIds.has(user.id) || guesses.length != 3) {
            throw new Error("You already have joined this lottery!")
        }

        const result = await CurrencyManager.getInstance().deduct(user.id, entryCost, 'Lottery');

        // Check if user has balance
        if (result === CurrencyResult.NOT_ENOUGH) {
            throw new Error(`Not enough balance to enter the lottery (amount required: ${entryCost})`)
        } else if (CurrencyResult.SUCCESS) {
            lotteryUserIds.add(user.id);
            guesses.forEach((num) => {
                if (!lotteryGuesses[num]) {
                    lotteryGuesses[num] = new Set();
                }
                lotteryGuesses[num].add(user.id)
            })
            console.log(`User: ${user.id} entered lotto with ${guesses}`)
            await this.updateEmbed();
        } else {
            console.error(`Issue deducting money from user for lottery: ${user.id} ${result}`);
            throw new Error('Issue joining lottery, please try again later')
        }
    }

    private readonly onLotteryWaitInterval = async () => {
        if (this.lotteryData === undefined || !this.isLotteryActive) {
            return;
        }

        await this.updateEmbed();
        const { endTime, lotteryUserIds } = this.lotteryData;
        const timeRemaining = this.getTimeRemaining(endTime);

        if (timeRemaining === 0) {
            this.isLotteryActive = false
            if (lotteryUserIds.size === 0) {
                await this.endLottery();
            } else {
                // Begin lottery
                if (this.lotteryData.interval) {
                    clearInterval(this.lotteryData.interval);
                    this.lotteryData.interval = undefined
                }
                await this.onLotteryBegin();
            }
        }
    };

    private async sendJoinMessageToChannel () {
        if (!this.lotteryData) {
            throw new Error('Cannot send join message with undefined lottery payload');
        }

        const { channel, cardDetails, lotteryUserIds, endTime, entryCost, roleMention } = this.lotteryData;
        const lotteryEmbed = await channel.send(createLotteryEmbed(cardDetails, entryCost, lotteryUserIds, this.getTimeRemaining(endTime), roleMention));
        this.lotteryData.lotteryEmbed = lotteryEmbed;

        const imageMsg = await channel.send({
            content: cardDetails.imageUrl
        });

        this.lotteryData.lotteryImageMsg = imageMsg
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
        if (this.isLotteryActive === true) {
            return
        }

        this.lotteryData = lotteryData;
        this.isLotteryActive = true;
        await this.sendJoinMessageToChannel();

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.lotteryData.terminationId = TerminationManager.getInstance().addTerminationListener(async () => {
            await this.endLottery();
        });

        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        this.lotteryData.interval = setInterval(this.onLotteryWaitInterval, 1000);
    }

    public async endLottery (): Promise<void> {
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
        if (this.isLotteryActive) {
            if (this.lotteryData.lotteryUserIds.size > 0) {
                await this.refundAllEnteredUsers();
            }
            await this.lotteryData.lotteryImageMsg?.delete()
            await this.lotteryData.lotteryEmbed?.edit({
                embeds: [],
                components: [],
                content: `Lottery has been cancelled`
            })
        }
        this.isLotteryActive = false;

        this.lotteryData = undefined;
    }

    public hasUserJoined (id: string): boolean {
        return this.lotteryData?.lotteryUserIds.has(id) ?? true
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
            name: 'minutes_till_begin',
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
        const minutesTillBegin = interaction.options.getNumber('minutes_till_begin') ?? 0;
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
        if (minutesTillBegin === 0) {
            await interaction.reply({
                content: 'Minutes till begin needs to be greater than zero!',
                ephemeral: true
            });
            return;
        }
        if (LotteryManager.getInstance().getIsLotteryActive()) {
            await interaction.reply({
                content: 'Already an active lottery',
                ephemeral: true
            })
            return
        }

        await interaction.deferReply();
        await interaction.deleteReply();

        const endTime = Date.now() + (minutesTillBegin* 60 * 1000);

        const lotteryUserIds = new Set<string>();
        const lotteryGuesses: Record<number, Set<string>> = {};
        const selectedNumbers = new Set<number>();
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
            lotteryGuesses,
            endTime,
            entryCost,
            roleMention,
            selectedNumbers,
        };
        await LotteryManager.getInstance().startLottery(lotteryPayload);
    }
};

export default command;
