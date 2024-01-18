import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'permissions',
    subCommandOf: 'admin',
    description: 'Admin permissions tools'
};

export const PERMISSIONS_SECTION = 'admin permissions';

export default commandInterface;
