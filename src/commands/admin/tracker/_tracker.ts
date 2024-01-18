import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'tracker',
    subCommandOf: 'admin',
    description: 'Admin tracker tools'
};

export const TRACKER_SECTION = 'admin tracker';

export default commandInterface;
