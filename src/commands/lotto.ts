import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { LotteryManager } from './admin/lottery/lottery'
import { string } from 'pg-escape';

const command: CommandInterface = {
    name: 'lotto',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Join the current lotto!',
    options: [
        {
            name: 'numbers',
            description: 'Enter three numbers(1-100) seperated by spaces',
            required: true,
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const numbersString = interaction.options.getString('numbers')
        
        const lotteryManager = LotteryManager.getInstance()

        if (!lotteryManager.getIsLotteryActive()) {
            await interaction.reply({
                content: "No active lottery. Please wait for the next event.",
                ephemeral: true
            })
            return
        }

        if (lotteryManager.hasUserJoined(interaction.user.id)) {
            await interaction.reply({
                content: "You already have joined this lottery!",
                ephemeral: true
            })
            return
        }

        if (numbersString === null) {
            await interaction.reply({
                content: "Must provide three numbers between 1-100.",
                ephemeral: true
            })
            return
        }

        try {
            const numbers = numbersString.split(/[, ]+/).map(item => {
                const num = Number(item.trim())
                if (isNaN(num) || num < 1 || num > 100) {
                    throw new String("Must provide three numbers between 1-100.")
                }
                return num
            })
            
            if (numbers.length != 3) {
                throw new String("Must provide three numbers between 1-100.")
            }

            await lotteryManager.addUser(interaction.user, numbers)
        } catch (e) {
            if (e instanceof String) {
                await interaction.reply({
                    content: e.valueOf(),
                    ephemeral: true
                })
            } else {
                console.log(e)
            }
            return
        }
        

        const content = 'Entered into lotto with numbers: ' + numbersString
        await interaction.reply({
            content: content,
            ephemeral: true
        })
    }
};

export default command;
