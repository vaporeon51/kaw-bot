import { Client } from 'unb-api';
import Configuration from '../Configuration';
import { CurrencyResult, type ICurrencySource } from './Currency';

export default class UnbelievaBoat implements ICurrencySource {
    private static instance: UnbelievaBoat;
    private readonly unbClient: Client;
    private readonly guildId: string;

    constructor () {
        const config = Configuration.getInstance().getConfig();
        this.guildId = config.guildId;
        this.unbClient = new Client(config.unbelievaBoatToken);
    }

    async deposit (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const balance = await this.balanceInternal(userId);
        if (balance === null) {
            return CurrencyResult.ERROR;
        }

        const cash = balance.cash;
        const bank = balance.bank + amount;
        const setResult = await this.setInternal(userId, cash, bank, reason);
        if (setResult !== null) {
            return CurrencyResult.SUCCESS;
        }
        return CurrencyResult.ERROR;
    }

    async deduct (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const balance = await this.balanceInternal(userId);
        if (balance === null) {
            return CurrencyResult.ERROR;
        }

        if ((balance.bank + balance.cash) < amount) {
            return CurrencyResult.NOT_ENOUGH;
        }

        let takenFromBank = 0;
        const takenFromCash = balance.cash > 0 ? Math.min(amount, balance.cash) : 0;
        if (takenFromCash !== amount) {
            const amountLeft = amount - takenFromCash;
            takenFromBank = balance.bank > 0 ? Math.min(amountLeft, balance.bank) : 0;
        }
        const resultingBalance = {
            bank: balance.bank - takenFromBank,
            cash: balance.cash - takenFromCash
        };
        const setResult = await this.setInternal(userId, resultingBalance.cash, resultingBalance.bank, reason);
        if (setResult !== null) {
            return CurrencyResult.SUCCESS;
        }
        return CurrencyResult.ERROR;
    }

    async set (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const result = await this.unbClient.setUserBalance(this.guildId, userId, { cash: 0, bank: amount }, reason).catch((e) => {
            console.error(`Failed to get user balance: ${userId} ${e}`);
            return null;
        });
        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return CurrencyResult.SUCCESS;
    }

    async setInternal (userId: string, cash: number, bank: number, reason: string): Promise<CurrencyResult> {
        const result = await this.unbClient.setUserBalance(this.guildId, userId, { cash, bank }, reason).catch((e) => {
            console.error(`Failed to set user balance: ${userId} ${e}`);
            return null;
        });
        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return CurrencyResult.SUCCESS;
    }

    private async balanceInternal (userId: string) {
        const result = await this.unbClient.getUserBalance(this.guildId, userId).catch((e) => {
            console.error(`failed to get user balance: ${userId} ${e}`);
            return null;
        });
        if (result === null) {
            return null;
        }
        return {
            cash: result.cash,
            bank: result.bank
        };
    }

    async balance (userId: string): Promise<number | CurrencyResult> {
        const result = await this.unbClient.getUserBalance(this.guildId, userId).catch((e) => {
            console.error(`failed to get user balance: ${userId} ${e}`);
            return null;
        });
        if (result === null) {
            return CurrencyResult.ERROR;
        }

        return result.cash + result.bank;
    }

    public static getInstance (): UnbelievaBoat {
        if (!UnbelievaBoat.instance) {
            UnbelievaBoat.instance = new UnbelievaBoat();
        }
        return UnbelievaBoat.instance;
    }
}
