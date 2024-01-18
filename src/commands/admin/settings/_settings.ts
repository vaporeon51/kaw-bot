import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'settings',
    subCommandOf: 'admin',
    description: 'Admin settings tools'
};

export const SETTINGS_SECTION = 'admin settings';

export default commandInterface;
