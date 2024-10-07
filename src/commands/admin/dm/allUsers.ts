import * as Discord from 'discord.js';
import ClientManager from '../../../services/ClientManager'
import { type CommandInterface } from '../../../services/CommandInteractionManager';
import { JJ_DISCORD_ID } from '../../../cardConstants';
import { DM_SECTION } from './_dm';
import { safeWrapperFn } from '../../../common/safeCollector';
import { CollectorHolder } from '../../../services/CollectorHolder'
import { getAllUserIds } from '../../../db/users'

const COMMAND_NAME = 'all_users';
const command: CommandInterface = {
    name: COMMAND_NAME,
    dmAllowed: false,
    subCommandOf: DM_SECTION,
    isPublicCommand: false,
    description: "DM's all users who have ever used the bot",
    options: [
        {
            name: "message",
            description: "Message to send to all users",
            required: true,
            type: 'STRING'
        }
    ],
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        if (interaction.user.id !== JJ_DISCORD_ID) {
            await interaction.reply({
                content: 'Insufficent permissions for this command',
                ephemeral: true
            });
            return;
        }
        const message = interaction.options.getString('message') ?? ""
        if (message === "") {
            interaction.reply({
                content: "Must have a message"
            })
        }

        const allUserIds = await getAllUserIds()

        if (allUserIds === null) {
            interaction.reply({
                content: "No users in database to deliver to"
            })
            return;
        }
        
        const row = new Discord.ActionRowBuilder<Discord.ButtonBuilder>()
            .addComponents(
                new Discord.ButtonBuilder()
                    .setCustomId('confirm')
                    .setLabel('Confirm')
                    .setStyle(Discord.ButtonStyle.Success),
                new Discord.ButtonBuilder()
                    .setCustomId('decline')
                    .setLabel('Decline')
                    .setStyle(Discord.ButtonStyle.Danger),
            );

        const response = await interaction.reply({
            content: message + "\n" + allUserIds.length,
            components: [row]
        });

        const collector = response.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 60000 });
        const collectorId = CollectorHolder.getInstance().addCollector(collector);

        
        const onBtnClick = async (btnInteraction: Discord.ButtonInteraction) => {
            if(btnInteraction.user.id != interaction.user.id) {
                await btnInteraction.reply({
                    content: "You do not have permissions to perform that action",
                    ephemeral: true
                })
                return;
            }

            const client = ClientManager.getInstance().getClient()

            if(btnInteraction.customId == "confirm") {
                await btnInteraction.deferReply()
                for (const userId of allUserIds) {
                    const user = await client.users.fetch(userId)
                    
                    try {
                        await user.send({
                            content: message
                        })
                    } catch (e) {
                        console.error(`Error occurred: sendDM => ${e} ${(e as any).stack}`);
                    }
                }
                await btnInteraction.editReply({
                    content: "All users DM completed"
                })
                interaction.editReply({
                    content: "Sent:\n" + message + "\nTo:" + allUserIds.length,
                    components: []
                })
                collector.stop('selection_made')
            } else if (btnInteraction.customId == "decline") {
                await btnInteraction.reply({
                    content: "All users DM cancelled"
                })
                collector.stop('cancelled')
            }
        }

        const onCollectorClose = async (_: Discord.Collection<string, Discord.ButtonInteraction>, reason: string) => {
            CollectorHolder.getInstance().removeCollector(collectorId);
            if (reason === 'time') {
                await interaction.editReply({
                    content: 'Request has timed out, please select within 30 seconds',
                    components: []
                })
            } else if (reason === 'cancelled') {
                await interaction.editReply({
                    content: 'Cancelled',
                    components: []
                })
            } else if (reason !== 'selection_made') {
                await interaction.editReply({
                    content: 'Bot is shutting down, please try again later!',
                    components: []
                })
            }
        }

        collector.on('collect', safeWrapperFn('onBtnClick', onBtnClick))
        collector.on('end', safeWrapperFn('onCollectorClose', onCollectorClose))
    }
};

export default command;
