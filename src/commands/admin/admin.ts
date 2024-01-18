import { type CommandInterface } from '../../services/CommandInteractionManager';

const command: CommandInterface = {
    groupName: 'admin',
    description: 'Admin commands',
    isPublicCommand: false,
    dmAllowed: false,
    execute: async () => {}
};

export default command;
