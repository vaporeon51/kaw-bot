import * as fs from 'fs';
import * as path from 'path';
import * as Discord from 'discord.js';
import AuditLogHandler, { JJ_AUDIT_CONTACT_LINE } from './AuditLogHandler';
import Configuration from './Configuration';
import { NEXT_CUSTOM_ID, PREVIOUS_CUSTOM_ID } from '../common/listBasedEmbed';
import { addUserToDatabaseIfNotPresent } from '../db/users';
import { TerminationManager } from './TerminationManager';

interface OptionInterface {
    type: 'STRING' | 'NUMBER' | 'USER' | 'ROLE' | 'CHANNEL' | 'BOOLEAN'
    choices?: Array<string | number>
    name: string
    description: string
    required: boolean
};

export interface ExecutableCommandBase {
    name: string
    description: string
    options?: OptionInterface[]
    isPublicCommand: boolean
    /**
     * If true, the user lock will be released after the execute function finishes
     * If false, the command will need to manually release the lock
     */
    finishAfterExecute?: boolean
    dmAllowed: boolean
    execute: (interaction: Discord.ChatInputCommandInteraction) => Promise<void>
}

type SimpleCommand = ExecutableCommandBase & ExecutableCommandBase;

interface CommandInterfaceRootGroup {
    groupName: string
    description: string
};

type CommandInterfaceRootCommand = {
    groupName: string
} & ExecutableCommandBase & ExecutableCommandBase;

type CommandInterfaceChildCommand = {
    subCommandOf: string
} & ExecutableCommandBase & ExecutableCommandBase;

interface CommandInterfaceGroupCommand {
    groupName: string
    description: string
    subCommandOf: string
}

export type CommandInterface = SimpleCommand | CommandInterfaceRootGroup | CommandInterfaceRootCommand | CommandInterfaceGroupCommand | CommandInterfaceChildCommand;

export interface GlobalButtonInterface {
    customId: string
    isPrefix: boolean
    execute: (interaction: Discord.ButtonInteraction, prefixResult: string) => Promise<void>
}

type SlashCommandOptionSupported = Discord.SlashCommandStringOption |
Discord.SlashCommandNumberOption |
Discord.SlashCommandUserOption |
Discord.SlashCommandRoleOption |
Discord.SlashCommandBooleanOption |
Discord.SlashCommandChannelOption;

export default class CommandInteractionManager {
    private static loader: CommandInteractionManager;

    private readonly userLocks: Record<string, boolean> = {};
    public readonly commmands: Record<string, CommandInterface>;
    public readonly buttonInteractions: Record<string, GlobalButtonInterface>;
    public readonly expectedLocalButtonIds: Set<string> = new Set<string>([NEXT_CUSTOM_ID, PREVIOUS_CUSTOM_ID]);

    public readonly commandNameToId: Record<string, string> = {};

    constructor () {
        this.commmands = this.getAllCommands();
        this.buttonInteractions = this.getAllButtonInteractions();
    }

    private readonly registerOption = <T extends SlashCommandOptionSupported>(option: T, optionInterface: OptionInterface): T => {
        option.setName(optionInterface.name);
        option.setDescription(optionInterface.description);
        option.setRequired(optionInterface.required);
        return option;
    };

    private readonly registerChoices = (option: Discord.SlashCommandStringOption | Discord.SlashCommandNumberOption, optionInterface: OptionInterface) => {
        if (optionInterface.choices) {
            const mappedChoices = optionInterface.choices.map((item) => {
                const choiceObj: Discord.APIApplicationCommandOptionChoice = {
                    name: item.toString(),
                    value: item
                };
                return choiceObj;
            });
            option.addChoices(...(mappedChoices) as any);
        }
    };

