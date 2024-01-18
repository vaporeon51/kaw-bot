import * as Discord from 'discord.js';
import CommandInteractionManager, { type ExecutableCommandBase, type CommandInterface } from '../services/CommandInteractionManager';
import { handleListBasedEmbed, type Page } from '../common/listBasedEmbed';

const PAGINATION_SIZE = 10.0;
export const generatePagesBasedOnCommands = (commands: CommandInterface[]) => {
    const pages: Page[] = [];
    const totalPages = Math.max(Math.ceil(commands.length / PAGINATION_SIZE), 1);
    for (let i = 1; i <= totalPages; i++) {
        pages.push(generateHelpEmbed(commands, totalPages, i));
    }
    return pages;
};

export function generateHelpEmbed (commands: CommandInterface[], totalPages: number, page = 1) {
    if (commands.length === 0 && page === 1) {
        return {
            ephemeral: true,
            components: [],
            embeds: [new Discord.EmbedBuilder().setDescription('No commands available.')]
        };
    }

    const descriptionLines = [];

    const pageStart = (page - 1) * PAGINATION_SIZE;
    const pageEnd = page * PAGINATION_SIZE;

    for (let i = pageStart; i < pageEnd; i++) {
        // Exceeded size of array
        const command = commands[i];
        if (i >= commands.length) {
            continue;
        }
        if (!('name' in command)) {
            continue; // Skip subcommands
        }

        const prefix = 'subCommandOf' in command ? `${command.subCommandOf} ` : '';
        const fullName = `${prefix}${command.name}`;

        const commandName = `**\`${fullName}\`**`;
        const commandDesc = `${command.description}`;
        const helpLine = `${commandName} - ${commandDesc}`;
        descriptionLines.push(helpLine);
    }

    const inventoryEmbed = new Discord.EmbedBuilder()
        .setTitle('Help')
        .setDescription(descriptionLines.join('\n'))
        .setFooter({
            text: `Page ${page}/${totalPages}`
        });

    return {
        embeds: [inventoryEmbed]
    };
}

const command: CommandInterface = {
    name: 'help',
    dmAllowed: false,
    isPublicCommand: true,
    description: 'Show list of commands and their purpose',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const commandLoader = CommandInteractionManager.getInstance();
        const commands: ExecutableCommandBase[] = Object.values(commandLoader.commmands)
            .filter((command) => {
                return 'name' in command && command.isPublicCommand;
            }) as ExecutableCommandBase[];

        commands.sort((a, b) => {
            if (a.isPublicCommand && !b.isPublicCommand) {
                return -1;
            }

            if (b.isPublicCommand && !a.isPublicCommand) {
                return 1;
            }

            const getFullName = (command: ExecutableCommandBase) => {
                const prefix = 'subCommandOf' in command ? `${command.subCommandOf} ` : '';
                const fullName = `${prefix}${command.name}`;
                return fullName;
            };

            return getFullName(a).localeCompare(getFullName(b));
        });

        const pages = generatePagesBasedOnCommands(commands);
        await handleListBasedEmbed(interaction, interaction.user.id, pages, 'Message expired use /help again', { ephemeral: true });
    }
};

export default command;
