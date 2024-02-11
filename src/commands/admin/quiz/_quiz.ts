import { type CommandInterface } from '../../../services/CommandInteractionManager';

const commandInterface: CommandInterface = {
    groupName: 'quiz',
    subCommandOf: 'admin',
    description: 'Admin tools for quizzes'
};

export const QUIZ_SECTION = 'admin quiz';

export default commandInterface;
