/* eslint-disable @typescript-eslint/no-confusing-void-expression */
import * as Discord from 'discord.js';
import { type CommandInterface } from '../services/CommandInteractionManager';
import { type QuizQuestion, QuizQuestionType, getRandomQuizQuestion, updateQuizStats, type UpdateQuizResults } from '../db/quiz';
import { modifyUserLastQuizCompleted } from '../db/users';
import { codeItem, createBtn, createRowWithBtns } from '../embedHelpers';
import { safeWrapperFn } from '../common/safeCollector';
import { CollectorHolder } from '../services/CollectorHolder';
import AuditLogHandler from '../services/AuditLogHandler';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import CooldownRetriever, { Cooldowns } from '../services/CooldownRetriever';
import CooldownNotifier from '../services/CooldownNotifier';

const reportFailedImageLoadId = 'reportFailedImageLoad';

const shuffleList = <T>(list: T[]) => {
    const newList = [...list];
    for (let i = 0; i < newList.length; i++) {
        const randomIndex = Math.floor(Math.random() * newList.length);
        const temp = newList[i];
        newList[i] = newList[randomIndex];
        newList[randomIndex] = temp;
    }
    return newList;
};

const getQuestionTextBaedOnType = (type: QuizQuestionType) => {
    switch (type) {
        case QuizQuestionType.IDOL:
            return '**Who is this idol?**';
        case QuizQuestionType.GROUP:
            return '**Which group is this?**';
    }
};

const getRatingChangeString = (rankBefore: number, rankAfter: number) => {
    const diff = rankAfter - rankBefore;
    if (diff === 0) {
        return '0';
    } else if (diff > 0) {
        return `+${diff}`;
    } else {
        return `${diff}`;
    }
};

const createPublicMessage = async (
    interaction: Discord.ChatInputCommandInteraction,
    updateQuizStatsResult: UpdateQuizResults,
    successful?: boolean
) => {
    const embed = new Discord.EmbedBuilder();
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Finished Quiz - Rating update'
    });

    const topText = successful ? '✅ **Correct**' : '❌ **Incorrect**';
    const ratingChangeStr = getRatingChangeString(updateQuizStatsResult.rankBefore, updateQuizStatsResult.rankAfter);
    const lines = [
        `${codeItem(interaction.user.username)} got their question ${topText}`,
        '',
        `Rating change: ${codeItem(ratingChangeStr)} (Now: ${codeItem(updateQuizStatsResult.rankAfter.toLocaleString())})`,
        `Win streak: ${codeItem(updateQuizStatsResult.winStreak.toLocaleString())}`
    ];

    embed.setDescription(lines.join('\n'));
    const color = successful ? '#00D100' : '#D10000';
    embed.setColor(color);
    embed.setThumbnail(interaction.user.avatarURL() ?? null);
    embed.setFooter({
        text: 'use /quiz to participate and climb the ranks for rewards!'
    });

    await interaction.channel?.send({
        embeds: [embed]
    });
};

const createSuccessEmbed = (
    quizQuestion: QuizQuestion,
    interaction: Discord.ChatInputCommandInteraction
) => {
    const embed = new Discord.EmbedBuilder();
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Finished Quiz'
    });

    embed.setTitle(getQuestionTextBaedOnType(quizQuestion.type));
    const descriptionLines = [
        '✅ **Correct**'
    ];
    embed.setDescription(descriptionLines.join('\n'));
    embed.setColor('#00D100');
    embed.setImage(quizQuestion.image);

    return embed;
};

const createTimedOutEmbed = (
    quizQuestion: QuizQuestion,
    interaction: Discord.ChatInputCommandInteraction
) => {
    const embed = new Discord.EmbedBuilder();
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Finished Quiz (Timed out)'
    });

    embed.setTitle(getQuestionTextBaedOnType(quizQuestion.type));
    const descriptionLines = [
        '❌ **Incorrect** (Timed out)'
    ];
    embed.setDescription(descriptionLines.join('\n'));
    embed.setColor('#D10000');
    embed.setImage(quizQuestion.image);

    const reportRow = createRowWithBtns([createBtn('Report failed image load', Discord.ButtonStyle.Primary, reportFailedImageLoadId)]);
    return [embed, reportRow] as const;
};

