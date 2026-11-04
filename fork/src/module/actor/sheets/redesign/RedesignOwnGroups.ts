import { SYSTEM_NAME } from '@/module/constants';

// The player's own groups on the item tabs (inventory, augmentations, magic, vehicles), as the Actions tab's: cards of
// the player's own after the tab's own cards (an item type, a spell category, vehicles / drones). A row goes into one
// by a drag onto its card or by "Move to group" in its menu, and back to its own card the same way; a row put in none
// sits in its own card. Only how the sheet lists the rows changes: the items and vehicles stay as they are
// (SR5RedesignActorSheet#ownGroupCards, #wireOwnGroupDrops).

/** The tabs with own groups (their section's data-tab). */
export const OWN_GROUP_TABS = ['inventory', 'augmentations', 'magic', 'vehicles'] as const;
export type OwnGroupTab = typeof OWN_GROUP_TABS[number];
export type OwnGroup = { id: string, label: string };

/** Actor flag: each tab's own groups, in order: {inventory: [{id, label}], magic: [...], ...}. */
export const OWN_GROUPS_FLAG = 'ownGroups';
/** Actor flag: the own group a row was put in: {item id (a vehicle: its actor id): group id}. */
export const OWN_GROUP_OF_FLAG = 'ownGroupOf';

type Flagged = { getFlag(scope: string, key: string): unknown };

export function isOwnGroupTab(tab: string | undefined): tab is OwnGroupTab {
    return OWN_GROUP_TABS.includes(tab as OwnGroupTab);
}

/** A tab's own groups, in order (entries that are not a group left out). */
export function ownGroups(actor: Flagged, tab: OwnGroupTab): OwnGroup[] {
    const groups = (actor.getFlag(SYSTEM_NAME, OWN_GROUPS_FLAG) as Record<string, unknown> | undefined)?.[tab];
    if (!Array.isArray(groups)) return [];
    return (groups as ({ id?: unknown, label?: unknown } | null)[])
        .filter((group): group is OwnGroup => !!group?.id && typeof group.id === 'string' && typeof group.label === 'string');
}

/** Where the rows were put: {row key: group id}. */
export function ownGroupOf(actor: Flagged): Record<string, string> {
    return (actor.getFlag(SYSTEM_NAME, OWN_GROUP_OF_FLAG) ?? {}) as Record<string, string>;
}

/** The own group a row is in, while that group exists on its tab; null: the row's own card. */
export function ownGroupOfRow(key: string, groups: OwnGroup[], placed: Record<string, string>): string | null {
    const id = placed[key];
    return id && groups.some(group => group.id === id) ? id : null;
}

/** A tab's rows split: the ones put in one of its own groups by group id, the rest stay in their own cards. */
export function splitOwnGroups<T>(rows: T[], keyOf: (row: T) => string | null | undefined, groups: OwnGroup[], placed: Record<string, string>) {
    const rest: T[] = [];
    const byGroup = new Map<string, T[]>();
    for (const row of rows) {
        const key = keyOf(row);
        const id = key ? ownGroupOfRow(key, groups, placed) : null;
        if (!id) rest.push(row);
        else byGroup.set(id, [...byGroup.get(id) ?? [], row]);
    }
    return { rest, byGroup };
}

/** A vehicle row's key: its actor's id (the vehicles a character drives are world actors, uuid Actor.<id>). */
export function vehicleRowKey(uuid: string | null | undefined): string | null {
    return uuid?.split('.').at(-1) || null;
}
