import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'event',
    subCommandOf: 'admin',
    description: 'Admin event tools'
};

export const EVENT_SECTION = 'admin event';

export default commandInterface;
