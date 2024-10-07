import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'dm',
    subCommandOf: 'admin',
    description: 'Admin dm tools'
};

export const DM_SECTION = 'admin dm';

export default commandInterface;
