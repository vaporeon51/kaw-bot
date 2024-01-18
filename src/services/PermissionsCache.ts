import * as Discord from 'discord.js';
import { getAllRoleSettings } from '../db/roles';
import Configuration from './Configuration';
import { ONE_HOUR_MS, ONE_MINUTE_MS } from '../cardConstants';

const DEFAULT_COOLDOWN = ONE_HOUR_MS * 12;

export default class PermissionsCache {
    private static instance: PermissionsCache;
    // Ordered from lowest position to highest
    private roleOrderList: Discord.APIRole[] = [];
    private roleIdToCooldownMs: Record<string, number> = {};
    private roleIdToRole: Record<string, Discord.APIRole> = {};
    private userIdToRoles: Record<string, string[]> = {};
    private userIdToHighestRoleId: Record<string, { pos: number, id: string }> = {};
    private lastRetrievedRoles: number = 0;
    private commandToPermissions: Record<string, Discord.APIApplicationCommandPermission[] | undefined> = {};

    private readonly recreateCacheIfNeeded = async () => {
        const diff = Date.now() - this.lastRetrievedRoles;
        if (diff > ONE_MINUTE_MS * 10 || this.lastRetrievedRoles === 0) {
            console.log('Refreshing roles data');
            await this.recreateCache();
        }
    };

    private readonly recreateCache = async () => {
        console.log('Recreating permissions cache');
        const config = Configuration.getInstance().getConfig();

        const rest = new Discord.REST().setToken(config.token);
        const roleDetails = await rest.get(Discord.Routes.guildRoles(config.guildId)) as Discord.RESTGetAPIGuildRolesResult;

        const roleOrderList: Discord.APIRole[] = [];
        const roleIdToPosition: Record<string, Discord.APIRole> = {};
        roleDetails.sort((a, b) => b.position - a.position);
        for (const role of roleDetails) {
            roleOrderList.push(role);
            roleIdToPosition[role.id] = role;
        }

        const roleIdToCooldown: Record<string, number> = {};
        const serverRoleSettings = await getAllRoleSettings();
        for (const roleSettings of serverRoleSettings) {
            roleIdToCooldown[roleSettings.roleId] = roleSettings.refreshTimeMs;
        }

        const commandToPermissions: Record<string, Discord.APIApplicationCommandPermission[]> = {};
        const applicationCommandsPermissions = await rest.get(Discord.Routes.guildApplicationCommandsPermissions(config.applicationId, config.guildId)) as Discord.RESTGetAPIGuildApplicationCommandsPermissionsResult;
        for (const command of applicationCommandsPermissions) {
            commandToPermissions[command.id] = command.permissions;
        }

        this.commandToPermissions = commandToPermissions;
        this.userIdToHighestRoleId = {};
        this.roleOrderList = roleOrderList;
        this.roleIdToRole = roleIdToPosition;
        this.userIdToRoles = {};
        this.lastRetrievedRoles = Date.now();
        this.roleIdToCooldownMs = roleIdToCooldown;
    };

    public getRolesForUser = async (userId: string, ignoreCache = false) => {
        if (!ignoreCache) {
            await this.recreateCacheIfNeeded();
        }

        if (this.userIdToRoles[userId] !== undefined && !ignoreCache) {
            return this.userIdToRoles[userId];
        }

        const config = Configuration.getInstance().getConfig();
        const rest = new Discord.REST().setToken(config.token);
        const guildMemberDetails = await rest.get(Discord.Routes.guildMember(config.guildId, userId)).catch(e => {
            console.error(`Error while obtaining roles for user: ${userId}, possibly left server. ${e.message}`);
            return null;
        }) as Discord.RESTGetAPIGuildMemberResult | null;

        if (guildMemberDetails) {
            this.userIdToRoles[userId] = guildMemberDetails.roles;
            return this.userIdToRoles[userId];
        }
        return [];
    };

    public doesUserHaveRole = async (userId: string, roleId: string | undefined) => {
        if (roleId === undefined) {
            console.warn('doesUserHaveRole: Unexpected undefined roleId');
            return false;
        }

        const roles = await this.getRolesForUser(userId);
        return roles.includes(roleId);
    };

    public getHighestRoleForUser = async (userId: string) => {
        await this.recreateCacheIfNeeded();

        if (this.userIdToHighestRoleId[userId]) {
            return this.userIdToHighestRoleId[userId];
        }

        const config = Configuration.getInstance().getConfig();
        const rest = new Discord.REST().setToken(config.token);
        const guildMemberDetails = await rest.get(Discord.Routes.guildMember(config.guildId, userId)) as Discord.RESTGetAPIGuildMemberResult;

        let highestRole = { pos: 0, id: '' };
        for (const roleId of guildMemberDetails.roles) {
            const pos = await this.convertRoleIdToPosition(roleId);
            if (pos > highestRole.pos) {
                highestRole = { pos, id: roleId };
            }
        }
        this.userIdToHighestRoleId[userId] = highestRole;
        return highestRole;
    };

    /**
     * Only to be used for checking admin commands
     */
    public canUserCallSlashCommand = async (userId: string, commandId: string, isAdmin: boolean) => {
        await this.recreateCacheIfNeeded();

        let canExecute = isAdmin;
        const userRoles = await this.getRolesForUser(userId);
        const permissions = this.commandToPermissions[commandId];

        // No special permissions for command
        if (!permissions || canExecute) {
            return canExecute;
        }

        for (const perm of permissions) {
            // Allowed to execute via role
            if (perm.permission && perm.type === 1 && userRoles.includes(perm.id)) {
                canExecute = true;
                break;
            }
            // Allowed to execute via userId
            if (perm.permission && perm.type === 2 && perm.id === userId) {
                canExecute = true;
                break;
            }
        }
        return canExecute;
    };

    public getCooldownMsBasedOnRole = async (userId: string) => {
        await this.recreateCacheIfNeeded();

        const userRoles = await this.getRolesForUser(userId);
        let lowestCooldown = DEFAULT_COOLDOWN;
        for (const role of this.roleOrderList) {
            const roleCooldown = this.roleIdToCooldownMs[role.id] ?? DEFAULT_COOLDOWN;
            if (userRoles.includes(role.id) && roleCooldown < lowestCooldown) {
                lowestCooldown = roleCooldown;
            }
        }
        return lowestCooldown;
    };

    public readonly convertRoleIdToPosition = async (roleId: string) => {
        await this.recreateCacheIfNeeded();

        if (!this.roleIdToRole[roleId]) {
            // Everyone role
            return 0;
        }
        return this.roleIdToRole[roleId].position;
    };

    public readonly convertRoleIdToAPIRole = async (roleId: string) => {
        await this.recreateCacheIfNeeded();
        return this.roleIdToRole[roleId];
    };

    public readonly reset = () => {
        this.lastRetrievedRoles = 0;
    };

    public static getInstance = (): PermissionsCache => {
        if (!PermissionsCache.instance) {
            PermissionsCache.instance = new PermissionsCache();
        }
        return PermissionsCache.instance;
    };
}
