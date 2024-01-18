import DbConnectionHandler from '../DbConnectionHandler';
import { CurrencyResult, type ICurrencySource } from './Currency';
import * as escape from 'pg-escape';

export default class CustomCurrency implements ICurrencySource {
    private readonly currencyName: string;
    private readonly tableName: string;

    constructor (currencyName: string, tableName: string) {
        this.currencyName = currencyName;
        this.tableName = tableName;
    }

    async deposit (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const sql = `UPDATE ${this.tableName}
            SET value = value + ${amount}
            SET last_change_reason = ${escape.literal(reason)}
        WHERE user_id = ${escape.literal(userId)}`;

        const result = await DbConnectionHandler.getInstance().executeSQL(sql).catch((e) => {
            console.error(`Failed to deposit to user balance: ${userId} ${e}`);
            return null;
        });

        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return CurrencyResult.SUCCESS;
    }

    async deduct (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const currBalance = await this.balance(userId);
        if (typeof currBalance !== 'number') {
            return currBalance;
        }

        if (currBalance < amount) {
            return CurrencyResult.NOT_ENOUGH;
        }

        const sql = `UPDATE ${this.tableName}
            SET value = value - ${amount}
            SET last_change_reason = ${escape.literal(reason)}
        WHERE user_id = ${escape.literal(userId)}`;

        const result = await DbConnectionHandler.getInstance().executeSQL(sql).catch((e) => {
            console.error(`Failed deduct user balance: ${userId} ${e}`);
            return null;
        });

        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return CurrencyResult.SUCCESS;
    }

    async set (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        const sql = `UPDATE ${this.tableName}
            SET value = ${amount}
            SET last_change_reason = ${escape.literal(reason)}
        WHERE user_id = ${escape.literal(userId)}`;

        const result = await DbConnectionHandler.getInstance().executeSQL(sql).catch((e) => {
            console.error(`Failed to set balance: ${userId} ${e}`);
            return null;
        });

        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return CurrencyResult.SUCCESS;
    }

    async balance (userId: string): Promise<number | CurrencyResult> {
        const sql = `SELECT value FROM ${this.tableName}
        WHERE user_id = ${escape.literal(userId)}`;

        const result = await DbConnectionHandler.getInstance().executeSQL(sql).catch((e) => {
            console.error(`Failed to set balance: ${userId} ${e}`);
            return null;
        });

        if (result === null) {
            return CurrencyResult.ERROR;
        }
        return result.rows[0].value;
    }
}
