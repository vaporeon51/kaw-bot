import * as fs from 'fs';
import 'dotenv/config';
import GenerateDrop from '../../services/GenerateDrop';

const obj: Record<string, Record<string, number>> = {};
export const generateCards = async () => {
    const instance = GenerateDrop.getInstance();
    for (let i = 0; i < 1_000_000; i++) {
        const card = await instance.getCardToDrop();

        if (!obj[card.rarityClass]) {
            obj[card.rarityClass] = {};
        }

        if (obj[card.rarityClass][card.id]) {
            obj[card.rarityClass][card.id] += 1;
        } else {
            obj[card.rarityClass][card.id] = 1;
        }
        console.log(i);
    }
    fs.writeFileSync('./uniformTest.json', JSON.stringify(obj, null, 2));
    console.log('Saved. done');
};

const start = async () => {
    await generateCards();
};

void start();