    private readonly registerOptionByType = (slashBuilder: Discord.SlashCommandBuilder | Discord.SlashCommandSubcommandBuilder, optionInterface: OptionInterface) => {
        const wrappedRegister = <T extends SlashCommandOptionSupported>(option: T): T => {
            const registeredOption = this.registerOption(option, optionInterface);
            if ('addChoices' in registeredOption) {
                this.registerChoices(registeredOption, optionInterface);
            }
            return registeredOption;
        };

        switch (optionInterface.type) {
            case 'CHANNEL':
                return slashBuilder.addChannelOption(wrappedRegister);
            case 'NUMBER':
                return slashBuilder.addNumberOption(wrappedRegister);
            case 'ROLE':
                return slashBuilder.addRoleOption(wrappedRegister);
            case 'STRING':
                return slashBuilder.addStringOption(wrappedRegister);
            case 'USER':
                return slashBuilder.addUserOption(wrappedRegister);
            case 'BOOLEAN':
                return slashBuilder.addBooleanOption(wrappedRegister);
            default:
                throw new Error(`Unexpected register option type ${optionInterface.type}`);
        }
    };

    private readonly registerSlashCommands = async (): Promise<void> => {
        const config = Configuration.getInstance().getConfig();
        const rest = new Discord.REST().setToken(config.token);

        // Start by building out subcommands
        const commandToSubcommands: Record<string, CommandInterface[]> = {};
        Object.values(this.commmands).forEach(command => {
            if ('subCommandOf' in command && command.subCommandOf) {
                if (commandToSubcommands[command.subCommandOf]) {
                    commandToSubcommands[command.subCommandOf].push(command);
                } else {
                    commandToSubcommands[command.subCommandOf] = [command];
                }
            }
        });

        const createCommand = (
            command: SimpleCommand | CommandInterfaceRootCommand | CommandInterfaceChildCommand,
            builder: Discord.SlashCommandBuilder | Discord.SlashCommandSubcommandBuilder,
            forceAsNonGroup = false
        ) => {
            const isGroupRoot = 'groupName' in command && !forceAsNonGroup;
            const name = isGroupRoot ? command.groupName : command.name;

            builder.setName(name);
            builder.setDescription(command.description);

            const subCommands = commandToSubcommands[name];
            if (subCommands && builder instanceof Discord.SlashCommandBuilder) {
                // Exclude placeholder commands
                if ('name' in command) {
                    const rootCommand = new Discord.SlashCommandSubcommandBuilder();
                    createCommand(command, rootCommand, true);
                    builder.addSubcommand(rootCommand);
                }

                for (const subCommand of subCommands) {
                    // Create group
                    if ('groupName' in subCommand) {
                        const subCommandBuilder = new Discord.SlashCommandSubcommandGroupBuilder();
                        subCommandBuilder.setName(subCommand.groupName);
                        subCommandBuilder.setDescription(subCommand.description);
                        builder.addSubcommandGroup(subCommandBuilder);

                        const fullName = `${name} ${subCommand.groupName}`;
                        for (const subSubCommand of commandToSubcommands[fullName]) {
                            // Can't have nesting of commands past one group
                            if ('groupName' in subSubCommand) {
                                continue;
                            }

                            const subSubCommandBuilder = new Discord.SlashCommandSubcommandBuilder();
                            createCommand(subSubCommand, subSubCommandBuilder);
                            subCommandBuilder.addSubcommand(subSubCommandBuilder);
                        }

                        continue;
                    } else {
                        // Add commands directly under root group
                        const subCommandBuilder = new Discord.SlashCommandSubcommandBuilder();
                        createCommand(subCommand, subCommandBuilder);
                        builder.addSubcommand(subCommandBuilder);
                    }
                }
            }

            // Prevents other 'options' being added when its the root of a group
            if (('isPublicCommand' in command) && !command.isPublicCommand && builder instanceof Discord.SlashCommandBuilder) {
                builder.setDefaultMemberPermissions(Discord.PermissionFlagsBits.Administrator);
            }

            // If the command has options then register them
            // This will exclude placeholder commands that can't be executed
            if ('options' in command && !isGroupRoot && command.options) {
                for (const option of command.options) {
                    this.registerOptionByType(builder, option);
                }
            }

            return builder.toJSON();
        };

        const commandsJson = Object.values(this.commmands)
            .filter(command => {
                const isSubCommand = ('subCommandOf' in command);
                return !isSubCommand;
            })
            .map(command => {
                const slashBuilder = new Discord.SlashCommandBuilder();
                createCommand(command as any, slashBuilder);
                return slashBuilder.toJSON();
            });

        try {
            const commandsResult = await rest.put(Discord.Routes.applicationGuildCommands(config.applicationId, config.guildId), {
                body: commandsJson
            }) as Discord.RESTPutAPIApplicationCommandsResult;

            for (const command of commandsResult) {
                for (const option of command.options ?? []) {
                    if (option.type === 2) {
                        option.options?.forEach((subOption) => {
                            const fullName = `${command.name} ${subOption.name}`;
                            this.commandNameToId[fullName] = command.id;
                        });
                    }
                }

                this.commandNameToId[command.name] = command.id;
            }
            console.log(`Registered ${commandsResult.length} commands!`);
        } catch (e) {
            console.error(`Failed to update slash commands for bot: ${(e as any).message}`);
            throw Error();
        }
    };