const createFailureEmbed = (
    quizQuestion: QuizQuestion,
    interaction: Discord.ChatInputCommandInteraction
) => {
    const embed = new Discord.EmbedBuilder();
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Finished Quiz'
    });

    embed.setTitle(getQuestionTextBaedOnType(quizQuestion.type));
    const descriptionLines = [
        '❌ **Incorrect**'
    ];
    embed.setDescription(descriptionLines.join('\n'));
    embed.setColor('#D10000');
    embed.setImage(quizQuestion.image);

    return embed;
};

const createEmbed = (
    quizQuestion: QuizQuestion,
    interaction: Discord.ChatInputCommandInteraction
) => {
    const embed = new Discord.EmbedBuilder();
    embed.setAuthor({
        iconURL: interaction.user.avatarURL() ?? undefined,
        name: 'Playing Quiz'
    });

    embed.setTitle(getQuestionTextBaedOnType(quizQuestion.type));
    embed.setDescription('*You have 10 seconds to answer*');
    embed.setImage(quizQuestion.image);

    const options = quizQuestion.options.map((option) => {
        return createBtn(option, Discord.ButtonStyle.Primary, option);
    });
    const btnRow = createRowWithBtns(options);
    return [embed, btnRow] as const;
};

const quizUpdateTransaction = async (
    quizQuestion: QuizQuestion,
    interaction: Discord.ChatInputCommandInteraction,
    btnInteraction: Discord.ButtonInteraction | null,
    options: { success: boolean, isTimeout?: boolean }
) => {
    const connection = await DbConnectionHandler.getInstance().getConnection();
    const executeSQLOptions: ExecuteSQLOptions = { client: connection };
    try {
        await DbConnectionHandler.getInstance().executeSQL('BEGIN', executeSQLOptions);
        await modifyUserLastQuizCompleted(interaction.user.id, Date.now(), executeSQLOptions);
        const updateResult = await updateQuizStats(interaction.user.id, quizQuestion.id, options.success);
        if (updateResult === null) {
            throw new Error('Failed to update quiz stats');
        }

        let embed;
        let components: Array<Discord.ActionRowBuilder<Discord.ButtonBuilder>> = [];
        if (options.success) {
            embed = createSuccessEmbed(quizQuestion, interaction);
        } else if (options.isTimeout) {
            const [timedOutEmbed, reportBtn] = createTimedOutEmbed(quizQuestion, interaction);
            embed = timedOutEmbed;
            components = [reportBtn];
        } else {
            embed = createFailureEmbed(quizQuestion, interaction);
        }

        let response;
        const updatePayload = {
            embeds: [embed],
            components
        };
        if (btnInteraction !== null) {
            response = await btnInteraction.update(updatePayload);
        } else {
            response = await interaction.editReply(updatePayload);
        }

        await createPublicMessage(interaction, updateResult, options.success);
        await DbConnectionHandler.getInstance().executeSQL('COMMIT', executeSQLOptions);
        await CooldownNotifier.getInstance().resetUserNotificationTimeoutForEvent(Cooldowns.QUIZ, interaction.user.id);
        return response;
    } catch (e) {
        await DbConnectionHandler.getInstance().executeSQL('ROLLBACK', executeSQLOptions);
        throw e;
    } finally {
        connection?.release();
    }
};

