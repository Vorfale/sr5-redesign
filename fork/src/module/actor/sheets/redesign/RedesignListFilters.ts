import { SR5 } from '@/module/config';
import { SR5Actor } from '@/module/actor/SR5Actor';
import { ELEMENT_ICONS } from '@/module/handlebars/RollAndLabelHelpers';

// The list search of the redesigned sheets: filter chips per tab, sort modes, timing (SR5CharacterSheetRedesign).

/**
 * Filter chips of the list search on each tab (redesign/list-controls.hbs). Chips sharing a group are alternatives
 * (any of them); different groups all have to match. Tabs listed without chips get the search field only.
 */
/**
 * What a chip reads of a listed document: an item, an active effect or a vehicle actor, so every field may be
 * missing.
 */
export type ListedDoc = {
    type?: string; disabled?: boolean; isSuppressed?: boolean; isTemporary?: boolean;
    isEquipped?: () => boolean; isWireless?: () => boolean;
    system?: {
        [field: string]: unknown;
        action?: { type?: string; damage?: { element?: { value?: string } } };
        controlMode?: string; isDrone?: boolean; duration?: string; track?: { physical?: { value?: number } };
    };
} | null | undefined;

export interface ListFilterChip {
    id: string; label: string; icon?: string; group?: string; test: (doc: ListedDoc) => boolean;
    /** Offered only when the actor has something it would find; without it the chip is always in the menu. */
    offered?: (actor: SR5Actor) => boolean;
}
/** A vehicle's control mode as an icon (the vehicles tab's expanded rows and its filter menu). */
export const VEHICLE_CONTROL_ICONS: Record<string, string> = { manual: 'fa-hand', remote: 'fa-gamepad', rigger: 'fa-plug-circle-bolt', autopilot: 'fa-robot' };
/** Headings of the filter groups in the menu. */
export const LIST_FILTER_GROUPS: Record<string, string> = {
    type: 'SR5.ActionType.Label',
    spellType: 'SR5.Spell.Type',
    spellRange: 'SR5.Spell.Range',
    spellDuration: 'SR5.Duration',
    element: 'SR5.Element.Label',
    vehicleKind: 'SR5.Redesign.Vehicles.Filter.Kind',
    spellCategory: 'SR5.Redesign.ListFilter.SpellCategory',
    controlMode: 'SR5.Vehicle.ControlMode',
};
/** One option per value of a spell field (type, range, duration), labelled like the magic table's cells. */
const spellOptions = (group: string, field: string, labels: Record<string, string>): ListFilterChip[] =>
    Object.entries(labels).map(([value, label]) => ({ id: `${field}-${value}`, label, group, test: doc => doc?.system?.[field] === value }));
/** Item types of the magic tab that can deal elemental damage. */
const ELEMENTAL_MAGIC_TYPES = new Set(['spell', 'ritual', 'adept_power']);
const hasElement = (doc: ListedDoc, element: string) => doc?.system?.action?.damage?.element?.value === element;
/** One option per damage element the actor's spells, rituals and adept powers deal; none of them, no Element group. */
const elementOptions = (): ListFilterChip[] =>
    Object.entries(SR5.elementTypes).map(([value, label]) => ({
        id: `element-${value}`, label, icon: ELEMENT_ICONS[value], group: 'element', test: doc => hasElement(doc, value),
        offered: actor => actor.items.some(item => ELEMENTAL_MAGIC_TYPES.has(item.type) && hasElement(item as ListedDoc, value)),
    }));
const isWireless = (doc: ListedDoc) => typeof doc?.isWireless === 'function' && doc.isWireless();
const actionType = (type: string): ListFilterChip =>
    ({ id: type, label: `SR5.ActionType.${type.charAt(0).toUpperCase()}${type.slice(1)}`, group: 'type', test: doc => doc?.system?.action?.type === type });