    private readonly getAllCommandsInFolder = (folder: string): Record<string, CommandInterface> => {
        let commands: Record<string, CommandInterface> = {};
        const files = fs.readdirSync(folder, { withFileTypes: true });
        for (const file of files) {
            if (!file.isDirectory() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
                const commandRequire = require(path.join(folder, file.name)).default;
                if (commandRequire?.name === undefined && commandRequire?.groupName === undefined) {
                    continue;
                }

                let fullName = '';
                const isSubCommand = 'subCommandOf' in commandRequire && commandRequire.subCommandOf;
                const isGroup = 'groupName' in commandRequire && commandRequire.groupName;
                if (isSubCommand && isGroup) {
                    fullName = `${commandRequire.subCommandOf} ${commandRequire.groupName}`;
                } else if (isSubCommand) {
                    fullName = `${commandRequire.subCommandOf} ${commandRequire.name}`;
                } else if (isGroup) {
                    fullName = `${commandRequire.groupName} ${commandRequire.name}`;
                } else {
                    fullName = commandRequire.name;
                }

                commands[fullName] = commandRequire;
            } else if (file.isDirectory()) {
                commands = {
                    ...commands,
                    ...(this.getAllCommandsInFolder(path.join(folder, file.name)))
                };
            }
        }
        return commands;
    };

    private readonly getAllButtonInteractionsInFolder = (folder: string): Record<string, GlobalButtonInterface> => {
        let buttons: Record<string, GlobalButtonInterface> = {};
        const files = fs.readdirSync(folder, { withFileTypes: true });
        for (const file of files) {
            if (!file.isDirectory() && (file.name.endsWith('.ts') || file.name.endsWith('.js'))) {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
                const commandRequire = require(path.join(folder, file.name)).default as GlobalButtonInterface;
                if (commandRequire?.customId === undefined || commandRequire?.execute === undefined) {
                    continue;
                }
                buttons[commandRequire.customId] = commandRequire;
            } else if (file.isDirectory()) {
                buttons = {
                    ...buttons,
                    ...(this.getAllButtonInteractionsInFolder(path.join(folder, file.name)))
                };
            }
        }
        return buttons;
    };

    private readonly getAllCommands = (): Record<string, CommandInterface> => {
        const commandsFolder = path.join(__dirname, '../commands');
        const commands = this.getAllCommandsInFolder(commandsFolder);

        return commands;
    };

    private readonly getAllButtonInteractions = (): Record<string, GlobalButtonInterface> => {
        const buttonsFolder = path.join(__dirname, '../buttons');
        const buttons = this.getAllButtonInteractionsInFolder(buttonsFolder);

        return buttons;
    };

    private readonly onCatchError = async (
        interaction: Discord.Interaction,
        e: any
    ) => {
        if (interaction.isRepliable()) {
            if (interaction.replied || interaction.deferred) {
                interaction.followUp({ content: 'An error occurred while executing command', ephemeral: true }).catch((e) => {
                    console.log(`Failed to send followUp message to interaction after error: ${e}`);
                });
            } else {
                interaction.reply({ content: 'An error occurred while executing command', ephemeral: true }).catch((e) => {
                    console.log(`Failed to send reply message to interaction after error: ${e}`);
                });
            }
        }

        const error = e;
        console.log('Error', error.stack);
        console.log('Error', error.name);
        console.log('Error', error.message);

        let commandName: string = 'Unknown';
        if (interaction.isCommand()) {
            commandName = interaction.commandName;
        } else if (interaction.isButton() || interaction.isAnySelectMenu()) {
            commandName = interaction.customId;
        }

        await AuditLogHandler.getInstance().publishAuditMessage(commandName, interaction.user.id, [
            `Error occurred while executing command: ${commandName}`,
            JJ_AUDIT_CONTACT_LINE
        ]);
    };

