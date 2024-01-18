import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'tools',
    subCommandOf: 'admin',
    description: 'General admin tools'
};

export const TOOLS_SECTION = 'admin tools';

export default commandInterface;
