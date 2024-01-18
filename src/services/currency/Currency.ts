import { getInstanceConfig } from '../../config/config';
import { CurrencyType } from '../../config/types';
import CustomCurrency from './CustomCurrency';
import UnbelievaBoat from './UnbelievaBoat';

export enum CurrencyResult {
    ERROR = 'ERROR',
    NOT_ENOUGH = 'NOT_ENOUGH',
    SUCCESS = 'SUCESS'
}

export abstract class ICurrencySource {
    abstract deposit (userId: string, amount: number, reason: string): Promise<CurrencyResult>;
    abstract deduct (userId: string, amount: number, reason: string): Promise<CurrencyResult>;
    abstract set (userId: string, amount: number, reason: string): Promise<CurrencyResult>;
    abstract balance (userId: string): Promise<number | CurrencyResult>;
}

export class CurrencyManager implements ICurrencySource {
    private readonly currencySource: ICurrencySource;
    private static instance: CurrencyManager;

    private constructor () {
        const type = getInstanceConfig().currencyType;

        switch (type) {
            case CurrencyType.UNBELIEVABOAT:
                this.currencySource = UnbelievaBoat.getInstance();
                break;
            case CurrencyType.CUSTOM:
                this.currencySource = new CustomCurrency('Karma', 'karma_to_user');
                break;
        }
    }

    async deposit (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        return await this.currencySource.deposit(userId, amount, reason);
    }

    async deduct (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        return await this.currencySource.deduct(userId, amount, reason);
    }

    async set (userId: string, amount: number, reason: string): Promise<CurrencyResult> {
        return await this.currencySource.set(userId, amount, reason);
    }

    async balance (userId: string): Promise<number | CurrencyResult> {
        return await this.currencySource.balance(userId);
    }

    public static getInstance (): CurrencyManager {
        if (!CurrencyManager.instance) {
            CurrencyManager.instance = new CurrencyManager();
        }
        return CurrencyManager.instance;
    }
}