    private findCustomIdButtonInteraction (customId: string) {
        for (const interaction of Object.values(this.buttonInteractions)) {
            if (customId.startsWith(interaction.customId)) {
                return interaction;
            }
        }
        return null;
    }

    private getPrefixResult (isPrefix: boolean, prefix: string, customId: string) {
        if (isPrefix) {
            return customId.replace(prefix, '');
        }
        return customId;
    }

    public handleCommand = async (interaction: Discord.Interaction): Promise<void> => {
        if (TerminationManager.getInstance().isTerminating()) {
            console.log(`Rejecting command, shutting down - ${interaction.user.username}`);
            if (interaction.isRepliable()) {
                await interaction.reply({
                    content: 'Bot is currently restarting, please wait a minute and try again!',
                    ephemeral: true
                });
            }
            return;
        }

        // If this is set to true then failed commands will release the lock
        let finishAfterExecute = false;
        try {
            // Do this to make sure new users never get error messages from trying to retrieve data
            await addUserToDatabaseIfNotPresent(interaction.user.id);

            // Buttons are not locked unlike commands are
            if (interaction.isButton()) {
                const btnInteraction = this.findCustomIdButtonInteraction(interaction.customId);

                if (!btnInteraction) {
                    if (!this.expectedLocalButtonIds.has(interaction.customId)) {
                        console.error(`No button interaction with customId ${interaction.customId}`);
                    }
                    return;
                }

                const prefixResult = this.getPrefixResult(btnInteraction.isPrefix, btnInteraction.customId, interaction.customId);
                await btnInteraction.execute(interaction, prefixResult);
                return;
            }

            if (!interaction.isChatInputCommand()) {
                return;
            }

            const group = interaction.options.getSubcommandGroup(false);
            const subCommand = interaction.options.getSubcommand(false);
            const commandName = `${interaction.commandName}${group ? ` ${group}` : ''}${subCommand ? ` ${subCommand}` : ''}`;
            console.log(`Command /${commandName} by ${interaction.user.username}`);

            const command = CommandInteractionManager.getInstance().commmands[commandName];
            if (!command) {
                console.error(`No command with name ${commandName}`);
                return;
            }

            if (!('execute' in command)) {
                console.error('Command without execute function accessed.. should not happen');
                return;
            }
            finishAfterExecute = command.finishAfterExecute ?? true;

            // If the user is not JJ and they're locked, don't allow them to use commands (Needed to allow for testing /kill to work)
            if (this.userLocks[interaction.user.id]) {
                if (interaction.isRepliable()) {
                    await interaction.reply({
                        content: 'Please wait a few seconds before using another command!',
                        ephemeral: true
                    });
                }
                console.warn(`User tried to use command while they're locked ${interaction.user.username}`);
                return;
            }
            TerminationManager.getInstance().addActiveCommand(interaction.user.id);
            this.changeLockStatus(interaction.user.id, true);

            await command.execute(interaction);
        } catch (e) {
            await this.onCatchError(interaction, e);
        } finally {
            if (finishAfterExecute) {
                TerminationManager.getInstance().removeActiveCommand(interaction.user.id);
                this.changeLockStatus(interaction.user.id, false);
            }
        }
    };

    public init = async () => {
        await this.registerSlashCommands();
        console.log(`Registered ${Object.keys(this.buttonInteractions).length} Button Interaction handlers`);
    };

    // Needed for some special commands that need to control locks by themselves
    // Such as when the command doesn't end right after the execute command finishes
    // (Like when waiting for btn interactions)
    public changeLockStatus = (userId: string, isLocked: boolean) => {
        this.userLocks[userId] = isLocked;
    };

    public static getInstance (): CommandInteractionManager {
        if (!CommandInteractionManager.loader) {
            CommandInteractionManager.loader = new CommandInteractionManager();
        }
        return CommandInteractionManager.loader;
    }
};