const command: CommandInterface = {
    name: 'quiz',
    dmAllowed: false,
    isPublicCommand: false,
    description: 'Play the quiz game in exchange for prizes!',
    execute: async (interaction: Discord.ChatInputCommandInteraction) => {
        const cooldownInfo = await CooldownRetriever.getInstance().getCooldownInfo(interaction.user.id, Cooldowns.QUIZ);

        if (!cooldownInfo.elapsed) {
            await interaction.reply({
                content: CooldownRetriever.getDisplayStringFromInfo(Cooldowns.QUIZ, cooldownInfo),
                ephemeral: true
            });
            return;
        }
        const quizQuestion = await getRandomQuizQuestion(interaction.user.id);

        if (quizQuestion === null) {
            await interaction.reply({
                content: 'There was an error getting a quiz question. Please try again later.',
                ephemeral: true
            });
            return;
        }

        if (typeof quizQuestion === 'string') {
            await interaction.reply({
                content: quizQuestion,
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({
            ephemeral: true
        });

        quizQuestion.options = shuffleList(quizQuestion.options);

        const [embed, btnRow] = createEmbed(quizQuestion, interaction);
        const response = await interaction.editReply({
            embeds: [embed],
            components: [btnRow]
        });

        const collector = response.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 10_000 });

        const onQuizBtnClick = async (btnInteraction: Discord.ButtonInteraction) => {
            if (btnInteraction.user.id !== interaction.user.id) {
                await btnInteraction.reply({
                    content: 'You cannot answer this question',
                    ephemeral: true
                });
                return;
            }
            collector.stop('btnClicked');

            const answer = btnInteraction.customId;
            const isCorrect = answer === quizQuestion.answer;
            if (isCorrect) {
                await quizUpdateTransaction(quizQuestion, interaction, btnInteraction, { success: true });
                return;
            }
            await quizUpdateTransaction(quizQuestion, interaction, btnInteraction, { success: false });
        };

        const onReportBtnClick = async (reportCollector: Discord.InteractionCollector<Discord.ButtonInteraction>, btnInteraction: Discord.ButtonInteraction) => {
            if (btnInteraction.customId !== reportFailedImageLoadId) {
                return;
            };

            if (btnInteraction.user.id !== interaction.user.id) {
                await btnInteraction.reply({
                    content: 'You cannot report this question',
                    ephemeral: true
                });
                return;
            }

            const messageLink = `https://discord.com/channels/${btnInteraction.guildId}/${btnInteraction.channelId}/${btnInteraction.message.id}`;
            await AuditLogHandler.getInstance().publicAuditMessageCustom(
                'Quiz report',
                [
                    `User <@${interaction.user.id}> reported a quiz question as having a failed image load`,
                    `Message: ${messageLink}`
                ]);
            await btnInteraction.reply({
                content: 'Issue reported to admins',
                ephemeral: true,
                components: []
            });
            reportCollector.stop('reported');
        };

        const collectorId = CollectorHolder.getInstance().addCollector(collector);

        const onCollectorEnd = async (
            collector: Discord.InteractionCollector<Discord.ButtonInteraction>,
            reason: string
        ) => {
            CollectorHolder.getInstance().removeCollector(collectorId);
            if (reason === 'time') {
                const response = await quizUpdateTransaction(quizQuestion, interaction, null, { success: false, isTimeout: true });

                const reportCollector = response.createMessageComponentCollector({ componentType: Discord.ComponentType.Button, time: 60_000 });
                const collectorId = CollectorHolder.getInstance().addCollector(reportCollector);

                const boundOnReportBtnClick = onReportBtnClick.bind(null, reportCollector);
                reportCollector.on('collect', safeWrapperFn('onReportBtnClick', boundOnReportBtnClick));
                reportCollector.on('end', async () => {
                    CollectorHolder.getInstance().removeCollector(collectorId);
                    await interaction.editReply({
                        components: []
                    });
                });
            } else if (reason !== 'btnClicked') {
                await interaction.editReply({
                    content: 'Quiz ended - bot restarting',
                    embeds: [],
                    components: []
                });
            }
        };

        collector.on('collect', safeWrapperFn('onQuizBtnClick', onQuizBtnClick));
        collector.on('end', safeWrapperFn('onQuizCollectorEnd', onCollectorEnd));
    }
};

export default command;
