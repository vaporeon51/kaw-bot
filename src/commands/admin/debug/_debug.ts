import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'debug',
    subCommandOf: 'admin',
    description: 'Admin debug tools'
};

export const DEBUG_SECTION = 'admin debug';

export default commandInterface;
