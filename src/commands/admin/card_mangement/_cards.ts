import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'cards',
    subCommandOf: 'admin',
    description: 'Admin tools around cards'
};

export const CARDS_SECTION = 'admin cards';

export default commandInterface;
