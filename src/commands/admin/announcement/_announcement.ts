import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'announcements',
    subCommandOf: 'admin',
    description: 'Admin tools for announcements'
};

export const ANNOUNCEMENTS_SECTION = 'admin announcements';

export default commandInterface;
