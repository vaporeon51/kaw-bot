import type * as Discord from 'discord.js';
import { type GlobalButtonInterface } from '../../services/CommandInteractionManager';
import { CRAFT_BUTTON_REJECT_ID } from '../../commands/craft';
import { closeCraftingRequest, getCraftingRequestById } from '../../db/crafting';

const button: GlobalButtonInterface = {
    customId: CRAFT_BUTTON_REJECT_ID,
    isPrefix: true,
    execute: async (interaction: Discord.ButtonInteraction, prefixResult) => {
        const id = prefixResult;
        const openRequest = await getCraftingRequestById(id);
        if (!openRequest) {
            await interaction.reply({
                content: 'Unable to find craft request!',
                ephemeral: true
            });
            return;
        }

        if (interaction.user.id !== openRequest.userId) {
            await interaction.reply({
                content: 'Not your crafting request to accept!',
                ephemeral: true
            });
            return;
        }

        await closeCraftingRequest(openRequest.id);

        await interaction.message.delete();
        await interaction.reply({
            content: 'Crafting request has been cancelled',
            ephemeral: true
        });
    }
};
export default button;
