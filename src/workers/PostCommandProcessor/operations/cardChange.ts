import { CELEBRATE_ICON, getPrimaryAliasForSeries } from '../../../cardConstants';
import { getInstanceConfig } from '../../../config/config';
import { Series } from '../../../config/types';
import { getUserCompletedGroups, calculateUserCompletedGroups, updateUserCompletedGroups } from '../../../db/tracking';
import { codeItem } from '../../../embedHelpers';
import AuditLogHandler from '../../../services/AuditLogHandler';
import Configuration from '../../../services/Configuration';
import PermissionsCache from '../../../services/PermissionsCache';
import { type CommandPayloads, type PostCommand } from '../../../services/PostCommandOperations';
import { logMessage, sendAnnouncementMessage } from '../utils';
import * as discord from 'discord.js';

const roleConfig = getInstanceConfig().roleSettings;

enum editAction {
    ASSIGN = 'Assign',
    REMOVE = 'Remove'
}
const editRole = async (userId: string, action: editAction, role: string) => {
    const roles = await PermissionsCache.getInstance().getRolesForUser(userId, true).catch((e) => {
        console.error(`Failed to get roles for user ${userId}: ${e}`);
        AuditLogHandler.getInstance().publicAuditMessageCustom(
            'Tracker process',
            [`Failed to get roles for user <@${role}>`, `please ${action} manually`]
        ).catch((e) => { console.error(`Failed to send audit log message: ${e}`); });
        return null;
    });

    const hasRole = roles?.includes(role);
    const shouldSkip = action === editAction.ASSIGN ? hasRole : !hasRole;
    // already has role or error happened
    if (roles === null || shouldSkip) {
        return false;
    }

    const roleIds = action === editAction.ASSIGN ? [...roles, role] : roles.filter(r => r !== role);

    const config = Configuration.getInstance().getConfig();
    const rest = new discord.REST().setToken(config.token);
    await rest.patch(discord.Routes.guildMember(config.guildId, userId), {
        body: {
            roles: roleIds
        }
    }).catch((e) => {
        console.error(`Failed to ${action} role to user ${userId}: ${e}`);
        AuditLogHandler.getInstance().publicAuditMessageCustom(
            'Tracker process',
            [`Failed to ${action} role <@${role}>`, `please ${action} manually`]
        ).catch((e) => { console.error(`Failed to send audit log message: ${e}`); });
    });
    return true;
};

const handleSeriesRole = async (
    seriesName: string,
    userId: string,
    shouldReceiveRole: boolean,
    roleId: string,
    assignedRoles: string[],
    removedRoles: string[]
) => {
    if (shouldReceiveRole) {
        const addRes = await editRole(userId, editAction.ASSIGN, roleId);
        if (addRes) {
            sendAnnouncementMessage(
                userId,
                `${seriesName} role assignment`,
                [`${CELEBRATE_ICON} Congratulations, you completed a set in ${seriesName}! You have been assigned the <@&${roleId}> role!`]
            ).catch((e) => { console.error(`Failed to send announcement message: ${e}`); });
            assignedRoles.push(roleId);
        }
    } else {
        const removeRes = await editRole(userId, editAction.REMOVE, roleId);
        if (removeRes) {
            sendAnnouncementMessage(
                userId,
                `${seriesName} role removal`,
                [`You no longer have a set completed in ${seriesName}! You have been removed from the <@&${roleId}> role!`]
            ).catch((e) => { console.error(`Failed to send announcement message: ${e}`); });
            removedRoles.push(roleId);
        }
    }
    return [assignedRoles, removedRoles] as const;
};

const assignOrRemoveRoles = async (userId: string, groups: string[][]) => {
    let assignedRoles: string[] = [];
    let removedRoles: string[] = [];

    const isSeries1Collector = groups.some(group => group[1] === Series.SERIES_1);
    const isSeries2Collector = groups.some(group => group[1] === Series.SERIES_2);
    const isSeries3Collector = groups.some(group => group[1] === Series.SERIES_3);

    const s1Role = roleConfig[Series.SERIES_1];
    [assignedRoles, removedRoles] = await handleSeriesRole(Series.SERIES_1, userId, isSeries1Collector, s1Role, assignedRoles, removedRoles);

    const s2Role = roleConfig[Series.SERIES_2];
    [assignedRoles, removedRoles] = await handleSeriesRole(Series.SERIES_2, userId, isSeries2Collector, s2Role, assignedRoles, removedRoles);

    const s3Role = roleConfig[Series.SERIES_3];
    [assignedRoles, removedRoles] = await handleSeriesRole(Series.SERIES_3, userId, isSeries3Collector, s3Role, assignedRoles, removedRoles);

    return { assignedRoles, removedRoles };
};

function convertGroupArrayToString (groups: string[][]) {
    const groupsString: string[] = [];
    for (const group of groups) {
        const [groupName, series] = group;
        groupsString.push(`${groupName} (${getPrimaryAliasForSeries(series as Series)})`);
    }
    return groupsString.join(', ');
}

