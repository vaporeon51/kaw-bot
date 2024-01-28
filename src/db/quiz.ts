import { getInstanceConfig } from '../config/config';
import DbConnectionHandler, { type ExecuteSQLOptions } from '../services/DbConnectionHandler';
import escape from 'pg-escape';

export enum QuizQuestionType {
    'IDOL' = 0,
    'GROUP' = 1
}

export interface QuizQuestion {
    id: number
    image: string
    answer: string
    options: string[]
    type: QuizQuestionType
};

const mapQuizQuestionIdol = (row: any, otherIdols: string[]): QuizQuestion => {
    const answerIdol = mapIdolStr(row);
    return {
        id: row.quiz_id,
        answer: answerIdol,
        options: [...otherIdols, answerIdol],
        image: row.image_url,
        type: row.type
    };
};

const mapQuizQuestionGroup = (row: any, otherGroups: string[]): QuizQuestion => {
    const answerGroup = row.group_name;
    return {
        id: row.quiz_id,
        answer: answerGroup,
        options: [...otherGroups, answerGroup],
        image: row.image_url,
        type: row.type
    };
};

const mapIdolStr = (row: any): string => {
    return `${row.group_name} - ${row.name}`;
};

export const getScoreDifferenceForResult = (correct: boolean, winStreak: number) => {
    if (correct) {
        if (winStreak >= 10) {
            return 5;
        } else if (winStreak >= 3) {
            return 2;
        } else {
            return 1;
        }
    }

    if (winStreak <= -10) {
        return -3;
    } else if (winStreak <= -5) {
        return -2;
    } else {
        return -1;
    }
};

export const getCurrentQuizWeek = (currentEpoch: number) => {
    const LENGTH_OF_WEEK_MILLISECONDS = 604800000;
    const start = getInstanceConfig().quizRatingEpochStart;
    // We want to start at week 1, not week 0
    return Math.floor((currentEpoch - start) / LENGTH_OF_WEEK_MILLISECONDS) + 1;
};

export interface UpdateQuizResults {
    winStreak: number
    ratingChange: number
    rankAfter: number
    rankBefore: number
}
export const updateQuizStats = async (userId: string, quizId: number, correct: boolean, options?: ExecuteSQLOptions): Promise<UpdateQuizResults | null> => {
    const week = getCurrentQuizWeek(Date.now());
    const currentData = `
        SELECT win_streak, max_streak, min_streak, ranking_value FROM quiz_stats 
        WHERE user_id = ${escape.literal(userId)} AND week = ${week}
        LIMIT 1`;
    const currentDataResult = await DbConnectionHandler.getInstance().executeSQL(currentData, options);

    let winStreak = 0;
    let maxStreak = 0;
    let minStreak = 0;
    let rankBefore = 0;
    if (currentDataResult.rowCount === 1) {
        winStreak = currentDataResult.rows[0].win_streak;
        maxStreak = currentDataResult.rows[0].max_streak;
        minStreak = currentDataResult.rows[0].min_streak;
        rankBefore = currentDataResult.rows[0].ranking_value;
    }

    const scoreDifference = getScoreDifferenceForResult(correct, winStreak);
    const rankAfter = Math.max(rankBefore + scoreDifference, 0);
    const newWinStreak = correct ? Math.max(winStreak, 0) + 1 : Math.min(winStreak, 0) - 1;
    maxStreak = Math.max(maxStreak, newWinStreak);
    minStreak = Math.min(minStreak, newWinStreak);

    const sql = `INSERT INTO 
    quiz_stats (user_id, week, ranking_value, win_streak, max_streak, min_streak, completed_questions) 
    VALUES (${escape.literal(userId)}, ${week}, ${rankAfter}, ${newWinStreak}, ${maxStreak}, ${minStreak}, ARRAY [${quizId}]::integer[])
    ON CONFLICT (user_id, week) 
        DO UPDATE
        SET 
        week = ${week},
        win_streak = ${newWinStreak}, 
        max_streak = ${maxStreak}, 
        min_streak = ${minStreak}, 
        ranking_value = ${rankAfter},
        completed_questions = array_append(quiz_stats.completed_questions, ${quizId})
    RETURNING ranking_value;`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result === null || result.rowCount === 0) {
        return null;
    }
    const rankingValue = result.rows[0].ranking_value;

    return {
        winStreak: newWinStreak,
        ratingChange: scoreDifference,
        rankBefore,
        rankAfter: rankingValue
    };
};

export const getRandomQuizQuestion = async (userId: string, options?: ExecuteSQLOptions) => {
    const sql = `SELECT 
        quiz_image_questions.id AS "quiz_id", 
        image_url, 
        type, 
        idol, 
        coalesce(quiz_image_questions.group_name, idols.group_name) as "group_name", 
        idols.id,
        idols.name
    FROM quiz_image_questions 
    LEFT JOIN idols on quiz_image_questions.idol = idols.id
    WHERE quiz_image_questions.id NOT IN (SELECT unnest(completed_questions) FROM quiz_stats WHERE user_id = ${escape.literal(userId)})
    ORDER BY RANDOM() LIMIT 1;`;
    const result = await DbConnectionHandler.getInstance().executeSQL(sql, options);
    if (result === null) {
        return null;
    }

    if (result.rowCount === 0) {
        return 'No questions left!';
    }

    const type = result.rows[0].type;
    if (type === QuizQuestionType.IDOL) {
        const idolId = result.rows[0].idol;
        const getOtherIdols = `SELECT * FROM idols WHERE id != ${idolId} ORDER BY RANDOM() LIMIT 2;`;
        const otherIdols = await DbConnectionHandler.getInstance().executeSQL(getOtherIdols, options);
        if (otherIdols === null || otherIdols.rowCount !== 2) {
            return null;
        }
        const otherIdolsMapped = otherIdols.rows.map(mapIdolStr);
        return mapQuizQuestionIdol(result.rows[0], otherIdolsMapped);
    } else {
        const group = result.rows[0].group_name;
        const getOtherIdols = `SELECT * FROM groups WHERE name != ${escape.literal(group)} ORDER BY RANDOM() LIMIT 2;`;
        const otherGroups = await DbConnectionHandler.getInstance().executeSQL(getOtherIdols, options);
        if (otherGroups === null || otherGroups.rowCount !== 2) {
            return null;
        }
        const otherGroupsMapped = otherGroups.rows.map(i => i.name);
        return mapQuizQuestionGroup(result.rows[0], otherGroupsMapped);
    }
};