export const LIST_FILTERS: Record<string, ListFilterChip[]> = {
    inventory: [
        { id: 'equipped', label: 'SR5.Redesign.ListFilter.Equipped', icon: 'fa-hand-holding', test: doc => typeof doc?.isEquipped === 'function' && doc.isEquipped() },
        { id: 'wireless', label: 'SR5.Redesign.ListFilter.Wireless', icon: 'fa-wifi', test: isWireless },
    ],
    augmentations: [
        { id: 'wireless', label: 'SR5.Redesign.ListFilter.Wireless', icon: 'fa-wifi', test: isWireless },
    ],
    actions: ['free', 'simple', 'complex', 'interrupt'].map(actionType),
    // the magic table's columns: type, range, duration; then the element of elemental spells
    magic: [
        // the category the cards split by: in one list, the way to narrow it down to one
        ...spellOptions('spellCategory', 'category', SR5.spellCategories),
        ...spellOptions('spellType', 'type', SR5.spellTypes),
        ...spellOptions('spellRange', 'range', SR5.spellRanges),
        ...spellOptions('spellDuration', 'duration', SR5.durations),
        ...elementOptions(),
    ],
    // the vehicles tab: vehicle or drone, the control mode (its icon as in the expanded row), damaged ones
    vehicles: [
        { id: 'vehicle', label: 'SR5.Redesign.Vehicles.Vehicles', icon: 'fa-car-side', group: 'vehicleKind', test: doc => doc?.type === 'vehicle' && !doc.system?.isDrone },
        { id: 'drone', label: 'SR5.Redesign.Vehicles.Drones', icon: 'fa-robot', group: 'vehicleKind', test: doc => doc?.type === 'vehicle' && !!doc.system?.isDrone },
        ...Object.entries(SR5.vehicle.control_modes as Record<string, string>).map(([mode, label]) =>
            ({ id: `control-${mode}`, label, icon: VEHICLE_CONTROL_ICONS[mode], group: 'controlMode', test: (doc: ListedDoc) => doc?.system?.controlMode === mode })),
        { id: 'damaged', label: 'SR5.Redesign.Vehicles.Filter.Damaged', icon: 'fa-car-burst', test: doc => (doc?.system?.track?.physical?.value ?? 0) > 0 },
    ],
    matrix: [
        { id: 'sustained', label: 'SR5.Redesign.ListFilter.Sustained', icon: 'fa-hourglass-half', test: doc => doc?.system?.duration === 'sustained' },
    ],
    effects: [
        { id: 'active', label: 'SR5.Redesign.ListFilter.Active', icon: 'fa-circle-check', test: doc => !!doc && !doc.disabled && !doc.isSuppressed },
        { id: 'temporary', label: 'SR5.Redesign.ListFilter.Temporary', icon: 'fa-hourglass-half', test: doc => !!doc?.isTemporary },
    ],
    social: [],
    bio: [],
    critterPowers: [],
};
/** Modes of the sort button by a tab's search, in the order it cycles through them (as dnd5e's). */
export const LIST_SORT_MODES = [
    { label: 'SR5.Redesign.ListSort.Sheet', icon: 'fa-arrow-down-short-wide', sort: null },
    { label: 'SR5.Redesign.ListSort.NameAsc', icon: 'fa-arrow-down-a-z', sort: { key: 'name', dir: 'asc' } },
    { label: 'SR5.Redesign.ListSort.NameDesc', icon: 'fa-arrow-down-z-a', sort: { key: 'name', dir: 'desc' } },
] as const;
/** Modes of the skills tab's sort button, in the order it cycles through them; the first is the tables' default. */
export const SKILL_SORT_MODES = [
    { label: 'SR5.Redesign.ListSort.NameAsc', icon: 'fa-arrow-down-a-z', sort: null },
    { label: 'SR5.Redesign.ListSort.NameDesc', icon: 'fa-arrow-down-z-a', sort: { key: 'name', dir: 'desc' } },
    { label: 'SR5.Redesign.ListSort.PoolDesc', icon: 'fa-arrow-down-9-1', sort: { key: 'pool', dir: 'desc' } },
    { label: 'SR5.Redesign.ListSort.RatingDesc', icon: 'fa-arrow-down-wide-short', sort: { key: 'rtg', dir: 'desc' } },
] as const;
/** The skill tables of the skills tab (knowledge: all knowledge and language tables share one sort). */
export const SKILL_SORT_TABLES = ['active', 'knowledge'] as const;
/** Tabs that show the list search for now (the user's choice); the filters of the other tabs above are kept for later. */
export const LIST_SEARCH_TABS = new Set(['inventory', 'augmentations', 'actions', 'magic', 'vehicles']);
/** Filter groups with more options than this lay them out in two columns, so long menus stay on screen. */
export const LIST_FILTER_COLUMNS_FROM = 4;
/** How long typing in a list search may pause before the rows are filtered. */
export const LIST_SEARCH_DELAY_MS = 120;
/** Lower case without accents, so "cafe" finds "Café". */
export const searchText = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(game.i18n.lang).trim();
