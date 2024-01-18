import { type CardsForCurrentSeries } from '../db/users';

const hasActionLeadToCompletion = (
    progressBefore: CardsForCurrentSeries,
    progressAfter: CardsForCurrentSeries
) => {
    return progressBefore.owned !== progressBefore.total && progressAfter.owned === progressAfter.total;
};

export const hasCompletedGroupAfterAction = async (
    progressBefore: CardsForCurrentSeries | null,
    progressAfter: CardsForCurrentSeries | null
): Promise<boolean> => {
    if (progressBefore === null || progressAfter === null) {
        throw new Error(`Progress before/after were unexpectedly null. (${progressBefore}, ${progressAfter})`);
    }
    return hasActionLeadToCompletion(progressBefore, progressAfter);
};