const getGroupDifference = (oldGroups: string[][], newGroups: string[][]) => {
    const oldGroupNames = oldGroups.map(group => `${group[0]} (${getPrimaryAliasForSeries(group[1] as Series)})`);
    const newGroupNames = newGroups.map(group => `${group[0]} (${getPrimaryAliasForSeries(group[1] as Series)})`);
    const addedGroups = newGroupNames.filter(groupName => !oldGroupNames.includes(groupName));
    const removedGroups = oldGroupNames.filter(groupName => !newGroupNames.includes(groupName));
    return { addedGroups, removedGroups };
};

const announceSetChanges = async (userId: string, addedGroups: string[], removedGroups: string[]) => {
    if (addedGroups.length > 0 && removedGroups.length === 0) {
        sendAnnouncementMessage(
            userId,
            'Set completion announcement',
            [`${CELEBRATE_ICON} Congratulations for completing the following set(s): ${codeItem(addedGroups.join(', '))}!`]
        ).catch((e) => { console.error(`Failed to send announcement message: ${e}`); });
    }

    if (addedGroups.length === 0 && removedGroups.length > 0) {
        sendAnnouncementMessage(
            userId,
            'Set loss announcement',
            [`You have lost completion of the following set(s): ${codeItem(removedGroups.join(', '))}!`]
        ).catch((e) => { console.error(`Failed to send announcement message: ${e}`); });
    }

    if (addedGroups.length > 0 && removedGroups.length > 0) {
        sendAnnouncementMessage(
            userId,
            'Set change announcement',
            [
                `${CELEBRATE_ICON} Congratulations for completing the following set(s): ${codeItem(addedGroups.join(', '))}!`,
                `However, you have lost completion of the following set(s): ${codeItem(removedGroups.join(', '))}`
            ]
        ).catch((e) => { console.error(`Failed to send announcement message: ${e}`); });
    }
};

export const changeInGroups = (oldGroups: string[][], newGroups: string[][]) => {
    if (oldGroups.length !== newGroups.length) {
        return true;
    }

    const oldGroupNames = new Set(oldGroups.map(group => `${group[0]} (${getPrimaryAliasForSeries(group[1] as Series)})`));
    const newGroupNames = new Set(newGroups.map(group => `${group[0]} (${getPrimaryAliasForSeries(group[1] as Series)})`));

    // If the new set of group names does not contain an old group name, then there was a change
    for (const groupName of oldGroupNames) {
        if (!newGroupNames.has(groupName)) {
            return true;
        }
    }

    // If the old set of group names does not contain a new group name, then there was a change
    for (const groupName of newGroupNames) {
        if (!oldGroupNames.has(groupName)) {
            return true;
        }
    }
    return false;
};

// Used for recording number of completed groups for a user
export async function handleCardsChange (payload: CommandPayloads[PostCommand.CARDS_CHANGE]) {
    const currentCompletedGroups = await getUserCompletedGroups(payload.userId);
    const calculatedData = await calculateUserCompletedGroups(payload.userId);

    // No change in number of completed groups, early exit
    if (!changeInGroups(currentCompletedGroups, calculatedData.groups)) {
        return;
    }

    await updateUserCompletedGroups(payload.userId, calculatedData.groups);
    const groupsOldStringified = convertGroupArrayToString(currentCompletedGroups);
    const groupsNewStringified = convertGroupArrayToString(calculatedData.groups);
    const transitionString = `${codeItem(groupsOldStringified)} -> ${codeItem(groupsNewStringified)}`;

    const difference = getGroupDifference(currentCompletedGroups, calculatedData.groups);

    const trackerAuditLines = [
        `**Completed sets change**: user <@${payload.userId}> from ${currentCompletedGroups.length} to ${calculatedData.numberOfGroups} completed set(s)`,
        `**Before Set(s)**: ${codeItem(groupsOldStringified)}`,
        `**After Set(s)**: ${codeItem(groupsNewStringified)}`,
        '',
        `**Added Set(s)**: ${codeItem(difference.addedGroups.join(', '))}`,
        `**Removed Set(s)**: ${codeItem(difference.removedGroups.join(', '))}`,
        ''
    ];
    await announceSetChanges(payload.userId, difference.addedGroups, difference.removedGroups);

    const roleChange = await assignOrRemoveRoles(payload.userId, calculatedData.groups);
    const hasAssingedRoles = roleChange.assignedRoles.length > 0;
    const hasRemovedRoles = roleChange.removedRoles.length > 0;
    if (hasAssingedRoles) {
        trackerAuditLines.push(`**Assigned Roles**: ${(roleChange.assignedRoles.map(role => `<@&${role}>`).join(', '))}`);
    }
    if (hasRemovedRoles) {
        trackerAuditLines.push(`**Removed Roles**: ${(roleChange.removedRoles.map(role => `<@&${role}>`).join(', '))}`);
    }

    await AuditLogHandler.getInstance().publicAuditMessageCustom(
        'Tracker process',
        trackerAuditLines
    );
    logMessage(`Updated user ${payload.userId} completed sets from ${currentCompletedGroups.length} to ${calculatedData.numberOfGroups} (${transitionString})`);
}
