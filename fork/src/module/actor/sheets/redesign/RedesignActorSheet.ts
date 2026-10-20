import { SR5CharacterSheet } from '@/module/actor/sheets/SR5CharacterSheet';
import type { CharacterSheetData } from '@/module/actor/sheets/SR5CharacterSheet';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { SR5Item } from '@/module/item/SR5Item';
import type { SR5Actor } from '@/module/actor/SR5Actor';
import type { DrainTest } from '@/module/tests/DrainTest';
import type { FadeTest } from '@/module/tests/FadeTest';
import { PackItemFlow } from '@/module/item/flows/PackItemFlow';
import { MonitorRules } from '@/module/rules/MonitorRules';
import { SYSTEM_NAME } from '@/module/constants';
import { SR5 } from '@/module/config';
import { isElementInstance } from '@/module/utils/dom';
import { InventoryRenameApp } from '@/module/apps/actor/InventoryRenameApp';
import { KarmaManager } from '@/module/apps/actor/KarmaManager';
import { NuyenManager } from '@/module/apps/actor/NuyenManager';
import { ReputationManager } from '@/module/apps/actor/ReputationManager';
import { Helpers } from '@/module/helpers';
import { LinksHelpers } from '@/module/utils/links';
import { RichTooltip } from '@/module/actor/sheets/SR5RichTooltip';
import { RowMenu } from '@/module/actor/sheets/RedesignRowMenu';
import { SkillRules } from '@/module/rules/SkillRules';
import { ModifierFlow } from '@/module/actor/flows/ModifierFlow';
import { RedesignPool, RolledPool } from '@/module/actor/sheets/RedesignPool';
import { TestCreator } from '@/module/tests/TestCreator';
import { SuccessTest } from '@/module/tests/SuccessTest';
import { SuccessTestEffectsFlow } from '@/module/effect/flows/SuccessTestEffectsFlow';
import { allApplicableDocumentEffects, allApplicableItemsEffects } from '@/module/effects';
import { SR5ActiveEffect } from '@/module/effect/SR5ActiveEffect';
import { SkillNamingFlow } from '@/module/flows/SkillNamingFlow';
import { RedesignNetworkManager, confirmPersonaReboot } from '@/module/actor/sheets/RedesignMatrixApps';
import { wireListFilterMenu } from '@/module/actor/sheets/RedesignListControls';
import { RedesignSettings } from '@/module/actor/sheets/RedesignSettings';
import { ListFilterChip, VEHICLE_CONTROL_ICONS, LIST_FILTER_GROUPS, LIST_FILTERS, LIST_SORT_MODES, SKILL_SORT_MODES, SKILL_SORT_TABLES, LIST_SEARCH_TABS, LIST_FILTER_COLUMNS_FROM, LIST_SEARCH_DELAY_MS, searchText } from '@/module/actor/sheets/redesign/RedesignListFilters';
import { onIdle, SHOWN_PARTS, NESTED_PARTS, PARENT_PART, SHOWN_ONLY_PARTS, UPDATE_PARTS, COUNT_KEYS, ITEM_PARTS } from '@/module/actor/sheets/redesign/RedesignRenderMap';
import { NATIVE_CONTROLS, enhanceAccessibility } from '@/module/actor/sheets/redesign/RedesignAccessibility';
import { ACTION_TYPE_ORDER, ASCENDING_SORT_KEYS, NUMERIC_SORT_KEYS, SkillSortKey, SkillTable, TableSort, cardRows, compareSortValues, sortCell, sortValue } from '@/module/actor/sheets/redesign/RedesignTableSort';
import { showMatrixLoader, warmMatrixNetworks } from '@/module/actor/sheets/redesign/RedesignMatrixLoader';
import { SHEET_FONTS, rememberImages, warmUp } from '@/module/actor/sheets/redesign/RedesignWarmUp';
import { SheetArt } from '@/module/actor/sheets/redesign/RedesignSheetArt';
import { ActionTracker } from '@/module/actor/sheets/redesign/RedesignActionTracker';
import { measureSidebarBar, wireCollapserTooltip, wireSidebarScrollLane } from '@/module/actor/sheets/redesign/RedesignSidebar';
import { wireInitiativeMenu } from '@/module/actor/sheets/redesign/RedesignBarMenus';
import { InitiativeRules } from '@/module/rules/InitiativeRules';
import type { SkillFieldType } from '@/module/types/template/Skills';
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

export { VEHICLE_CONTROL_ICONS };

/**
 * EXPERIMENTAL (lab/sheet-redesign): SR5 Redesign, the base of the redesigned actor sheets (SR5CharacterSheetRedesign,
 * SR5VehicleSheetRedesign).
 *
 * All game logic, actions and context come from SR5CharacterSheet; only the frame
 * (header, sidebar, attribute row, icon tab rail) and two tab bodies (details, inventory) are new.
 * Other tabs reuse the regular SR5 templates and are restyled through `.sr5-redesign` CSS.
 * No art assets are bundled; shapes are drawn with CSS.
 */

const sheetTemplate = (path: string) => SheetFlow.templateBase(`actor/redesign/${path}`);

/** Attribute display order of the attribute plates in the header. */
const CORE_ATTRIBUTES = ['body', 'agility', 'reaction', 'strength', 'willpower', 'logic', 'intuition', 'charisma'] as const;
/** On the official SR5 sheet physical attribute labels are printed in crimson. */
const PHYSICAL_ATTRIBUTES = new Set(['body', 'agility', 'reaction', 'strength']);
/** Mental attributes get their own (blue) label colour to set them apart from the physical ones. */
const MENTAL_ATTRIBUTES = new Set(['willpower', 'logic', 'intuition', 'charisma']);
/** The sheet fonts, once (_prepareContext waits for them on the first render). */
let fontsReady: Promise<unknown> | null = null;
/** Limits (SR5#101, astral SR5#278), shown as one evenly spaced row under the attribute plates. */
const LIMITS = ['physical', 'mental', 'social', 'astral'] as const;
/**
 * General actions rolled most often at the table, in display order.
 * Keyed by the English pack name (the same names PackItemFlow uses), valued by the short-label locale key.
 */
const QUICK_ROLLS: Record<string, string> = {
    'Physical Defense': 'defense',
    'Physical Damage Resist': 'soak',
    'Composure': 'composure',
    'Judge Intentions': 'judgeIntentions',
    'Memory': 'memory',
    'Lift Carry': 'liftCarry',
    'Drain': 'drain',
    'Fade': 'fade',
};

interface PlateAttributeData {
    id: string;
    short: string;
    label: string;
    value: number;
    base: number;
    field: unknown;
    rollable: boolean;
    physical: boolean;
    mental: boolean;
}

interface QuickRollData extends RolledPool {
    uuid: string;
    name: string;
    short: string;
}

interface MonitorCellData {
    value: number;
    filled: boolean;
    wound?: number;
    /** Edge only: the `uses` value a click on this pip sets. */
    uses?: number;
}

/** A skill as the prepared actor holds it (its ModifiableField adds the rating as `value`). */
type PreparedSkill = SkillFieldType & { value: number };

/**
 * The prepared system data the sheet reads, of every actor type it shows: a vehicle has attributes and limits of its
 * own and no skills, so all of it may be missing.
 */
/** A condition monitor as prepared (pain tolerance only on characters and spirits, overflow on physical). */
type PreparedTrack = { value: number; max: number; disabled?: boolean; pain_tolerance?: number; overflow?: { value: number; max: number } };

export interface PreparedSheetSystem {
    attributes?: Record<string, { label: string; value: number; base: number; limit?: string } | undefined>;
    track?: Record<string, PreparedTrack | undefined>;
    armor?: { rating?: { value?: number } };
    limits?: Record<string, { value: number; hidden?: boolean } | undefined>;
    skills?: {
        active?: Record<string, PreparedSkill>;
        language?: Record<string, PreparedSkill>;
        knowledge?: Record<string, Record<string, PreparedSkill> | undefined>;
    };
}

interface RedesignSheetData {
    systemFields?: { attributes?: { fields?: Record<string, unknown> } };
    edgeRemaining?: number;
    archetype?: unknown;
    archetypeName?: string;
    showEmptyCategories?: boolean;
    footerLedgers?: { karma: boolean; nuyen: boolean; reputation: boolean };
    showEmptyName?: string;
    hasSheetArt?: boolean;
    sheetPortrait?: string;
    modifierSources?: unknown;
    skillLabels?: Record<string, string>;
    favoriteIds?: Record<string, boolean>;
    skillSources?: Record<string, string>;
    attributePlates?: PlateAttributeData[];
    specialAttributePlates?: PlateAttributeData[];
    attributeGroups?: { id: string; attributes: PlateAttributeData[] }[];
    attributeLimits?: { id: string; label: string; value: number }[];
    skillPools?: Record<string, RolledPool & { attribute: string }>;
    monitors?: { id: string; label: string; icon: string; rollable: boolean; value: number; max: number; columns: number; cells: MonitorCellData[] }[];
    edgeCells?: MonitorCellData[];
    favorites?: SR5Item[];
    quickRolls?: QuickRollData[];
    containers?: { item: SR5Item; count: number }[];
    qualities?: { positive: SR5Item[]; negative: SR5Item[] };
}

/**
 * A part's context: the system sheet's data, this sheet's (_prepareContext) and what each part adds. The parts read
 * back the fields typed here; the rest only go to the templates, and the sheets built on this one add their own.
 */
export type RedesignPartContext = CharacterSheetData & RedesignSheetData & {
    [key: string]: unknown;
    initiativeModes?: InitiativeModeData[];
    qualities?: { positive: SR5Item[]; negative: SR5Item[] };
    implantInventory?: string;
    tabEmpty?: boolean;
    showQualities?: boolean;
    skillGroups?: unknown[];
};

/** What an action's kind is read from (its action data: categories, type, what it rolls). */
type ActionKindSource = { categories?: string[]; type?: string; armor?: boolean; skill?: string; attribute?: string; attribute2?: string };

/** An initiative the sidebar's menu offers: a perception mode and what it rolls. */
interface InitiativeModeData { value: string, label: string, icon: string, formula: string, active: boolean }

const { header: _header, rollBar: _rollBar, tabs: _tabs, footer: _footer, skills: _skills, inventory: _inventory, ...otherParts }
    = SR5CharacterSheet.PARTS as typeof SR5CharacterSheet.PARTS & Record<string, HandlebarsApplicationMixin.HandlebarsTemplatePart>;

/**
 * Containers (the container item type of the upstream containers work, system 0.38) stay off until upstream releases
 * them: no container tiles, no "Add container" on the inventory tab. Turn on to bring the code path back.
 */
const CONTAINERS_ENABLED = false;

/** Collapsible cards of the bio tab (redesign/bio.hbs), keys of their open / closed state. */
const BIO_CARD_TYPES = ['quality_positive', 'quality_negative', 'metamagic', 'echo'];

// list types shown as collapsible cards in the magic and social tabs (spell categories have their own keys)
const CARD_TABLE_TYPES = ['adept_power', 'spell', 'spell_all', 'combatspells', 'detectionspells', 'healthspells', 'illusionspells',
    'manipulationspells', 'ritual', 'call_in_action', 'sin', 'lifestyle', 'contact'];

/** Matrix action tables, one per limit, in this order; actions without a limit go last. */
const MATRIX_ACTION_LIMITS = ['attack', 'sleaze', 'data_processing', 'firewall'] as const;
/**
 * The Actions tab's groups "by kind", in the order they are listed (upstream #755 asks for groups instead of name
 * prefixes). Most actions there are the system's general actions, many without a category, so a group comes from
 * the action's categories first, then its type (interrupts) and its roll (attributes only: an attribute test).
 */
const ACTION_KINDS = ['attack', 'defense', 'interrupt', 'resist', 'attribute', 'magic', 'matrix', 'resonance', 'rigging', 'social', 'recovery', 'other'] as const;
type ActionKind = typeof ACTION_KINDS[number];
/** Category prefixes per kind (a category belongs to the first kind whose prefix it starts with). */
const ACTION_KIND_CATEGORIES: [ActionKind, string[]][] = [
    ['attack', ['attack']],
    ['defense', ['defense']],
    ['resist', ['resist', 'drain', 'fade']],
    ['magic', ['magic', 'spell', 'summoning']],
    ['matrix', ['matrix', 'brute_force', 'hack_on_the_fly']],
    ['resonance', ['resonance', 'compiling', 'complex_form']],
    ['rigging', ['rigging']],
    ['social', ['social']],
    ['recovery', ['recovery']],
];
/** Ways the Actions tab can lay out its actions (the grouping button by its search). */

/** The magic tab's views: the spells in a card per category (default), or all in one table with a category column. */
const SPELL_GROUPINGS = [
    { mode: 'category', label: 'SR5.Redesign.SpellGrouping.Category', icon: 'fa-layer-group' },
    { mode: 'none', label: 'SR5.Redesign.SpellGrouping.None', icon: 'fa-list' },
] as const;

// Every tab's view button works alike (list-controls.hbs, listGrouping): a click goes to the tab's next view, the
// button is filled while the view is not the tab's default, its tooltip names the view; grouped views show layers,
// one list a list; per user; play mode only (edit mode keeps the cards that Add works in).
const ACTION_GROUPINGS = [
    { mode: 'none', label: 'SR5.Redesign.ActionGroups.None', icon: 'fa-list' },
    { mode: 'kind', label: 'SR5.Redesign.ActionGroups.Kind', icon: 'fa-layer-group' },
] as const;

/** Render option of an item sheet (SR5ApplicationMixin's edit / play mode), which Foundry's render types do not list. */
const OPEN_IN_EDIT_MODE: object = { mode: 'edit' };

export class SR5RedesignActorSheet extends SR5CharacterSheet {
    // Play mode lists trained skills only; the eye button next to the filter toggles it, edit mode shows everything.
    // Untrained skills are filtered by the skill filter menu (#skillFilters), not by the base sheet's flag.
    override _filters = { skills: '', showUntrainedSkills: true };
    /** Skill filter menu: chosen options (training:*, attr:*, group:*); null until the user picks one, so the mode's
     * default applies (play mode: trained skills, edit mode: all, so untrained ones can be raised). A choice holds
     * in the mode it was made in: switching mode goes back to that mode's default. */
    #skillFilters: { edit: boolean, options: Set<string> } | null = null;
    /** Skill name (lower case) -> skill group name, from the system's skill groups pack and the actor's own groups. */
    #skillGroupOf = new Map<string, string>();

    /**
     * Sort state per sortable table: active skills; languages + knowledge share one; each matrix action table; each
     * card table of the item tabs (`<tab>:<type>:<n>`). Remembered per user and actor type (SORT_FLAG). A table
     * without an entry is in its default order (skills: name A-Z; cards: the order the sheet lists them in).
     */
    #tableSort: Record<string, TableSort> = SR5RedesignActorSheet.#savedSort(this.document?.type);
    #sortObserver: MutationObserver | null = null;
    /** Implant list shown on the augmentations tab (see IMPLANT_INVENTORY_TYPE); null: the installed implants. */
    #implantInventory: string | null = null;
    /** When an inventory picker last changed (performance.now()); see _configureRenderOptions. */
    #pickerChangedAt = -Infinity;
    /** Favorite moved with the keyboard (Alt + arrows): its row gets the focus back after the re-render. */
    #focusFavorite: string | null = null;
    /** List search and filter chips per tab (LIST_FILTERS), kept for the sheet's lifetime and reapplied on render. */
    #listFilters = new Map<string, { query: string; chips: Set<string> }>();
    /** Tab whose search field had the focus, so a re-render while typing keeps it there. */
    #listSearchFocus: string | null = null;

    static override DEFAULT_OPTIONS = {
        classes: ['sr5-redesign', 'vertical-tabs'],
        // 940: the social tab's two columns fit (actor-redesign.scss, .sr-social), and Foundry's smallest window (1024px) still holds it
        position: { width: 940, height: 900 },
        actions: {
            ...SR5CharacterSheet.DEFAULT_OPTIONS.actions,
            toggleSidebar: SR5RedesignActorSheet.#toggleSidebar,
            sortSkills: SR5RedesignActorSheet.#sortSkills,
            cycleSkillSort: SR5RedesignActorSheet.#cycleSkillSort,
            sortTable: SR5RedesignActorSheet.#sortTable,
            cycleListSort: SR5RedesignActorSheet.#cycleListSort,
            toggleSkillFilter: SR5RedesignActorSheet.#toggleSkillFilter,
            clearSkillFilters: SR5RedesignActorSheet.#clearSkillFilters,
            setInitiativeMode: SR5RedesignActorSheet.#setInitiativeMode,
            // inventories are managed from the inventory and the augmentations tab, each with its own selection
            createInventory: SR5RedesignActorSheet.#createInventory,
            renameInventory: SR5RedesignActorSheet.#renameInventory,
            removeInventory: SR5RedesignActorSheet.#removeInventory,
            setSheetArt: SR5RedesignActorSheet.#setSheetArt,
            clearSheetArt: SR5RedesignActorSheet.#clearSheetArt,
            setSheetPortrait: SR5RedesignActorSheet.#setSheetPortrait,
            clearSheetPortrait: SR5RedesignActorSheet.#clearSheetPortrait,
            repositionSheetArt: SR5RedesignActorSheet.#repositionSheetArt,
            saveSheetArtPosition: SR5RedesignActorSheet.#saveSheetArtPosition,
            cancelSheetArtPosition: SR5RedesignActorSheet.#cancelSheetArtPosition,
            toggleListFilter: SR5RedesignActorSheet.#toggleListFilter,
            cycleSpellGrouping: SR5RedesignActorSheet.#cycleSpellGrouping,
            clearListFilters: SR5RedesignActorSheet.#clearListFilters,
            // the footer's managers, in the sheet's look
            openKarmaManager: SR5RedesignActorSheet.#openKarmaManager,
            openNuyenManager: SR5RedesignActorSheet.#openNuyenManager,
            openReputationManager: SR5RedesignActorSheet.#openReputationManager,
            // the action tracker under the initiative
            spendAction: SR5RedesignActorSheet.#spendAction,
            resetActions: SR5RedesignActorSheet.#resetActions,
            changeFreeActions: SR5RedesignActorSheet.#changeFreeActions,
            cycleActionGrouping: SR5RedesignActorSheet.#cycleActionGrouping,
            addActionGroup: SR5RedesignActorSheet.#addActionGroup,
            renameActionGroup: SR5RedesignActorSheet.#renameActionGroup,
            removeActionGroup: SR5RedesignActorSheet.#removeActionGroup,
            addGroupAction: SR5RedesignActorSheet.#addGroupAction,
            // the matrix popups, in the sheet's look
            openNetworkManager: SR5RedesignActorSheet.#openNetworkManager,
            rebootPersona: SR5RedesignActorSheet.#rebootPersona,
        },
    };

    static async #openKarmaManager(this: SR5RedesignActorSheet) {
        await this.#openApp(new KarmaManager(this.actor, this.#appOptions()));
    }

    static async #openNuyenManager(this: SR5RedesignActorSheet) {
        // nuyen amounts are long ("¥61,200" on both sides of three steps): a wider window than the upstream 400px
        await this.#openApp(new NuyenManager(this.actor, { ...this.#appOptions(), position: { width: 480 } }));
    }

    static async #openReputationManager(this: SR5RedesignActorSheet) {
        await this.#openApp(new ReputationManager(this.actor, this.#appOptions()));
    }

    static async #openNetworkManager(this: SR5RedesignActorSheet) {
        await this.#openApp(new RedesignNetworkManager(this.actor, this.#appOptions()));
    }

    /** Reboots the persona device after the sheet's own confirmation; the rest as upstream (MatrixSheetFlow). */
    static async #rebootPersona(this: SR5RedesignActorSheet) {
        const category = this.actor.getMatrixDevice()?.system.category ?? '';
        const confirmed = await confirmPersonaReboot(this.actor, {
            classes: [...this.#appOptions().classes, ...this.#themeClasses()],
            icon: SR5RedesignActorSheet.DEVICE_ICONS[category] ?? 'fa-microchip',
        });
        if (!confirmed) return;
        await this.actor.rebootPersona();
        // a stale target selection, mostly of marked icons, which the reboot cleared
        this.toggleMatrixTargetSelection(undefined);
        void this.render();
    }

    /** Options for an app the sheet opens: `sr5-redesign-app` gives it the sheet's look (redesign-apps.scss). */
    #appOptions() {
        return { classes: ['sr5-redesign-app'] };
    }

    /**
     * Renders an app the sheet opens in the sheet's theme: the sheet's own (Configure Sheet) or else the applications'
     * theme. Foundry themes new windows by the applications' setting alone.
     */
    async #openApp(app: foundry.applications.api.ApplicationV2.Any) {
        await app.render({ force: true });
        app.element.classList.remove('theme-dark', 'theme-light');
        app.element.classList.add(...this.#themeClasses());
    }

    /** The sheet's theme as window classes, for an app that renders itself (a prompt dialog). */
    #themeClasses() {
        const light = this.element.classList.contains('theme-light')
            || (!this.element.classList.contains('theme-dark') && document.body.classList.contains('theme-light'));
        return ['themed', light ? 'theme-light' : 'theme-dark'];
    }

    /** Item types and the parts that show them (ITEM_PARTS); a sheet built on this one adds its own. */
    static readonly ITEM_PARTS: Record<string, string[]> = ITEM_PARTS;

    static override TABS = {
        ...SR5CharacterSheet.TABS,
        primary: {
            initial: 'skills',
            tabs: [
                // Font Awesome Free icons only: the module has no Pro license (the Pro originals: notes/audits/icons)
                { id: 'skills', label: 'SR5.Redesign.Tabs.Details', icon: 'fas fa-user', tooltip: 'SR5.Redesign.Tabs.Details', cssClass: '' },
                { id: 'inventory', label: 'SR5.Tabs.Actor.Inventory', icon: 'fas fa-toolbox', tooltip: 'SR5.Tabs.Actor.Inventory', cssClass: '' },
                { id: 'augmentations', label: 'SR5.Redesign.Tabs.Augmentations', icon: 'fas fa-robot', tooltip: 'SR5.Redesign.Tabs.Augmentations', cssClass: '' },
                { id: 'actions', label: 'SR5.Tabs.Actor.Actions', icon: 'fas fa-hand-fist', tooltip: 'SR5.Tabs.Actor.Actions', cssClass: '' },
                { id: 'magic', label: 'SR5.Tabs.Actor.Magic', icon: 'fas fa-wand-magic-sparkles', tooltip: 'SR5.Tabs.Actor.Magic', cssClass: '' },
                { id: 'matrix', label: 'SR5.Tabs.Actor.Matrix', icon: 'fas fa-laptop-code', tooltip: 'SR5.Tabs.Actor.Matrix', cssClass: '' },
                { id: 'critterPowers', label: 'SR5.Tabs.Actor.CritterPowers', icon: 'fas fa-paw', tooltip: 'SR5.Tabs.Actor.CritterPowers', cssClass: '' },
                { id: 'social', label: 'SR5.Tabs.Actor.Social', icon: 'fas fa-people-group', tooltip: 'SR5.Tabs.Actor.Social', cssClass: '' },
                { id: 'bio', label: 'SR5.Tabs.Actor.Bio', icon: 'fas fa-dna', tooltip: 'SR5.Tabs.Actor.Bio', cssClass: '' },
                { id: 'effects', label: 'SR5.Tabs.Actor.Effects', icon: 'fas fa-bolt-lightning', tooltip: 'SR5.Tabs.Actor.Effects', cssClass: '' },
                { id: 'description', label: 'SR5.Description', icon: 'fas fa-info', tooltip: 'SR5.Tooltips.Actor.Description', cssClass: '' },
                { id: 'misc', label: 'SR5.Redesign.Tabs.Misc', icon: 'fas fa-gear', tooltip: 'SR5.Redesign.Tabs.Misc', cssClass: '' },
            ]
        },
    };

    static override PARTS = {
        header: { template: sheetTemplate('header') },
        // scrollable: [''] = the part's root element, so re-renders (item toggles, damage...) keep the scroll position
        sidebar: { template: sheetTemplate('sidebar'), scrollable: [''] },
        abilities: { template: sheetTemplate('attributes') },
        tabs: { template: sheetTemplate('tabs') },
        skills: {
            template: sheetTemplate('details'),
            templates: [
                sheetTemplate('skills'),
                sheetTemplate('knowledge'),
                sheetTemplate('skill-row'),
                sheetTemplate('empty-row'),
                ...SheetFlow.templateListItem('skill-group'),
            ],
            scrollable: [''],
        },
        inventory: {
            template: sheetTemplate('inventory'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab')],
            scrollable: [''],
        },
        // the regular SR5 tabs mark an inner .scrollable, but in this sheet the tab section itself scrolls
        ...(Object.fromEntries(Object.entries(otherParts).map(([id, part]) =>
            [id, { ...part, scrollable: ['', ...(part.scrollable ?? [])] }])) as typeof otherParts),
        // magic and social as separate cards (one per spell category / list), like the inventory
        magic: {
            template: sheetTemplate('magic'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), sheetTemplate('card-table'), ...SheetFlow.templateListItem('adept_power', 'spell', 'ritual', 'call_in_action')],
            scrollable: [''],
        },
        social: {
            template: sheetTemplate('social'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), sheetTemplate('card-table'), ...SheetFlow.templateListItem('sin', 'lifestyle', 'contact')],
            scrollable: [''],
        },
        // cyberware and bioware, moved out of the inventory
        augmentations: {
            template: sheetTemplate('augmentations'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), ...SheetFlow.templateListItem('cyberware', 'bioware')],
            scrollable: [''],
        },
        // actions, bio, effects, description: the upstream lists / text wrapped in cards
        actions: {
            template: sheetTemplate('actions'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), ...SheetFlow.templateListItem('action')],
            scrollable: [''],
        },
        description: {
            template: sheetTemplate('description'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab')],
            scrollable: [''],
        },
        bio: {
            template: sheetTemplate('bio'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), ...SheetFlow.templateListItem('quality', 'metamagic', 'echo')],
            scrollable: [''],
        },
        effects: {
            template: sheetTemplate('effects'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), ...SheetFlow.templateListItem('effect')],
            scrollable: [''],
        },
        // matrix: device / network / matrix actions cards (the sub-tab parts keep their upstream definitions)
        matrix: {
            ...otherParts.matrix,
            template: sheetTemplate('matrix'),
            templates: [...(otherParts.matrix?.templates ?? []), sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab')],
            scrollable: ['', ...(otherParts.matrix?.scrollable ?? [])],
        },
        // matrix actions: one table per limit, sortable and collapsible
        matrixActions: {
            ...otherParts.matrixActions,
            template: sheetTemplate('matrix-actions'),
            templates: [sheetTemplate('matrix-action-row')],
        },
        // the other matrix sub-tabs: the upstream lists plus a note that says why a list is empty
        ...Object.fromEntries(([
            ['networkIcons', 'matrix-network-icons'], ['markedIcons', 'matrix-marked-icons'], ['ownedIcons', 'matrix-owned-icons'],
            ['programs', 'matrix-programs'], ['complexForms', 'matrix-complex-forms'], ['compilations', 'matrix-compilations'],
        ] as const).map(([id, template]) => [id, { ...otherParts[id], template: sheetTemplate(template) }])),
        critterPowers: {
            ...otherParts.critterPowers,
            template: sheetTemplate('critter-powers'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), ...SheetFlow.templateListItem('critter_power')],
            scrollable: [''],
        },
        // configuration: the upstream rows as cards
        misc: {
            template: sheetTemplate('misc'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab')],
            scrollable: [''],
        },
        collapser: { template: sheetTemplate('collapser') },
        footer: { template: sheetTemplate('footer') },
    };

    /** Fetch fonts, likely pictures and templates ahead of a first opening (RedesignWarmUp). */
    static warmUp() {
        warmUp(async () => SR5RedesignActorSheet.#generalPackActions(), QUICK_ROLLS);
    }

    override async _prepareContext(options: Parameters<SR5CharacterSheet['_prepareContext']>[0]) {
        // wait for the faces once (so the first paint has the right metrics), but never more than 300 ms
        fontsReady ??= Promise.race([
            Promise.all(SHEET_FONTS.map(async font => document.fonts.load(font))).catch(() => null),
            new Promise(resolve => { window.setTimeout(resolve, 300); }),
        ]);
        await fontsReady;
        // implant lists are not inventories of the inventory tab
        if (this.#isImplantInventory(this.selectedInventory)) this.selectedInventory = this.actor.defaultInventory.name;
        const data = await super._prepareContext(options) as Awaited<ReturnType<SR5CharacterSheet['_prepareContext']>> & RedesignSheetData;
        const system = data.system as PreparedSheetSystem;
        const fields = data.systemFields?.attributes?.fields ?? {};

        const toAttribute = (id: string, rollable = true): PlateAttributeData | null => {
            const attribute = system.attributes?.[id];
            if (!attribute) return null;
            return {
                id,
                short: game.i18n.localize(`SR5.Redesign.AttrShort.${id}`),
                label: game.i18n.localize(attribute.label),
                value: attribute.value,
                base: attribute.base,
                field: fields[id],
                rollable,
                physical: PHYSICAL_ATTRIBUTES.has(id),
                mental: MENTAL_ATTRIBUTES.has(id),
            };
        };

        data.attributePlates = CORE_ATTRIBUTES.map(id => toAttribute(id)).filter(a => a !== null);
        const physical = data.attributePlates.filter(a => a.physical);
        const mental = data.attributePlates.filter(a => a.mental);
        const special: (PlateAttributeData | null)[] = [toAttribute('edge')];
        if (data.awakened) special.push(toAttribute('magic'));
        if (data.emerged) special.push(toAttribute('resonance'));
        special.push(toAttribute('essence', false));
        data.specialAttributePlates = special.filter(a => a !== null);
        // Edge still available this session (rating minus spent); shown by the sidebar pips and under the EDG plate
        const edge = this.actor.system.attributes.edge;
        data.edgeRemaining = Math.max(0, (edge?.value ?? 0) - (edge?.uses ?? 0));

        // header line: archetype is a free label kept in a flag (the system has no field for it)
        data.archetype = (this.actor as unknown as { getFlag(scope: string, key: string): unknown })
            .getFlag(SYSTEM_NAME, SR5RedesignActorSheet.ARCHETYPE_FLAG) ?? '';
        data.archetypeName = `flags.${SYSTEM_NAME}.${SR5RedesignActorSheet.ARCHETYPE_FLAG}`;
        data.showEmptyCategories = !this.hideEmptyCategories();
        // the footer's ledgers by what the actor is (SR5 Grunts, Prime Runners, Critters): player characters and prime
        // runners (NPCs built and advanced like them) keep karma, nuyen and reputation; a grunt is nameless, cash
        // only; a critter NPC none of them
        const npc = !!this.actor.system.is_npc;
        const grunt = npc && !!this.actor.system.npc?.is_grunt;
        const critterNpc = npc && !!this.actor.system.is_critter;
        data.footerLedgers = { karma: !grunt && !critterNpc, nuyen: !critterNpc, reputation: !grunt && !critterNpc };
        data.showEmptyName = `flags.${SYSTEM_NAME}.${SR5RedesignActorSheet.SHOW_EMPTY_FLAG}`;
        data.hasSheetArt = !!this.#art.path;
        data.sheetPortrait = this.#sheetPortrait;
        data.modifierSources = this.#modifierSources();

        data.attributeGroups = [
            { id: 'physical', attributes: physical },
            { id: 'mental', attributes: mental },
            { id: 'special', attributes: data.specialAttributePlates },
        ];
        data.attributeLimits = LIMITS
            .flatMap(id => {
                const limit = system.limits?.[id];
                return limit && !limit.hidden ? [{ id, label: game.i18n.localize(`SR5.Redesign.LimitLabel.${id}`), value: limit.value }] : [];
            });

        // Dice pool next to each skill as it will be rolled: rating + linked attribute (attribute - 1 when defaulting),
        // plus the modifiers a skill test applies by itself (wounds, global). Only the skills part shows them: a
        // render of other parts (Edge, a toggle on an item) skips the pools, which take a prepared test for every skill
        // an effect changes (1-2 ms each, 20+ skills on a character with Catlike-like qualities and ware)
        const skillLists = [system.skills?.active, system.skills?.language, ...Object.values(system.skills?.knowledge ?? {})];
        const allSkills = skillLists.flatMap(list => Object.values(list ?? {}));
        data.skillLabels = Object.fromEntries(allSkills.filter(skill => skill.id).map(skill => [skill.id, skill.label])); // shown names, for skills in the favorites
        data.favoriteIds = Object.fromEntries(this.actor.system.favorites.map(id => [id, true])); // skill rows' stars
        data.skillPools = {};
        if (!options?.parts || options.parts.includes('skills')) {
            const skillModifiers = this.actor.modifiers.totalsFor(ModifierFlow.actionModifierTypes({ test: 'SkillTest' }));
            // skills an effect of the actor changes the pool of (Catlike, Natural Athlete...) take their pool from a test
            const withEffects = this.#skillsWithPoolEffects(allSkills);
            for (const skill of allSkills) {
                const attribute = system.attributes?.[skill.attribute];
                if (!skill.id || !attribute) continue;
                const attributeLabel = game.i18n.localize(`SR5.Redesign.AttrShort.${skill.attribute}`);
                const baseLabel = game.i18n.format(skill.value ? 'SR5.Redesign.PoolTooltip' : 'SR5.Redesign.Defaulting', { attribute: attributeLabel });
                const base = SkillRules.pool(skill, attribute.value);
                let pool = RedesignPool.rolled(base, skillModifiers, baseLabel);
                if (base !== null && withEffects.has(skill.id)) {
                    const testPool = await this._preparedPool(() => TestCreator.fromAction(this.actor.skillActionData(skill.name || skill.label)!, this.actor, { showDialog: false, showMessage: false }));
                    if (testPool) pool = RedesignPool.fromTest(testPool, base, baseLabel, 2);
                }
                data.skillPools[skill.id] = { attribute: attributeLabel, ...pool };
            }
        }
        // book page of each skill for its source button: the skill field's link, else the skill item's source (since
        // 0.38 skills are items and imported ones carry their page there, while the field's link stays empty)
        data.skillSources = Object.fromEntries(allSkills
            .map((skill): [string, string] => [skill.id, skill.link || (this.actor.items.get(skill.id)?.system as { description?: { source?: string } } | undefined)?.description?.source || ''])
            .filter(([id, source]) => id && source));

        return data;
    }

    override async _preparePartContext(...[partId, context, options]: Parameters<SR5CharacterSheet['_preparePartContext']>) {
        const partContext = await super._preparePartContext(partId, context, options) as RedesignPartContext;
        // set on every part: the parts share one context object, so a value left by the inventory would leak on
        partContext.listFilter = LIST_SEARCH_TABS.has(partId) ? { groups: this.#listFilterGroups(partId) } : null;

        if (partId === 'sidebar') {
            // entries (the item, its title and subtitle) where the system keeps the items: the sidebar reads these
            (partContext as { favorites?: unknown }).favorites = (await this._prepareFavorites()).map(item => this.#favoriteEntry(item, partContext));
            partContext.quickRolls = await this._prepareQuickRolls();
            partContext.monitors = this._prepareMonitors(partContext);
            // Edge pips: filled = Edge still available. Clicking a filled pip spends it (and those after it),
            // clicking an empty one restores up to it; the system stores spent Edge as `uses`.
            const max = partContext.system.attributes?.edge?.value ?? 0;
            const remaining = partContext.edgeRemaining as number;
            partContext.edgeCells = this._cells(remaining, max)
                .map(cell => ({ ...cell, uses: cell.filled ? max - cell.value + 1 : max - cell.value }));
            partContext.initiativeModes = this.#initiativeModes(partContext);
            partContext.initiativeMode = partContext.initiativeModes.find(mode => mode.active) ?? null;
            partContext.blitzAvailable = remaining > 0;
            // a world setting, off by default (Configure Settings > Shadowrun Redesign): off, nothing is built, drawn
            // or watched
            const showActions = !!RedesignSettings.get('showActions');
            partContext.actionTracker = showActions ? this.#actions.context() : null;
            partContext.maxFreeActions = SR5RedesignActorSheet.MAX_FREE_ACTIONS;
            if (showActions) SR5RedesignActorSheet.#watchCombat();
        }

        if (partId === 'skills') partContext.skillFilter = { groups: await this.#skillFilterGroups(partContext) };
        // the wound modifier the skill pools are drawn with (#updateParts redraws them when it changes)
        if (partId === 'skills') this.#skillsWounds = this.#woundModifier();

        // qualities split by type: pills on the first tab, two cards on the bio tab (life modules count as positive)
        if (partId === 'skills' || partId === 'bio') {
            const qualities = partContext.itemType?.quality ?? [];
            partContext.qualities = {
                positive: qualities.filter((q: SR5Item) => (q.system as { type?: string }).type !== 'negative'),
                negative: qualities.filter((q: SR5Item) => (q.system as { type?: string }).type === 'negative'),
            };
        }

        if (partId === 'matrix') partContext.matrixDeviceSwitch = this.#matrixDeviceSwitch();

        if (partId === 'inventory') {
            // The container item type only exists from system 0.38 on (the standalone module also runs on 0.37),
            // and the sheet leaves containers out until upstream releases them (CONTAINERS_ENABLED).
            partContext.containersEnabled = CONTAINERS_ENABLED && 'container' in (CONFIG.Item.dataModels ?? {});
            partContext.containers = !partContext.containersEnabled ? [] : this.actor.items
                .filter(item => item.type === 'container' && !item.system.parentId)
                .map(item => ({ item, count: item.childItems.size }));
            // the augmentations tab's implant lists are its own: not offered here
            partContext.inventories = Object.fromEntries(Object.entries(partContext.inventories ?? {})
                .filter(([name]) => !this.#isImplantInventory(name)));
            // the empty note is for a character with no inventory items at all, in any inventory (an empty custom
            // inventory, or "All" which only holds items shown in every inventory, is not an empty sheet); containers
            // and ware are shown elsewhere
            const inventories = (partContext.inventories ?? {}) as Record<string, { types?: Record<string, { items?: unknown[] }> }>;
            partContext.hasInventoryItems = Object.values(inventories).some(inventory =>
                Object.entries(inventory.types ?? {})
                    .some(([type, section]) => !['container', 'cyberware', 'bioware'].includes(type) && section.items?.length));
        }

        // configuration: in play mode the modifier card lists only modifiers that are set
        if (partId === 'misc') partContext.hasModifiers = Object.entries(this.actor.system.modifiers ?? {} as Record<string, number>)
            .some(([id, value]) => (id as string) !== 'wound' && !!value);

        if (partId === 'augmentations') {
            partContext.implantInventory = this.#implantInventoryName();
            partContext.implantInventories = this.#implantInventoryChoices();
            partContext.implantSections = this.#implantSections(partContext.implantInventory);
            partContext.hasImplants = this.#hasImplants();
        }

        // set on every part (the parts share one context)
        partContext.tabEmpty = this._isTabEmpty(partId, partContext);
        if (partId === 'critterPowers') {
            const powers = (partContext.itemType?.critter_power ?? []) as SR5Item[];
            const optional = (power: SR5Item) => (power.system as { optional?: string }).optional;
            // the rows each card lists (critter-powers.hbs), so a card without any gets its empty row
            partContext.critterPowerCounts = {
                shown: powers.filter(power => !optional(power) || optional(power) === 'standard'
                    || (this.isPlayMode && optional(power) === 'enabled_option')).length,
                enabled: powers.filter(power => optional(power) === 'enabled_option').length,
                disabled: powers.filter(power => optional(power) === 'disabled_option').length,
            };
        }
        if (partId === 'skills') {
            const qualities = partContext.qualities as { positive?: unknown[], negative?: unknown[] } | undefined;
            // the qualities beside the skills: each player's choice (Bio keeps them in any case)
            partContext.showQualities = !!RedesignSettings.get('showQualities');
            // nothing for the right column (no knowledge or language skills, no qualities shown, play mode): the
            // skills take the tab's width
            partContext.detailsSingleColumn = this.isPlayMode && !partContext.hasLanguageKnowledgeSkills
                && (!partContext.showQualities || (!qualities?.positive?.length && !qualities?.negative?.length));
        }

        // the magic tab's view (play mode; edit mode by category, where each card adds its own spells)
        const spellGrouping = this.isPlayMode ? this.#spellGrouping() : SPELL_GROUPINGS[0];
        partContext.spellsOneList = partId === 'magic' && spellGrouping.mode === 'none';

        // the system lists action items there (SR5MatrixActorSheet), typed as any item
        if (partId === 'matrixActions') partContext.matrixActionGroups = this.#matrixActionGroups((partContext.matrixActions ?? []) as { name: string; action: SR5Item<'action'> }[]);
        // the Actions tab by groups (the grouping button by its search), or one table; set on every part, as
        // listFilter above (the parts share one context, the button would show on the other tabs' searches)
        const grouping = partId === 'actions' ? this.#actionGrouping() : null;
        partContext.actionGrouping = grouping;
        // the tab's view button (list-controls.hbs): the same button and behaviour on every tab that has views
        partContext.listGrouping = !this.isPlayMode ? null
            : partId === 'actions' ? { ...grouping!, action: 'cycleActionGrouping', isDefault: grouping!.mode === 'none' }
            : partId === 'magic' ? { ...spellGrouping, action: 'cycleSpellGrouping', isDefault: spellGrouping.mode === 'category' }
            : null;
        // edit mode always shows the groups: that is where they are added, renamed and removed
        partContext.actionGroups = grouping && (grouping.mode === 'kind' || this.isEditMode) ? this.#actionGroups(partContext.actions ?? []) : null;
        if (grouping) SR5RedesignActorSheet.#watchActionDeletes();

        if (partId === 'magic' || partId === 'social' || partId === 'bio') {
            // open / closed state of each card (redesign/card-table.hbs, redesign/bio.hbs); shares the inventory's toggleExpanded state
            const open = this._inventoryOpenClose;
            const types = partId === 'bio' ? BIO_CARD_TYPES : CARD_TABLE_TYPES;
            partContext.openSections = Object.fromEntries(types.map(type => [type, open[type] ?? true]));
        }

        return partContext;
    }

    /** The user's way of laying out the Actions tab (a user flag, the same on every sheet). */
    #actionGrouping(): typeof ACTION_GROUPINGS[number] {
        const mode = game.user?.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUPING_FLAG as never) as string | undefined;
        return ACTION_GROUPINGS.find(grouping => grouping.mode === mode) ?? ACTION_GROUPINGS[0];
    }

    static readonly ACTION_GROUPING_FLAG = 'redesignActionGrouping';

    /** The grouping button: the next way of laying out the Actions tab. */
    static async #cycleActionGrouping(this: SR5RedesignActorSheet) {
        const current = ACTION_GROUPINGS.indexOf(this.#actionGrouping());
        const next = ACTION_GROUPINGS[(current + 1) % ACTION_GROUPINGS.length];
        await game.user?.setFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUPING_FLAG as never, next.mode as never);
        await this.render({ parts: ['actions'] });
    }

    /** What kind of action an action is, for the groups by kind (ACTION_KINDS). */
    static actionKind(action: ActionKindSource | undefined): ActionKind {
        const categories: string[] = action?.categories ?? [];
        for (const [kind, prefixes] of ACTION_KIND_CATEGORIES) {
            if (categories.some(category => prefixes.some(prefix => category === prefix || category.startsWith(`${prefix}_`)))) {
                // an attack in the matrix is a matrix action; Full Defense / Dive for Cover carry no category
                if (kind === 'attack' && categories.includes('attack_matrix')) return 'matrix';
                return kind;
            }
        }
        if (action?.type === 'interrupt') return 'interrupt';
        // Armor and the like resist without a skill or an attribute; Composure, Memory... roll attributes alone
        if (action?.armor && !action.skill && !action.attribute) return 'resist';
        if (!action?.skill && (action?.attribute || action?.attribute2)) return 'attribute';
        return 'other';
    }

    /** Actor flag: the player's own action groups, in order: [{id, label}]. */
    static readonly ACTION_GROUPS_FLAG = 'actionGroups';
    /** Actor flag: the group an action was put in, by item id: {itemId: kind or own group id}; else its kind. */
    static readonly ACTION_GROUP_OF_FLAG = 'actionGroupOf';

    #ownActionGroups(): { id: string, label: string }[] {
        const groups = this.#sheetFlags.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUPS_FLAG);
        if (!Array.isArray(groups)) return [];
        return (groups as ({ id?: unknown, label?: unknown } | null)[])
            .filter((group): group is { id: string, label: string } => !!group?.id && typeof group.id === 'string' && typeof group.label === 'string');
    }

    #actionGroupOf(): Record<string, string> {
        return (this.#sheetFlags.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUP_OF_FLAG) ?? {}) as Record<string, string>;
    }

    /**
     * The Actions tab's groups (redesign/actions.hbs): the kinds (ACTION_KINDS order; they cannot be removed), then
     * the player's own groups. An action sits in the group it was put in (actionGroupOf, e.g. added from that group's
     * Add button), else in its kind. Play mode leaves out empty groups; edit mode shows them all, to add to any.
     * Each collapses like the inventory's cards (the same toggleExpanded state, keyed action_group_<key>).
     */
    #actionGroups(actions: { name: string; action: SR5Item }[]) {
        const own = this.#ownActionGroups();
        const placed = this.#actionGroupOf();
        const keys = new Set<string>([...ACTION_KINDS, ...own.map(group => group.id)]);
        const keyOf = (item: SR5Item) => {
            const key = item.id ? placed[item.id] : undefined;
            return key && keys.has(key) ? key : SR5RedesignActorSheet.actionKind((item.system as { action?: ActionKindSource }).action);
        };
        const groups = [
            ...ACTION_KINDS.map(kind => ({ key: kind as string, own: false, label: game.i18n.localize(`SR5.Redesign.ActionGroups.Kinds.${kind}`) })),
            ...own.map(group => ({ key: group.id, own: true, label: group.label })),
        ];
        return groups.map(group => {
            const type = `action_group_${group.key}`;
            const rows = actions.filter(entry => keyOf(entry.action) === group.key);
            return { ...group, type, actions: rows, isOpen: this._inventoryOpenClose[type] ?? true };
        // edit mode shows every group, empty ones too, so each has its Add button (as the matrix action tables)
        }).filter(group => group.actions.length || this.isEditMode);
    }

    static #actionDeletesWatched = false;

    /**
     * An action deleted any other way (its trash, a script) leaves its group entry behind: the client that deleted
     * it removes the entry (actionGroupOf), so the flag does not fill up with ids of actions long gone.
     */
    static #watchActionDeletes() {
        if (SR5RedesignActorSheet.#actionDeletesWatched) return;
        SR5RedesignActorSheet.#actionDeletesWatched = true;
        (Hooks.on.bind(Hooks) as (hook: string, fn: (...args: never[]) => void) => number)('deleteItem', (item: SR5Item, _options: unknown, userId: string) => {
            const actor = item?.parent as (SR5Actor & { getFlag?(scope: string, key: string): unknown }) | null;
            if (userId !== game.user?.id || item?.type !== 'action' || !actor?.isOwner || !item.id) return;
            const placed = actor.getFlag?.(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUP_OF_FLAG) as Record<string, string> | undefined;
            if (!placed || !(item.id in placed)) return;
            void actor.update({ [`flags.${SYSTEM_NAME}.${SR5RedesignActorSheet.ACTION_GROUP_OF_FLAG}.-=${item.id}`]: null });
        });
    }

    /** The redesign sheet the user last clicked or typed in (none after a click elsewhere), see #watchDeletionConfirms. */
    static #interactedSheet: SR5RedesignActorSheet | null = null;
    static #deletionConfirmsWatched = false;

    /**
     * The system asks before every deletion with its own dialog (DeleteConfirmationDialog: items, effects, skills,
     * inventories, run reset), from a dozen places of the sheets it shares with ours. When the user's last click or
     * key was in a redesign sheet (or in a menu it opened), the system's dialog is hidden as it renders and the
     * question comes in the sheet's look; the answer presses the system dialog's own Yes or No, so its caller goes on
     * as usual. Any other sheet keeps the system's dialog. (The dialog, not Helpers.confirmDeletion: the standalone
     * module runs the system's own base sheet, which calls the system's Helpers, out of the module's reach.)
     */
    static #watchDeletionConfirms() {
        if (SR5RedesignActorSheet.#deletionConfirmsWatched) return;
        SR5RedesignActorSheet.#deletionConfirmsWatched = true;
        const note = (event: Event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (target?.closest('#context-menu, .context-menu')) return; // a menu's entry: the sheet that opened it
            const app = target?.closest('.application');
            const instance = app?.id ? foundry.applications.instances.get(app.id) : undefined;
            SR5RedesignActorSheet.#interactedSheet = instance instanceof SR5RedesignActorSheet ? instance : null;
        };
        document.addEventListener('pointerdown', note, { capture: true });
        document.addEventListener('keydown', note, { capture: true });
        (Hooks.on.bind(Hooks) as (hook: string, fn: (...args: never[]) => void) => number)('renderApplicationV2', (app: { id?: string; close?: () => unknown }, element: HTMLElement) => {
            const sheet = SR5RedesignActorSheet.#interactedSheet;
            if (app?.id !== 'delete-confirmation-application' || !sheet?.rendered || element.dataset.srAsked) return;
            element.dataset.srAsked = 'true';
            element.style.visibility = 'hidden';
            void sheet._confirmDeletion().then(confirmed => {
                const button = element.querySelector<HTMLButtonElement>(`button[data-action="${confirmed ? 'delete' : 'cancel'}"]`);
                if (button) button.click();
                else void app.close?.();
            });
        });
    }

    /** The system's deletion question (SR5.DeleteConfirmationApplication) in the sheet's look; No is the default. */
    protected async _confirmDeletion(title?: string): Promise<boolean> {
        const text = (key: string) => game.i18n.localize(`SR5.DeleteConfirmationApplication.${key}`).trim();
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            classes: this.#dialogClasses(),
            position: { width: 400 },
            window: { title: title ?? text('Title') },
            content: `<p>${text('Consent')} ${text('Description')}</p>`,
            yes: { label: text('Delete') },
            no: { label: text('Cancel'), default: true },
            rejectClose: false,
        });
        return confirmed === true;
    }

    /** Edit mode, the tab title's + button: a new group of the player's own, named in a prompt. */
    static async #addActionGroup(this: SR5RedesignActorSheet) {
        const label = await this.#promptGroupName();
        if (!label) return;
        const groups = [...this.#ownActionGroups(), { id: foundry.utils.randomID(), label }];
        await this.#sheetFlags.setFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUPS_FLAG, groups);
    }

    /** Edit mode, an own group's pen: renames it. */
    static async #renameActionGroup(this: SR5RedesignActorSheet, event: Event, target: HTMLElement) {
        const id = target.dataset.group;
        const groups = this.#ownActionGroups();
        const group = groups.find(entry => entry.id === id);
        if (!group) return;
        const label = await this.#promptGroupName(group.label);
        if (!label || label === group.label) return;
        group.label = label;
        await this.#sheetFlags.setFlag(SYSTEM_NAME, SR5RedesignActorSheet.ACTION_GROUPS_FLAG, groups);
    }

    /**
     * Edit mode, an own group's trash: removes it after a warning that its actions go with it. The actor's own
     * actions in it are deleted; the system's general actions (not the actor's to delete) go back to their kind.
     */
    static async #removeActionGroup(this: SR5RedesignActorSheet, event: Event, target: HTMLElement) {
        const id = target.dataset.group;
        const group = this.#ownActionGroups().find(entry => entry.id === id);
        if (!id || !group) return;
        const placed = this.#actionGroupOf();
        const inGroup = Object.entries(placed).filter(([, key]) => key === id).map(([itemId]) => itemId);
        const owned = inGroup.filter(itemId => this.actor.items.get(itemId));
        const confirmed = await foundry.applications.api.DialogV2.confirm({
            classes: this.#dialogClasses(),
            position: { width: 400 },
            window: { title: 'SR5.Redesign.ActionGroups.RemoveTitle' },
            content: `<p>${game.i18n.format(owned.length ? 'SR5.Redesign.ActionGroups.RemoveWithActions' : 'SR5.Redesign.ActionGroups.RemoveEmpty',
                { group: Handlebars.escapeExpression(group.label), count: owned.length })}</p>`,
            yes: { label: 'SR5.Redesign.ActionGroups.Remove' },
            no: { label: 'SR5.Redesign.ActionGroups.Keep', default: true },
            rejectClose: false,
        });
        if (!confirmed) return;
        if (owned.length) await this.actor.deleteEmbeddedDocuments('Item', owned);
        const update: Record<string, unknown> = {
            [`flags.${SYSTEM_NAME}.${SR5RedesignActorSheet.ACTION_GROUPS_FLAG}`]: this.#ownActionGroups().filter(entry => entry.id !== id),
        };
        for (const itemId of inGroup) update[`flags.${SYSTEM_NAME}.${SR5RedesignActorSheet.ACTION_GROUP_OF_FLAG}.-=${itemId}`] = null;
        await this.actor.update(update);
    }

    /** Edit mode, a group's Add button: a new action of the actor's, in that group, its sheet open to fill in. */
    static async #addGroupAction(this: SR5RedesignActorSheet, event: Event, target: HTMLElement) {
        const key = target.dataset.group;
        if (!key) return;
        const [item] = await this.actor.createEmbeddedDocuments('Item', [{
            type: 'action',
            name: `${game.i18n.localize('SR5.New')} ${game.i18n.localize(SR5.itemTypes.action)}`,
        }]) as SR5Item[];
        if (!item?.id) return;
        await this.#sheetFlags.setFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.ACTION_GROUP_OF_FLAG}.${item.id}`, key);
        await item.sheet?.render(true, OPEN_IN_EDIT_MODE);
    }

    /**
     * A group name from a prompt: trimmed and at most 40 characters; none when empty or unchanged, nor when another
     * group has it already (own or a kind's, in any case: two cards of one name could not be told apart).
     */
    async #promptGroupName(current?: string): Promise<string | null> {
        const name = (await this.#askGroupName(current))?.slice(0, 40).trim();
        if (!name || name === current) return null;
        const taken = [...ACTION_KINDS.map(kind => game.i18n.localize(`SR5.Redesign.ActionGroups.Kinds.${kind}`)),
            ...this.#ownActionGroups().map(group => group.label)].filter(label => label !== current);
        if (taken.some(label => label.toLocaleLowerCase() === name.toLocaleLowerCase())) {
            ui.notifications?.warn(game.i18n.format('SR5.Redesign.ActionGroups.NameTaken', { name }));
            return null;
        }
        return name;
    }

    /** A prompt or confirm dialog of the sheet in the sheet's look and theme (redesign-apps.scss, .redesign-dialog). */
    #dialogClasses(): string[] {
        return ['sr5v2', ...this.#appOptions().classes, 'redesign-dialog', ...this.#themeClasses()];
    }

    async #askGroupName(current?: string): Promise<string | null> {
        const name = await foundry.applications.api.DialogV2.prompt({
            classes: this.#dialogClasses(),
            position: { width: 360 },
            window: { title: current ? 'SR5.Redesign.ActionGroups.RenameTitle' : 'SR5.Redesign.ActionGroups.AddTitle' },
            content: `<input type="text" name="name" maxlength="40" value="${Handlebars.escapeExpression(current ?? '')}"
                aria-label="${Handlebars.escapeExpression(game.i18n.localize('SR5.Redesign.ActionGroups.Name'))}" autofocus>`,
            ok: { label: current ? 'SR5.Redesign.ActionGroups.Rename' : 'SR5.Redesign.ActionGroups.Create', callback: (_event: Event, button: HTMLButtonElement) =>
                (button.form?.elements.namedItem('name') as HTMLInputElement | null)?.value.trim() ?? '' },
            rejectClose: false,
        }) as string | null;
        return name || null;
    }

    /**
     * Matrix actions split by their limit (redesign/matrix-actions.hbs). Play mode leaves out empty tables; each row
     * carries numbers to sort by: marks (none 0, 1-3, owner 4) and action type (ACTION_TYPE_ORDER, unknown last).
     */
    #matrixActionGroups(actions: { name: string; action: SR5Item<'action'> }[]) {
        const keys = [...MATRIX_ACTION_LIMITS, 'other'];
        const limitOf = (action: SR5Item<'action'>) => {
            const limit = action.system.action.limit.attribute;
            return (MATRIX_ACTION_LIMITS as readonly string[]).includes(limit) ? limit : 'other';
        };
        return keys.map(key => {
            const type = `matrix_action_${key}`;
            const rows = actions.filter(entry => limitOf(entry.action) === key).map(entry => {
                const matrix = entry.action.getAction()?.category.matrix;
                const typeRank = ACTION_TYPE_ORDER.indexOf(entry.action.system.action.type);
                return {
                    ...entry,
                    sortMarks: matrix?.owner ? 4 : (matrix?.marks ?? 0),
                    sortType: typeRank === -1 ? ACTION_TYPE_ORDER.length : typeRank,
                };
            });
            const label = game.i18n.localize(`SR5.Redesign.MatrixActionGroups.${key}`);
            return { key, type, label, actions: rows, isOpen: this._inventoryOpenClose[type] ?? true };
        }).filter(group => this.isEditMode || group.actions.length);
    }

    /**
     * A quality added from the Positive or Negative card of the bio tab gets that card's type (data-quality-type on
     * the add button), a matrix action added from one of the matrix action tables gets that table's limit
     * (data-matrix-limit), and an implant added on the augmentations tab goes into that tab's inventory (not the
     * inventory tab's), and a spell added from a spell category card (add type combatspells, detectionspells...) is a
     * spell of that category; everything else goes through the upstream creation.
     */
    protected override async _handleCreateItem(event: PointerEvent) {
        if (!isElementInstance(event.target, HTMLElement)) return;
        const target = SheetFlow.closestAction(event.target);
        const { qualityType, matrixLimit, itemType } = target?.dataset ?? {};
        const implantInventory = target?.closest('.sr-augmentations') ? this.#implantInventoryName() : null;
        const spellCategory = /^(combat|detection|health|illusion|manipulation)spells$/.exec(itemType ?? '')?.[1];
        if (!qualityType && !matrixLimit && !implantInventory && !spellCategory) return super._handleCreateItem(event);

        if (implantInventory) this._setInventoryTypeVisibility(itemType!, true);
        // flat keys ('system.type'), which Foundry expands on create: no CreateData shape until then
        const itemData: Record<string, unknown> = { type: spellCategory ? 'spell' : itemType };
        if (qualityType) itemData['system.type'] = qualityType;
        if (spellCategory) itemData['system.category'] = spellCategory;
        if (matrixLimit) {
            this._handleCreateMatrixActionItem(event, itemData as unknown as Item.CreateData); // categories, type 'action'
            if (matrixLimit !== 'other') itemData['system.action.limit.attribute'] = matrixLimit;
        }
        // named after the final item type ('matrix_action' has no label of its own)
        itemData.name = `${game.i18n.localize('SR5.New')} ${game.i18n.localize(SR5.itemTypes[itemData.type as keyof typeof SR5.itemTypes])}`;
        const items = await this.actor.createEmbeddedDocuments('Item', [itemData as unknown as Item.CreateData]) as SR5Item[];
        const inventory = implantInventory ?? this.selectedInventory;
        if (inventory !== this.actor.defaultInventory.name) await this.actor.inventory.addItems(inventory, items);
        for (const item of items) await item.sheet?.render(true, OPEN_IN_EDIT_MODE);
    }

    // ---------- inventories: create / rename / remove / move, per tab ----------
    // The inventory tab and the augmentations tab keep separate lists: the augmentations tab's are inventories marked
    // with IMPLANT_INVENTORY_TYPE, which the inventory tab leaves out. Implants in none of them are "installed".

    static async #createInventory(this: SR5RedesignActorSheet, event: Event) {
        event.preventDefault();
        if ((event.target as HTMLElement | null)?.closest('.sr-augmentations')) return this.#promptImplantInventory();
        await new InventoryRenameApp(this.actor, '', 'create').render({ force: true });
    }

    static async #renameInventory(this: SR5RedesignActorSheet, event: Event) {
        event.preventDefault();
        const inventory = SheetFlow.closestAction(event.target)?.dataset.inventory ?? '';
        if (this.actor.inventory.disallowRename(inventory)) {
            ui.notifications?.warn(game.i18n.localize('SR5.Warnings.CantEditDefaultInventory'));
            return;
        }
        if (this.#isImplantInventory(inventory)) return this.#promptImplantInventory(inventory);
        await new InventoryRenameApp(this.actor, inventory, 'edit').render({ force: true });
    }

    /** Removes the inventory of the button (the upstream handler removes the inventory tab's selection). */
    static async #removeInventory(this: SR5RedesignActorSheet, event: Event) {
        event.preventDefault();
        const inventory = SheetFlow.closestAction(event.target)?.dataset.inventory ?? '';
        if (!await Helpers.confirmDeletion()) return;
        if (this.actor.inventory.disallowRemove(inventory)) {
            ui.notifications?.warn(game.i18n.localize('SR5.Errors.DefaultInventoryCantBeRemoved'));
            return;
        }
        // its items go back to the default inventory: gear to Carried, implants to the installed ones
        await this.actor.inventory.remove(inventory);
        if (this.selectedInventory === inventory) this.selectedInventory = this.actor.defaultInventory.name;
        if (this.#implantInventory === inventory) this.#implantInventory = null;
        void this.render();
    }

    /** Name a new implant list, or rename one (the upstream dialog would select it on the inventory tab). */
    async #promptImplantInventory(current?: string) {
        const name = await foundry.applications.api.DialogV2.prompt({
            classes: this.#dialogClasses(),
            position: { width: 360 },
            window: { title: current ? 'SR5.InventoryRename.Title' : 'SR5.Labels.ActorSheet.CreateInventory' },
            content: `<input type="text" name="name" value="${Handlebars.escapeExpression(current ?? '')}"
                aria-label="${Handlebars.escapeExpression(game.i18n.localize('SR5.Redesign.ImplantListName'))}" autofocus>`,
            ok: { callback: (_event: Event, button: HTMLButtonElement) =>
                (button.form?.elements.namedItem('name') as HTMLInputElement | null)?.value.trim() ?? '' },
            rejectClose: false,
        }) as string | null;
        if (!name || name === current) return;
        // a name in use would merge this list into that inventory (InventoryFlow.rename does not check)
        if (this.actor.inventory.exists(name)) {
            ui.notifications?.warn('SR5.Warnings.AlreadyExistingInventory', { localize: true });
            return;
        }
        if (current) {
            const renamed = await this.actor.inventory.rename(current, name);
            if (renamed) this.#implantInventory = renamed;
        } else {
            // the list as InventoryFlow.create writes it, with its type in the same update: two updates showed it on
            // the other clients for a moment as a plain inventory
            const created = Helpers.sanitizeDataKey(name);
            if (!created || created === this.actor.defaultInventory.name || this.actor.inventory.exists(created)) {
                ui.notifications?.warn('SR5.Warnings.AlreadyExistingInventory', { localize: true });
                return;
            }
            const list = { name: created, label: created, itemIds: [], type: SR5RedesignActorSheet.IMPLANT_INVENTORY_TYPE };
            await this.actor.update({ system: { inventories: { [created]: list } } } as never, { render: false });
            this.#implantInventory = created;
        }
        void this.render();
    }

    /**
     * "Move to inventory" within the item's own kind: implants between the installed ones and the implant lists,
     * other items between the inventory tab's inventories (the upstream dialog offers every inventory).
     */
    override async _moveItemToInventory(target: HTMLElement) {
        const item = this.actor.items.get(SheetFlow.closestItemId(target));
        if (!item) return;
        const inventories = Object.values(this.actor.system.inventories ?? {});
        const implant = (SR5RedesignActorSheet.IMPLANT_TYPES as readonly string[]).includes(item.type);
        let current = inventories.find(inventory => inventory.itemIds.includes(item.id))?.name ?? this.actor.defaultInventory.name;
        if (implant && !this.#isImplantInventory(current)) current = this.actor.defaultInventory.name;
        const choices = (implant ? this.#implantInventoryChoices() : this.#gearInventoryChoices())
            .filter(choice => choice.name !== current);
        if (!choices.length) {
            ui.notifications?.info(game.i18n.localize('SR5.Redesign.NoOtherInventory'));
            return;
        }
        const esc = Handlebars.escapeExpression;
        const name = await foundry.applications.api.DialogV2.prompt({
            classes: this.#dialogClasses(),
            position: { width: 360 },
            window: { title: 'SR5.MoveInventoryDialog.Title' },
            content: `<fieldset>${choices.map((choice, index) => `<label class="checkbox"><input type="radio" name="inventory"
                value="${esc(choice.name)}"${index ? '' : ' checked'}> ${esc(choice.label)}</label>`).join('')}</fieldset>`,
            ok: { label: 'SR5.MoveInventoryDialog.Move', callback: (_event: Event, button: HTMLButtonElement) =>
                button.form?.querySelector<HTMLInputElement>('input[name="inventory"]:checked')?.value ?? '' },
            rejectClose: false,
        }) as string | null;
        if (!name) return;
        await this.actor.inventory.addItems(name, item);
    }

    /** Drops the focus from an inventory picker of this sheet. */
    #blurPicker() {
        const active = document.activeElement;
        if (active instanceof HTMLSelectElement && active.closest('.plaque-select, .device-plaque') && this.element?.contains(active)) active.blur();
    }

    /** Document updates waiting for their render (#deferRender). */
    #pendingUpdates: { renderContext?: string; renderData?: unknown }[] = [];
    #pendingRender: Promise<this> | undefined;

    // both of Application's forms: render(options) and the legacy render(force, options)
    override render(options?: boolean | object, legacy?: object): Promise<this> {
        // Foundry's documents call render(false, { renderContext, renderData }) on every update
        const context = (typeof options === 'object' ? options : legacy) as { renderContext?: string; renderData?: unknown; force?: boolean } | undefined;
        if (this.rendered && context?.renderContext && options !== true && !context.force) return this.#deferRender(context);
        // the parent's overloads (options, or the legacy force + options) in one signature, as this override's
        const render = super.render as (this: this, options?: boolean | object, legacy?: object) => Promise<this>;
        return render.call(this, options, legacy);
    }

    /**
     * A document update redraws in a task of its own, after the update's own work (the system prepares the whole
     * actor again first, ~30 ms on a full character): one long task without a frame became two shorter ones. Updates
     * arriving together (a batch, an item and its actor) are drawn once, with the parts all of them need.
     */
    #deferRender(context: { renderContext?: string; renderData?: unknown }): Promise<this> {
        this.#pendingUpdates.push(context);
        this.#pendingRender ??= new Promise<void>(resolve => { window.setTimeout(resolve, 0); }).then(async () => {
            const updates = this.#pendingUpdates.splice(0);
            this.#pendingRender = undefined;
            if (!this.rendered) return this;
            const lists = updates.map(update => this.#updateParts(update));
            const needed = lists.every(list => list) ? [...new Set(lists.flat() as string[])] : Object.keys(SR5RedesignActorSheet.PARTS);
            // the window title on a rename, as DocumentSheetV2#_configureRenderOptions does from the renderData this
            // render no longer passes
            const renamed = updates.some(update => (update.renderData as { name?: string } | undefined)?.name);
            if (renamed && this.window.title) this.window.title.innerText = this.title;
            const parts = this.#shownParts(this.#withNestedParts(needed));
            if (!parts.length) return this; // all of it on tabs that are not open: drawn when idle (#staleParts)
            return super.render(SR5RedesignActorSheet.#shown(parts));
        });
        return this.#pendingRender;
    }

    /**
     * Parts a re-render left out because they did not show (another tab, the matrix tab's other icon list): drawn
     * when the browser is idle, or at once when their tab opens. A change on one tab (a damage box, an item toggle,
     * an item deleted) drew every part of the sheet before, 26 parts on a full character, most of them hidden.
     */
    #staleParts = new Set<string>();

    /** Render options for these parts as they are (#shownParts picked them already): SHOWN_PARTS, which the render types do not know. */
    static #shown(parts: string[]): object {
        return { parts, [SHOWN_PARTS]: true };
    }
    #staleRefreshQueued = false;

    /**
     * The parts of `parts` that show (or are not drawn yet), plus stale parts that show now, plus the parts placed
     * inside those (#withNestedParts: a part redrawn alone comes back with its slots empty). The rest is left stale.
     */
    #shownParts(parts: string[]): string[] {
        // looked up in the window: `parts` keeps the first element of a part placed inside another (the matrix
        // tab's lists), which the parent's next render replaced
        const shows = (id: string): boolean => {
            if (PARENT_PART[id]) return shows(PARENT_PART[id]);
            // the matrix tab being warmed shows its loader: an update meanwhile leaves it stale, the warm-up's own
            // render draws it (drawn now, it resolved every device at once, what the warm-up spreads out)
            if (id === 'matrix' && this.#matrixLoading) return false;
            const element = this.element.querySelector<HTMLElement>(`[data-application-part="${id}"]`);
            // checkVisibility: Safari 17.4+; before it a hidden tab (display: none) has no boxes either
            return !element || (element.checkVisibility ? element.checkVisibility() : element.getClientRects().length > 0);
        };
        const shown = parts.filter(shows);
        for (const id of this.#staleParts) if (!shown.includes(id) && shows(id)) shown.push(id);
        // a parent before the parts placed in it (they fill its fresh slots)
        const order: string[] = Object.keys(SR5RedesignActorSheet.PARTS);
        const drawn = this.#withNestedParts(shown).sort((a, b) => order.indexOf(a) - order.indexOf(b));
        for (const id of parts) if (!drawn.includes(id)) this.#staleParts.add(id);
        for (const id of drawn) this.#staleParts.delete(id);
        if (this.#staleParts.size) this.#refreshStaleWhenIdle();
        return drawn;
    }

    /** Draws the stale parts when the browser has nothing else to do, once per batch of updates. */
    #refreshStaleWhenIdle() {
        if (this.#staleRefreshQueued) return;
        this.#staleRefreshQueued = true;
        onIdle(() => {
            this.#staleRefreshQueued = false;
            if (!this.rendered || !this.#staleParts.size) return;
            // the matrix tab and its parts stay stale until the tab shows (SHOWN_ONLY_PARTS; #renderShownStale draws them)
            const idle = [...this.#staleParts].filter(id => !SHOWN_ONLY_PARTS.has(PARENT_PART[id] ?? id));
            if (!idle.length) return;
            const order: string[] = Object.keys(SR5RedesignActorSheet.PARTS);
            const parts = this.#withNestedParts(idle).sort((a, b) => order.indexOf(a) - order.indexOf(b));
            for (const id of parts) this.#staleParts.delete(id);
            void this.render(SR5RedesignActorSheet.#shown(parts));
        });
    }

    /**
     * Opening the sheet draws the open tab only: the other tabs' parts (19 of 26 on a full character, most of its
     * 5000-7000 nodes) are drawn when the browser is idle, or when their tab opens first. Each waits as an empty
     * section in its place (the same tab attributes, so opening its tab shows it and #renderShownStale draws it).
     */
    override async _renderHTML(...args: Parameters<SR5CharacterSheet['_renderHTML']>) {
        const [context, options] = args;
        const deferred = options.isFirstRender ? this.#deferredAtOpen(options.parts ?? []) : [];
        if (!deferred.length) return super._renderHTML(...args);
        const rendered = await super._renderHTML(context, { ...options, parts: options.parts!.filter(id => !deferred.includes(id)) });
        const result: Record<string, HTMLElement> = {};
        for (const id of options.parts!) {
            if (rendered[id]) result[id] = rendered[id];
            else if (deferred.includes(id) && !PARENT_PART[id]) result[id] = SR5RedesignActorSheet.#partPlaceholder(id);
        }
        for (const id of deferred) this.#staleParts.add(id);
        this.#refreshStaleWhenIdle();
        return result as Awaited<ReturnType<SR5CharacterSheet['_renderHTML']>>;
    }

    /** The parts of the tabs that are not open, with the parts placed in them. */
    #deferredAtOpen(parts: string[]): string[] {
        const TABS = (this.constructor as typeof SR5RedesignActorSheet).TABS;
        const open = this.tabGroups.primary ?? TABS.primary.initial;
        const tabs = new Set(TABS.primary.tabs.map(tab => tab.id));
        return parts.filter(id => (tabs.has(id) && id !== open) || (PARENT_PART[id] && tabs.has(PARENT_PART[id]) && PARENT_PART[id] !== open));
    }

    static #partPlaceholder(id: string): HTMLElement {
        const section = document.createElement('section');
        section.className = 'tab';
        section.dataset.group = 'primary';
        section.dataset.tab = id;
        section.dataset.applicationPart = id;
        return section;
    }

    /** Stale parts that show now (a tab opened before the idle redraw): drawn before the next frame. */
    #renderShownStale() {
        if (!this.rendered || !this.#staleParts.size) return;
        const parts = this.#shownParts([]);
        if (!parts.length) return;
        // the matrix tab shown for the first time: its network icons build a token actor for every token on the grids
        // (b152, a second and more in one task), so the devices are warmed a few at a time first, under a quiet field of
        // 0s and 1s in the tab's place (#drawMatrixGently); the other parts are drawn right away
        const matrix = parts.filter(id => id === 'matrix' || PARENT_PART[id] === 'matrix');
        const placeholder = this.element.querySelector<HTMLElement>('[data-application-part="matrix"]');
        if (matrix.length && placeholder && !placeholder.querySelector(':scope > :not(.sr-matrix-loader)')) {
            const rest = parts.filter(id => !matrix.includes(id));
            if (rest.length) void this.render(SR5RedesignActorSheet.#shown(rest));
            void this.#drawMatrixGently(matrix, placeholder);
            return;
        }
        void this.render(SR5RedesignActorSheet.#shown(parts));
    }

    /** The matrix tab is being warmed and drawn (#drawMatrixGently): a second tab switch does not start it again. */
    #matrixLoading = false;

    /**
     * First draw of the matrix tab without freezing the world: a field of 0s and 1s fills the tab (not the sidebar;
     * the whole width once it is collapsed) while the grids' devices are resolved a few at a time, the browser free
     * between them; then the tab is drawn, now in milliseconds, and fades in over the field.
     */
    async #drawMatrixGently(parts: string[], placeholder: HTMLElement) {
        if (this.#matrixLoading) return;
        this.#matrixLoading = true;
        showMatrixLoader(placeholder);
        try {
            await warmMatrixNetworks(this.actor, () => this.rendered);
            if (!this.rendered) return;
            // with what went stale during the warm-up (#shownParts kept it back)
            const stale = [...this.#staleParts].filter(id => id === 'matrix' || PARENT_PART[id] === 'matrix');
            const drawn = [...new Set([...parts, ...stale])];
            for (const id of drawn) this.#staleParts.delete(id);
            await this.render(SR5RedesignActorSheet.#shown(drawn));
            this.element.querySelector('[data-application-part="matrix"]')?.classList.add('sr-fade-in');
        } finally {
            this.#matrixLoading = false;
        }
    }

    /**
     * The render remembers the focused field and focuses it again afterwards (SR5ApplicationMixin). Right after an
     * inventory or device picker changed that would put the focus ring back on the plaque, so the memory is dropped then.
     */
    protected override _configureRenderOptions(...args: Parameters<SR5CharacterSheet['_configureRenderOptions']>) {
        const [options] = args;
        // a document update redraws only the parts that show what changed (UPDATE_PARTS, ITEM_PARTS); the parent
        // fills `parts` with every part otherwise
        if (!options.parts) {
            const parts = this.#updateParts(options as { renderContext?: string; renderData?: unknown });
            if (parts) options.parts = parts;
        }
        super._configureRenderOptions(...args);
        if (!options.isFirstRender && options.parts) {
            options.parts = (options as Record<symbol, unknown>)[SHOWN_PARTS] ? options.parts : this.#shownParts(this.#withNestedParts(options.parts));
        }
        // only parts this sheet draws now: the update maps (UPDATE_PARTS, ITEM_PARTS) name the character's parts
        // (magic, bio, social...), which a sheet built on this one (the vehicle sheet) leaves out, and a limited
        // viewer gets the header, tabs, description and footer only (SR5BaseActorSheet); Foundry warns for each other
        const own = this._configureRenderParts(options as never);
        if (options.parts) options.parts = options.parts.filter(id => id in own);
        // every opening (the sheet object outlives a close) starts at the size the user last dragged a sheet to
        if (options.isFirstRender) {
            const size = SR5RedesignActorSheet.#savedSize(this.actor.type);
            if (size) options.position = { ...options.position, ...size };
        }
        if (performance.now() - this.#pickerChangedAt > 1000) return;
        (this as unknown as { pendingFormFieldIndex?: number }).pendingFormFieldIndex = undefined;
        this.#blurPicker();
    }

    /**
     * The parts to redraw plus the parts placed inside them (matrix: its actions, icons and program lists). A part's
     * markup holds empty `data-application-part` slots that the parts after it fill: redrawn alone, it came back with
     * its slots empty.
     */
    #withNestedParts(parts: string[]): string[] {
        const all = [...parts];
        const current = this.parts as Record<string, HTMLElement | undefined>;
        // the array iterator also visits the parts pushed while it runs (parts placed in placed parts)
        for (const part of all) {
            for (const slot of current[part]?.querySelectorAll<HTMLElement>('[data-application-part]') ?? []) {
                const id = slot.dataset.applicationPart;
                if (id && !all.includes(id)) all.push(id);
            }
            // a part still a placeholder (#deferredAtOpen) has no slots yet
            for (const id of NESTED_PARTS[part] ?? []) if (!all.includes(id)) all.push(id);
        }
        return all;
    }

    /**
     * The parts a document update needs redrawn, or undefined for all of them: an actor update whose every key a rule
     * of UPDATE_PARTS covers, an item update, creation or deletion whose types are in ITEM_PARTS. Anything else
     * (effects, items carrying effects, unknown data) keeps the full render.
     */
    #updateParts({ renderContext: context, renderData: data }: { renderContext?: string; renderData?: unknown }): string[] | undefined {
        if (!context || data === undefined || data === null) return undefined;
        const parts = new Set<string>();
        // a favorite of a type the sidebar shows nothing else of (a contact, a program, a SIN) is in it all the same
        // (kept by id, or by uuid)
        const favoriteIds = new Set<string>(this.actor.system.favorites ?? []);
        const favorites = { has: (id: string) => favoriteIds.has(id) || favoriteIds.has(`${this.actor.uuid}.Item.${id}`) };
        if (context === 'updateActor') {
            const keys: string[] = Object.keys(foundry.utils.flattenObject(data as object));
            for (const key of keys) {
                const rule = UPDATE_PARTS.find(([pattern]) => pattern.test(key));
                if (!rule) return undefined;
                for (const part of rule[1]) parts.add(part);
            }
            // damage: the skill pools take the wound modifier, which changes only at a wound threshold
            if (keys.some(key => key.startsWith('system.track.')) && this.#woundModifier() !== this.#skillsWounds) parts.add('skills');
        } else if (context === 'updateitems' || context === 'createitems') { // update + the embedded collection's name
            for (const change of (Array.isArray(data) ? data : [data]) as { _id?: string; type?: string; effects?: unknown[] }[]) {
                const item = context === 'updateitems' ? this.actor.items.get(change._id ?? '') : undefined;
                const type = item?.type ?? change.type;
                // the item's effects and those of the items under it: on system 0.37 a weapon's mods and ammo are
                // nested in it, so equipping one or toggling its effect is an update of the weapon
                const created = context === 'createitems' ? this.actor.items.get(change._id ?? '') : undefined;
                const effects = item || created ? SR5RedesignActorSheet.#effectCount((item ?? created)!) : (change.effects?.length ?? 0);
                const list = type ? (this.constructor as typeof SR5RedesignActorSheet).ITEM_PARTS[type] : undefined;
                if (!list || effects) return undefined;
                // rounds fired, a reload, a stack's count: shown in the inventory and the sidebar only (a weapon's
                // other parts, the matrix tab among them, show nothing of it)
                const keys = item ? Object.keys(foundry.utils.flattenObject(change)).filter(key => !/^(_id|_stats\.)/.test(key)) : [];
                const counts = list.includes('inventory') && keys.length > 0 && keys.every(key => COUNT_KEYS.test(key));
                for (const part of counts ? ['inventory', 'sidebar'] : list) parts.add(part);
                if (favorites.has(change._id ?? '')) parts.add('sidebar');
            }
        } else if (context === 'deleteitems') { // the ids only: the type was noted when the item went (#watchItemDeletes)
            for (const id of (Array.isArray(data) ? data : [data]) as string[]) {
                const deleted = SR5RedesignActorSheet.#deletedItems.get(id);
                const list = deleted ? (this.constructor as typeof SR5RedesignActorSheet).ITEM_PARTS[deleted.type] : undefined;
                if (!list || deleted!.effects) return undefined;
                for (const part of list) parts.add(part);
                if (favorites.has(id)) parts.add('sidebar');
            }
        } else return undefined;
        return parts.size ? [...parts] : undefined;
    }

    /** Wound modifier the skills part was last drawn with; null before it is drawn. */
    #skillsWounds: number | null = null;

    /** The actor's wound modifier as the skill pools take it (system.wounds, prepared from the tracks). */
    #woundModifier(): number {
        return Number((this.actor.system as { wounds?: { value?: number } }).wounds?.value ?? 0);
    }

    /** Type and effect count of the items deleted lately, by id: a deletion's render only gets the ids. */
    static #deletedItems = new Map<string, { type: string; effects: number }>();
    static #itemDeletesWatched = false;

    static #watchItemDeletes() {
        if (SR5RedesignActorSheet.#itemDeletesWatched) return;
        SR5RedesignActorSheet.#itemDeletesWatched = true;
        (Hooks.on.bind(Hooks) as (hook: string, fn: (...args: never[]) => void) => number)('deleteItem', (item: SR5Item) => {
            if (!item?.id || !(item.parent instanceof Actor)) return;
            const deleted = SR5RedesignActorSheet.#deletedItems;
            if (deleted.size > 500) deleted.clear();
            deleted.set(item.id, { type: item.type, effects: SR5RedesignActorSheet.#effectCount(item) });
        });
    }

    override async _onFirstRender(...args: Parameters<SR5CharacterSheet['_onFirstRender']>) {
        await super._onFirstRender(...args);
        // the window's shadow, on a layer of its own under the frame (actor-redesign.scss, .sr-window-shadow)
        const shadow = document.createElement('div');
        shadow.className = 'sr-window-shadow';
        shadow.setAttribute('aria-hidden', 'true');
        this.element.prepend(shadow);
        this.#rememberResize();
        this.#watchDrags();
        wireSidebarScrollLane(this.element, () => this.#sidebarDrawnAt);
        SR5RedesignActorSheet.#watchDeletionConfirms();
        SR5RedesignActorSheet.#watchItemDeletes();
        // matrix tab: the device plaque's dropdown equips the chosen device
        this.element.addEventListener('change', event => {
            const select = event.target;
            if (!(select instanceof HTMLSelectElement) || !select.matches('.matrix-device-select')) return;
            // no focus ring left on the field once a choice is made, as with the inventory pickers
            this.#pickerChangedAt = performance.now();
            select.blur();
            requestAnimationFrame(() => this.#blurPicker());
            void this.#switchMatrixDevice(select.value);
        });
        // Foundry locks a tooltip on the middle button's release; on Windows its press also starts the browser's
        // autoscroll. No autoscroll where a tooltip is showing or about to: the release still locks it.
        this.element.addEventListener('mousedown', event => {
            if (event.button !== 1) return;
            const target = event.target instanceof Element ? event.target : null;
            if (game.tooltip?.element || target?.closest('[data-tooltip], [data-tooltip-html], [data-rich-uuid], [data-rich-stat]')) event.preventDefault();
        }, { capture: true });
        // the action tracker: a right click on a lozenge gets one action back
        this.element.addEventListener('contextmenu', event => {
            const lozenge = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-action="spendAction"]') : null;
            if (!lozenge) return;
            event.preventDefault();
            event.stopPropagation();
            void this.#actions.change(lozenge, -1);
        });
        this.#wireFavoriteKeys();
        // context menus without a mouse: Shift+F10 / the Menu key in a row, keyboard use of the open menu
        RowMenu.install();
        this.element.addEventListener('keydown', event => RowMenu.onKeydown(event));
        // inventory pickers (plaques in the title row): no focus ring left on the plaque once a choice is made. Blurred
        // in the capture phase, before the upstream handler on the select re-renders; the browser focuses the select
        // again when its list closes, so it is blurred once more on the next frame, and the render does not bring the
        // focus back either (_configureRenderOptions).
        // A click on a picker leaves it focused, and Chrome then counts that as keyboard focus (:focus-visible); a
        // re-render also gives the focus back to the new picker. So the window remembers how it is being used: after
        // a pointer press the pickers draw no ring, after Tab they do again. On the window element, which survives
        // re-renders.
        this.element.addEventListener('pointerdown', () => this.element.classList.add('pointer-nav'), { capture: true });
        this.element.addEventListener('keydown', event => {
            if (event.key === 'Tab') this.element.classList.remove('pointer-nav');
        }, { capture: true });
        this.element.addEventListener('change', event => {
            const select = event.target;
            if (!(select instanceof HTMLSelectElement) || !select.closest('.plaque-select')) return;
            this.#pickerChangedAt = performance.now();
            select.blur();
            requestAnimationFrame(() => this.#blurPicker());
        }, { capture: true });
        this.element.addEventListener('change', event => {
            const select = event.target;
            if (!(select instanceof HTMLSelectElement)) return;
            // augmentations tab: pick the inventory to list, without touching the inventory tab's choice
            if (!select.matches('.implant-inventory-select')) return;
            this.#implantInventory = select.value;
            void this.render({ parts: ['augmentations'] });
        });
        // Enter / Space activate the non-native controls made focusable by enhanceAccessibility (RedesignAccessibility).
        this.element.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            const target = event.target;
            if (!(target instanceof HTMLElement) || target.matches(NATIVE_CONTROLS) || target.getAttribute('role') !== 'button') return;
            event.preventDefault();
            target.click();
        });
    }

    /**
     * Controls that only change what this viewer sees (tabs, folding, search, filters, sorting, descriptions,
     * sources): Foundry disables every form field of a sheet the user cannot edit (_toggleDisabled), our tab rail and
     * the rest among them, so an observer stayed on the first tab. They are enabled again; editing stays off.
     */
    static readonly VIEW_CONTROLS = [
        '[data-action="tab"]', '[data-action="toggleSidebar"]', '[data-action="toggleExpanded"]',
        '[data-action="showItemDescription"]', '[data-action="openSkillDescription"]', '[data-action="openSource"]',
        '[data-action="openUuid"]', '[data-action="sortSkills"]', '[data-action="toggleSkillFilter"]',
        '[data-action="toggleListFilter"]', '[data-action="clearListFilters"]', '[data-action="toggleConnectedMatrixIcons"]',
        '[data-action="refresh"]', '.sort-button', '.list-filter-button', '.list-filter-option', '.list-search-input',
        '.skill-search input', '#select-inventory',
    ].join(', ');

    protected override _toggleDisabled(disabled: boolean) {
        super._toggleDisabled(disabled);
        if (!disabled) return;
        for (const control of this.element.querySelectorAll<HTMLButtonElement | HTMLInputElement | HTMLSelectElement>(SR5RedesignActorSheet.VIEW_CONTROLS)) control.disabled = false;
    }

    override async _onRender(...args: Parameters<SR5CharacterSheet['_onRender']>) {
        // Layout patches first, synchronously, before the parent's async work can let the browser paint the fresh
        // parts in their upstream look (columns, row order, sidebar state would otherwise flash for a frame).
        // No transitions while the fresh parts are patched: the patches measure the layout first, so the parts get
        // their upstream style computed and every class added after it (a lit filter button, a sorted column)
        // would fade in from it (the system buttons carry `transition: .5s`), a blink on every re-render.
        this.element.classList.add('sr-patching');
        try {
            // a patch that fails (data the sheet did not expect) must not stop the parent's render below: it disables
            // a read-only sheet's fields and binds the system's handlers
            try {
                this.element.classList.toggle('sr-edit-mode', this.isEditMode);
                // a button with no type submits the form: Enter in any field "clicked" the first one, the system's edit
                // mode toggle in the window header, so a search or a typed rating switched play and edit mode
                for (const button of this.element.querySelectorAll<HTMLButtonElement>('button:not([type])')) button.type = 'button';
                this.#art.apply();
                // a re-render replaces the header: a reposition in progress on the old one is dropped
                this.#art.endIfReplaced();
                this.#addSpellCategoryColumn();
                // the patches below look in what this render drew (a whole tab for a part placed in one: the table
                // sort counts a tab's cards), not the whole window every time
                const roots = this.#patchRoots(args[1]);
                this.#alignNumericColumns(roots);
                this.#alignTableLanes(this.#renderedRoots(args[1]));
                this.#applySkillSort();
                // the system's skill filter (SR5BaseActorSheet, run by its search filter in super._onRender below and again a
                // moment later) puts the active skill rows back in A-Z order: watched from now on, the fresh list gets this
                // table's sort back before the browser paints it (watched after super, the rows showed A-Z for ~200 ms)
                this.#watchSkillFilter();
                this.#addTableSortButtons(roots);
                this.#applyTableSort(roots);
                this.#applySidebarState();
                measureSidebarBar(this.element);
                if (!args[1]?.parts || args[1].parts.includes('sidebar')) this.#sidebarDrawnAt = performance.now();
                this.#markActiveTab();
                // everything else that shows is drawn here too: a change in one place (Blitz, a damage box) re-renders every
                // part, and what waited for the parent below came a frame late, so the filter buttons lit up again, the ⋮
                // buttons, source links and meter corners popped in, filtered rows showed for a frame
                for (const root of roots) RowMenu.addButtons(root);
                this.#addSourceLinks(roots);
                this.#arrangeProperties(roots);
                this.#restoreListControls();
                this.#syncSkillFilterMenu();
                this.#markMeterCorners();
            } catch (error) {
                console.error('SR5 Redesign | a sheet patch failed', error);
            }
            await super._onRender(...args);
            // these build on what the parent sets up (filter handler, modifier tooltips) and only wire behaviour
            wireCollapserTooltip(this.element);
            wireInitiativeMenu(this.element);
            enhanceAccessibility(this.element, this.#renderedRoots(args[1]));
            this.#attachRichTooltips();
            this.#wireListControls();
            this.#wireSkillFilter();
            this.#restoreFavoriteFocus();
            if (args[1]?.isFirstRender) rememberImages(this.element);
        } finally {
            // the patched values are in place (a style flush with transitions still off), so hover fades come back
            void this.element.offsetHeight;
            this.element.classList.remove('sr-patching');
        }
    }

    /** Re-marks a condition monitor's corner boxes when its width changes the number of boxes a row. */
    #meterObserver = new ResizeObserver(entries => {
        for (const entry of entries) SR5RedesignActorSheet.#markCorners(entry.target as HTMLElement);
    });

    /**
     * Condition monitors (stun, physical, matrix): the boxes in the frame's bevelled corners take the bevel. The
     * first box sits in the top-left corner; the last one in the bottom-right only when it ends a full row. Found
     * from the laid-out columns, so it follows the track's length and, for the matrix track, the card's width.
     */
    #markMeterCorners() {
        this.#meterObserver.disconnect();
        for (const meter of this.element.querySelectorAll<HTMLElement>('.meter')) {
            // a track with its column count in the markup is marked now; the matrix track's columns follow the card's
            // width, which only the layout knows: it waits for the observer's first call, made once the layout is
            // done and before the frame is painted (reading it here forced a layout of the whole fresh sheet, ~9 ms)
            if (SR5RedesignActorSheet.#markupColumns(meter)) SR5RedesignActorSheet.#markCorners(meter);
            this.#meterObserver.observe(meter);
        }
    }

    /** A track's column count from its markup (`style="--cols: 10"`, sidebar.hbs), 0 when the layout decides. */
    static #markupColumns(meter: HTMLElement): number {
        return Number.parseInt(meter.style.getPropertyValue('--cols')) || 0;
    }

    static #markCorners(meter: HTMLElement) {
        const cells = [...meter.querySelectorAll<HTMLElement>(':scope > .cell')];
        const columns = SR5RedesignActorSheet.#markupColumns(meter)
            || getComputedStyle(meter).gridTemplateColumns.split(' ').filter(Boolean).length || 1;
        cells.forEach((cell, index) => {
            cell.classList.toggle('corner-tl', index === 0);
            cell.classList.toggle('corner-br', index === cells.length - 1 && cells.length % columns === 0);
        });
    }

    /**
     * While something is dragged over the sheet (a row of it, or an item from the sidebar or a compendium) the window
     * gets `sr-dragging`: the favorites show their drop zone even when there are none yet. dragover repeats while the
     * drag stays over the window, so the class goes a moment after it stops (left the window, dropped, cancelled).
     */
    #watchDrags() {
        const root = this.element;
        let timer: number | undefined;
        const end = () => {
            window.clearTimeout(timer);
            root.classList.remove('sr-dragging');
            for (const favorite of root.querySelectorAll('.favorite-dragged')) favorite.classList.remove('favorite-dragged');
        };
        root.addEventListener('dragstart', event => {
            root.classList.add('sr-dragging');
            if (event.target instanceof Element) event.target.closest('.favorites .favorite')?.classList.add('favorite-dragged');
        }, { capture: true });
        root.addEventListener('dragover', () => {
            root.classList.add('sr-dragging');
            window.clearTimeout(timer);
            timer = window.setTimeout(end, 300);
        });
        root.addEventListener('dragend', end, { capture: true });
        root.addEventListener('drop', end, { capture: true });
    }

    /** Edit mode: Alt + ↑ / ↓ on a favorite moves it one place, the keyboard way to reorder what drag and drop does. */
    #wireFavoriteKeys() {
        this.element.addEventListener('keydown', event => {
            if (!event.altKey || (event.key !== 'ArrowUp' && event.key !== 'ArrowDown')) return;
            const favorite = event.target instanceof Element ? event.target.closest<HTMLElement>('.favorites .favorite') : null;
            if (!favorite || !this.isEditMode || !this.isEditable) return;
            event.preventDefault();
            const favorites = this.actor.system.favorites;
            const id = [favorite.dataset.itemId, favorite.dataset.uuid].find(entry => entry && favorites.includes(entry));
            if (!id) return;
            const from = favorites.indexOf(id);
            const to = from + (event.key === 'ArrowUp' ? -1 : 1);
            if (to < 0 || to >= favorites.length) return;
            this.#focusFavorite = id;
            // placeInList puts it before the entry now at the index: one further when moving down
            void this.actor.update({ system: { favorites: SheetFlow.placeInList(favorites, id, to > from ? to + 1 : to) } });
        });
    }

    #restoreFavoriteFocus() {
        const id = this.#focusFavorite;
        if (!id) return;
        this.#focusFavorite = null;
        const favorite = [...this.element.querySelectorAll<HTMLElement>('.favorites .favorite')]
            .find(entry => entry.dataset.itemId === id || entry.dataset.uuid === id);
        favorite?.querySelector<HTMLElement>('button')?.focus();
    }

    /** The skill filter menu's behaviour; its checked state is drawn before (#syncSkillFilterMenu). */
    #wireSkillFilter() {
        const controls = this.element.querySelector<HTMLElement>('.skill-filter');
        const menu = controls?.querySelector<HTMLElement>('.list-filter-menu');
        const button = controls?.querySelector<HTMLElement>('.list-filter-button');
        if (!controls || !menu || !button) return;
        wireListFilterMenu(menu, button);
    }

    /** List searches back in place after a render, before it shows: chips checked, search text, rows filtered. */
    #restoreListControls() {
        for (const controls of this.element.querySelectorAll<HTMLElement>('.list-controls[data-list-controls]')) {
            const tabId = controls.dataset.listControls!;
            const state = this.#listFilterState(tabId);
            this.#syncListFilterMenu(controls, state.chips);
            const input = controls.querySelector<HTMLInputElement>('.list-search-input');
            if (input) input.value = state.query;
            this.#applyListFilter(tabId);
        }
    }

    /** List search fields: filter as the user types (their state is back in place already, #restoreListControls). */
    #wireListControls() {
        for (const controls of this.element.querySelectorAll<HTMLElement>('.list-controls[data-list-controls]')) {
            const tabId = controls.dataset.listControls!;
            const state = this.#listFilterState(tabId);
            const input = controls.querySelector<HTMLInputElement>('.list-search-input');
            const menu = controls.querySelector<HTMLElement>('.list-filter-menu');
            const button = controls.querySelector<HTMLElement>('.list-filter-button');
            if (menu && button) wireListFilterMenu(menu, button);
            if (input && !input.dataset.wired) {
                // a partial render keeps this input (its part was not drawn): its listeners are on it already
                input.dataset.wired = 'true';
                let timer: number | undefined;
                input.addEventListener('input', () => {
                    state.query = input.value;
                    window.clearTimeout(timer);
                    timer = window.setTimeout(() => this.#applyListFilter(tabId), LIST_SEARCH_DELAY_MS);
                });
                input.addEventListener('keydown', event => {
                    if (event.key !== 'Escape' || !input.value) return;
                    event.preventDefault();
                    event.stopPropagation(); // keep the sheet open: Escape only clears the search
                    input.value = state.query = '';
                    this.#applyListFilter(tabId);
                });
                input.addEventListener('focus', () => { this.#listSearchFocus = tabId; });
                input.addEventListener('blur', () => { if (this.#listSearchFocus === tabId) this.#listSearchFocus = null; });
                if (this.#listSearchFocus === tabId) {
                    input.focus();
                    input.setSelectionRange(input.value.length, input.value.length);
                }
            }
        }
    }

    #listFilterState(tabId: string) {
        let state = this.#listFilters.get(tabId);
        if (!state) this.#listFilters.set(tabId, state = { query: '', chips: new Set() });
        return state;
    }

    /**
     * Filter options of a tab for the menu, ungrouped first, then one block per group with its heading. Options the
     * actor no longer offers are unchecked, so a chip left over from a deleted spell does not hide every row.
     */
    #listFilterGroups(tabId: string) {
        const groups = new Map<string, { label: string | null; chips: { id: string; label: string; icon?: string }[] }>();
        const { chips: checked } = this.#listFilterState(tabId);
        for (const { id, label, icon, group, offered } of LIST_FILTERS[tabId] ?? []) {
            if (offered && !offered(this.actor)) {
                checked.delete(id);
                continue;
            }
            const key = group ?? '';
            if (!groups.has(key)) groups.set(key, { label: group ? LIST_FILTER_GROUPS[group] ?? null : null, chips: [] });
            groups.get(key)!.chips.push({ id, label, icon });
        }
        return [...groups.entries()].sort(([a], [b]) => (a ? 1 : 0) - (b ? 1 : 0))
            .map(([, group]) => ({ ...group, columns: group.chips.length > LIST_FILTER_COLUMNS_FROM }));
    }

    /** Checked state of the menu options and the count on the filter button. */
    #syncListFilterMenu(controls: HTMLElement, chips: Set<string>) {
        for (const option of controls.querySelectorAll<HTMLElement>('.list-filter-option[data-filter]')) {
            option.setAttribute('aria-checked', String(chips.has(option.dataset.filter ?? '')));
        }
        const button = controls.querySelector<HTMLElement>('.list-filter-button');
        const count = button?.querySelector<HTMLElement>('.list-filter-count');
        button?.classList.toggle('active', chips.size > 0);
        // the filled button shows that filters are on; screen readers also hear how many
        if (count) count.textContent = chips.size ? game.i18n.format('SR5.Redesign.ListFiltersOn', { count: chips.size }) : '';
        const clear = controls.querySelector<HTMLButtonElement>('.list-filter-clear');
        if (clear) clear.disabled = chips.size === 0;
    }

    static #toggleListFilter(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const controls = target.closest<HTMLElement>('[data-list-controls]');
        const tabId = controls?.dataset.listControls;
        const id = target.dataset.filter;
        if (!controls || !tabId || !id) return;
        const { chips } = this.#listFilterState(tabId);
        if (chips.has(id)) chips.delete(id); else chips.add(id);
        this.#syncListFilterMenu(controls, chips);
        this.#applyListFilter(tabId);
    }

    static #clearListFilters(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const controls = target.closest<HTMLElement>('[data-list-controls]');
        const tabId = controls?.dataset.listControls;
        if (!controls || !tabId) return;
        this.#listFilterState(tabId).chips.clear();
        this.#syncListFilterMenu(controls, new Set());
        this.#applyListFilter(tabId);
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        controls.querySelector<HTMLElement>('.list-filter-button')?.focus();
    }

    /**
     * Shows the rows of a tab that match its search text (row name) and chips, in place. Cards and tables whose rows
     * are all filtered out hide; ones that never had rows (add-only cards in edit mode, the device card) stay.
     */
    #applyListFilter(tabId: string) {
        const tab = this.element.querySelector<HTMLElement>(`section.tab[data-group="primary"][data-tab="${tabId}"]`);
        if (!tab) return;
        const state = this.#listFilterState(tabId);
        const query = searchText(state.query);
        const groups = new Map<string, ListFilterChip[]>();
        for (const chip of LIST_FILTERS[tabId] ?? []) {
            if (!state.chips.has(chip.id)) continue;
            const key = chip.group ?? chip.id;
            groups.set(key, [...(groups.get(key) ?? []), chip]);
        }
        const active = !!query || groups.size > 0;
        tab.classList.toggle('filtering', active);
        let shown = 0;
        let total = 0;
        for (const row of tab.querySelectorAll<HTMLElement>('.list-item-container > .list-item[data-uuid]')) {
            total++;
            let match = true;
            if (query) match = searchText(row.querySelector('.list-item-start')?.textContent ?? '').includes(query);
            if (match && groups.size) {
                const doc = fromUuidSync(row.dataset.uuid!);
                match = [...groups.values()].every(group => group.some(chip => chip.test(doc)));
            }
            row.parentElement!.classList.toggle('filter-hidden', active && !match);
            if (match) shown++;
        }
        for (const section of tab.querySelectorAll<HTMLElement>('.items-section, .matrix-action-group')) {
            const hasRows = !!section.querySelector('.list-item-container');
            const visible = !!section.querySelector('.list-item-container:not(.filter-hidden)');
            section.classList.toggle('filter-hidden', active && hasRows && !visible);
        }
        const noMatch = tab.querySelector<HTMLElement>('.list-no-match');
        if (noMatch) noMatch.hidden = !(active && shown === 0);
        const count = tab.querySelector<HTMLElement>('.list-count');
        if (count) count.textContent = active ? game.i18n.format('SR5.Redesign.ListCount', { shown, total }) : '';
    }

    /** Rich hover cards (SR5RichTooltip) on item names, skill names, favorites, effects and quality pills. */
    #attachRichTooltips() {
        RichTooltip.install();
        const root = this.element;
        for (const el of root.querySelectorAll<HTMLElement>('.list-item[data-uuid] .item-name-link, .favorite[data-uuid] :is(.favorite-name, button.favorite-row)')) {
            const uuid = el.closest<HTMLElement>('[data-uuid]')?.dataset.uuid;
            if (uuid) RichTooltip.attach(el, uuid);
        }
        // effects (Effects tab): the effect's own card; quality pills (Skills tab): the quality's card
        for (const el of root.querySelectorAll<HTMLElement>('.list-item[data-effect-id][data-uuid] > .list-item-start > a[data-action="showItemDescription"], .pill[data-uuid] > .label')) {
            const uuid = el.closest<HTMLElement>('[data-uuid]')?.dataset.uuid;
            if (uuid) RichTooltip.attach(el, uuid);
        }
        for (const el of root.querySelectorAll<HTMLElement>('.list-item[data-skill-id] .skill-name')) {
            const item = this.actor.items.get(el.closest<HTMLElement>('[data-skill-id]')?.dataset.skillId ?? '');
            if (item) RichTooltip.attach(el, item.uuid);
        }
        // attributes, limits, armor and movement: icon, what it does and the modifier breakdown
        for (const el of root.querySelectorAll<HTMLElement>('.ability-score[data-attribute-id] > .label')) {
            // a vehicle's plates are its vehicle stats (handling, speed, acceleration... on the road it is on)
            const kind = el.closest('.vehicle-stat') ? 'vehicle' : 'attribute';
            RichTooltip.attachStat(el, this.actor, kind, el.closest<HTMLElement>('[data-attribute-id]')!.dataset.attributeId!);
        }
        for (const el of root.querySelectorAll<HTMLElement>('.limit-row .limit[data-limit-modifier-tooltip]')) {
            RichTooltip.attachStat(el, this.actor, 'limit', el.dataset.limitModifierTooltip!);
        }
        // a vehicle's modification slots: the modifications in each category (the vehicle sheet's Vehicle tab)
        for (const el of root.querySelectorAll<HTMLElement>('.mod-slots .slot-row[data-slot]')) {
            RichTooltip.attachStat(el, this.actor, 'modslots', el.dataset.slot!);
        }
        const armor = root.querySelector<HTMLElement>('.sr-sidebar [data-modifier-tooltip-path="system.armor.rating"]');
        if (armor) RichTooltip.attachStat(armor, this.actor, 'armor', 'rating');
        for (const [key, id] of [['SR5.WalkingSpeed', 'walk'], ['SR5.RunningSpeed', 'run']] as const) {
            const el = root.querySelector<HTMLElement>(`.sr-sidebar [data-tooltip="${key}"], [data-tooltip="${key}"]`);
            if (el) RichTooltip.attachStat(el, this.actor, 'movement', id);
        }
    }

    /**
     * Header click sorts by that column (numbers highest first, attributes A-Z, names Z-A) and highlights it; a
     * second click reverses it, a third returns to the default order (names A-Z, nothing highlighted). The name
     * column has two steps: Z-A, then back to the default A-Z.
     */
    static #sortSkills(this: SR5RedesignActorSheet, event: PointerEvent) {
        const button = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-sort]');
        const table = button?.closest<HTMLElement>('[data-sort-table]')?.dataset.sortTable as SkillTable | undefined;
        const key = button?.dataset.sort as SkillSortKey | undefined;
        if (!table || !key) return;
        // numbers: highest first; attribute codes and action types: A-Z / cheapest first; name: Z-A (A-Z is the default)
        const first = key === 'name' || !ASCENDING_SORT_KEYS.has(key) ? 'desc' : 'asc';
        this.#cycleSort(table, key, first, key === 'name');
        this.#applySkillSort();
    }

    /**
     * The sort button by the skill search: cycles every skill table through name A-Z (their default), Z-A, pool and
     * rating highest first. A header click still sorts one table; the button then shows the default again.
     */
    static #cycleSkillSort(this: SR5RedesignActorSheet) {
        const next = SKILL_SORT_MODES[(SKILL_SORT_MODES.indexOf(this.#skillSortMode()) + 1) % SKILL_SORT_MODES.length];
        for (const table of SKILL_SORT_TABLES) {
            if (next.sort) this.#tableSort[table] = { ...next.sort };
            else delete this.#tableSort[table];
            this.#saveSort(table);
        }
        this.#applySkillSort();
    }

    /** The skill sort button's mode: the one every skill table is sorted by, else the default. */
    #skillSortMode(): typeof SKILL_SORT_MODES[number] {
        const sorts = SKILL_SORT_TABLES.map(table => this.#tableSort[table]);
        return SKILL_SORT_MODES.find(mode => mode.sort
            && sorts.every(sort => sort?.key === mode.sort.key && sort.dir === mode.sort.dir)) ?? SKILL_SORT_MODES[0];
    }

    /** Icon and name of the skill sort button after its mode. */
    #syncSkillSortButton() {
        const button = this.element.querySelector<HTMLElement>('.skill-sort-button');
        if (!button) return;
        const label = game.i18n.localize(this.#skillSortMode().label);
        button.setAttribute('aria-label', `${game.i18n.localize('SR5.Redesign.ListSort.Label')}: ${label}`);
        button.dataset.tooltip = label;
        button.querySelector('i')!.className = `fas ${this.#skillSortMode().icon}`;
    }

    /**
     * One header click on a sortable table: an unsorted column sorts in its first direction, the sorted one reverses,
     * the reversed one goes back to the table's default order. `reverseIsDefault`: the reverse is the default order
     * already (names of a table listed A-Z), so the column goes straight back to it.
     */
    #cycleSort(table: string, key: string, first: TableSort['dir'], reverseIsDefault: boolean) {
        const current = this.#tableSort[table];
        if (current?.key !== key) this.#tableSort[table] = { key, dir: first };
        else if (current.dir === first && !reverseIsDefault) this.#tableSort[table] = { key, dir: first === 'asc' ? 'desc' : 'asc' };
        else delete this.#tableSort[table];
        this.#saveSort(table);
    }

    /** The skill filter options in effect: the user's choice, else the mode's default. */
    #activeSkillFilters(): Set<string> {
        if (this.#skillFilters?.edit === this.isEditMode) return this.#skillFilters.options;
        return new Set(this.isEditMode ? [] : ['training:trained']);
    }

    static #toggleSkillFilter(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const id = target.dataset.filter;
        if (!id) return;
        const filters = new Set(this.#activeSkillFilters());
        this.#skillFilters = { edit: this.isEditMode, options: filters };
        if (filters.has(id)) filters.delete(id); else filters.add(id);
        this.#syncSkillFilterMenu();
        this.#refilterSkills();
    }

    static #clearSkillFilters(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        this.#skillFilters = { edit: this.isEditMode, options: new Set() };
        this.#syncSkillFilterMenu();
        this.#refilterSkills();
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        this.element.querySelector<HTMLElement>('.skill-filter .list-filter-button')?.focus();
    }

    #syncSkillFilterMenu() {
        const controls = this.element.querySelector<HTMLElement>('.skill-filter');
        if (controls) this.#syncListFilterMenu(controls, this.#activeSkillFilters());
    }

    /** Applies the filter menu in place (a re-render of the tab would flicker); with search text, the base sheet's
     * fuzzy filter runs again (it orders by match and calls _isSkillFiltered). */
    #refilterSkills() {
        const search = this.element.querySelector<HTMLInputElement>('#filter-active-skills');
        if (search?.value.trim()) {
            search.dispatchEvent(new Event('input', { bubbles: true }));
            return;
        }
        for (const row of this.element.querySelectorAll<HTMLElement>('#active-skills-scroll [data-skill-id][data-category="active"]')) {
            const skill = this.actor.getSkillById(row.dataset.skillId ?? '');
            if (skill) row.parentElement?.classList.toggle('hidden', !this._isSkillFiltered(row.dataset.skillId!, skill));
        }
    }

    /**
     * Options of the skill filter menu: training, the attributes the active skills use (sheet order), and the skill
     * groups they belong to. Groups come from the system's skill groups pack (its group lists name the skills) and
     * from the actor's own group items; a skill's own group field wins.
     */
    async #skillFilterGroups(context: RedesignPartContext) {
        const active = Object.values((context.system as PreparedSheetSystem).skills?.active ?? {});
        this.#skillGroupOf.clear();
        // a pack's skill group item (system.group.skills), or one of the actor's groups (group.skills)
        type SkillGroupSource = { name?: string; system?: { group?: { skills?: string[] } }; group?: { skills?: string[] } };
        const groupItems: SkillGroupSource[] = [...await PackItemFlow.getPackSkillgroups() as SkillGroupSource[], ...(context.skillGroups ?? []) as SkillGroupSource[]];
        for (const group of groupItems) {
            const skills = group?.system?.group?.skills ?? group?.group?.skills ?? [];
            for (const name of skills) if (group.name) this.#skillGroupOf.set(String(name).toLowerCase(), group.name);
        }
        const groupOf = (skill: PreparedSkill) => skill.group || this.#skillGroupOf.get(String(skill.name ?? '').toLowerCase())
            || this.#skillGroupOf.get(String(skill.label ?? '').toLowerCase()) || '';
        const order = [...CORE_ATTRIBUTES, 'magic', 'resonance'] as string[];
        const attributes = [...new Set(active.map(skill => skill.attribute).filter(Boolean))]
            .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
        const groups = [...new Set(active.map(groupOf).filter(Boolean))].sort((a, b) => a.localeCompare(b, game.i18n.lang));
        return [
            { label: 'SR5.Redesign.SkillFilter.Training', chips: [
                { id: 'training:trained', label: 'SR5.Redesign.SkillFilter.Trained' },
                { id: 'training:untrained', label: 'SR5.Redesign.SkillFilter.Untrained' },
            ] },
            { label: 'SR5.Attribute', chips: attributes.map(id => ({ id: `attr:${id}`, label: SR5.attributes[id as keyof typeof SR5.attributes] ?? id })) },
            ...(groups.length ? [{ label: 'SR5.Redesign.SkillFilter.Group', chips: groups.map(name => ({ id: `group:${name}`, label: name })) }] : []),
        ].filter(group => group.chips.length).map(group => ({ ...group, columns: group.chips.length > LIST_FILTER_COLUMNS_FROM }));
    }

    /**
     * Order the rows of every skill table by its sort state and update the header indicators (icon + aria-sort).
     * While the filter has text, the base sheet's relevance order is kept. Rows only move when the order differs,
     * so this is safe to call from the mutation observer below.
     */
    #applySkillSort() {
        const searching = this._filters.skills.trim().length > 0;
        for (const header of this.element.querySelectorAll<HTMLElement>('[data-sort-table]')) {
            const table = header.dataset.sortTable as SkillTable;
            const { key: sortKey, dir } = this.#tableSort[table] ?? { key: 'name', dir: 'asc' };
            const key = sortKey as SkillSortKey;
            const isDefault = key === 'name' && dir === 'asc';
            for (const button of header.querySelectorAll<HTMLElement>('[data-sort]')) {
                const active = button.dataset.sort === key;
                button.closest('[role="columnheader"]')?.setAttribute('aria-sort', active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none');
                button.classList.toggle('sorted', active && !isDefault);
                button.setAttribute('aria-pressed', String(active && !isDefault));
            }
            if (searching && table === 'active') continue;

            // rows belonging to this header: following siblings up to the next header / non-skill row
            const rows: HTMLElement[] = [];
            let node = header.nextElementSibling;
            if (table === 'active') node = this.element.querySelector('#active-skills-scroll')?.firstElementChild ?? null;
            while (node instanceof HTMLElement && node.matches('.list-item-container[data-sort-name]')) {
                rows.push(node);
                node = node.nextElementSibling;
            }
            if (rows.length < 2) continue;
            const value = (row: HTMLElement) => row.dataset[`sort${key[0].toUpperCase()}${key.slice(1)}`] ?? '';
            const sorted = [...rows].sort((a, b) => {
                const result = NUMERIC_SORT_KEYS.has(key)
                    ? Number(value(a)) - Number(value(b))
                    : value(a).localeCompare(value(b), game.i18n.lang);
                // ties: by name, always ascending
                return (dir === 'asc' ? result : -result) || (a.dataset.sortName ?? '').localeCompare(b.dataset.sortName ?? '', game.i18n.lang);
            });
            if (sorted.every((row, i) => row === rows[i])) continue;
            const anchorNode = rows[rows.length - 1].nextSibling;
            for (const row of sorted) row.parentElement?.insertBefore(row, anchorNode);
        }
        this.#syncSkillSortButton();
    }

    // ---------- card tables: the item tabs' cards sort from their column headers, like the skills ----------

    /** User flag holding each table's sort per actor type: {character: {active: {key, dir}, 'magic:combatspells:0': …}}; null = default. */
    static readonly SORT_FLAG = 'redesignSort';

    static #savedSort(type: string | undefined): Record<string, TableSort> {
        if (!type) return {};
        const saved = game.user?.getFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.SORT_FLAG}.${type}` as never) as Record<string, TableSort | null> | undefined;
        return Object.fromEntries(Object.entries(saved ?? {})
            .filter(([, sort]) => typeof sort?.key === 'string' && (sort.dir === 'asc' || sort.dir === 'desc'))) as Record<string, TableSort>;
    }

    /** Stores one table's sort for the user's sheets of this actor type; the default order is stored as null. */
    #saveSort(table: string) {
        void game.user?.setFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.SORT_FLAG}.${this.actor.type}.${table}` as never, (this.#tableSort[table] ?? null) as never);
    }

    /**
     * Sort buttons in the column headers of the item tabs' cards (inventory, actions, magic, social, bio, effects...):
     * the title sorts by name, every named column by its values. Skills and matrix actions have theirs in the templates.
     * A card is keyed by its tab and list type, numbered when a tab has two of a type (positive / negative qualities).
     */
    #addTableSortButtons(roots: HTMLElement[] = [this.element]) {
        const seen = new Map<string, number>();
        for (const header of roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('section.tab .items-section.card > .list-item.list-item-header')])) {
            const card = header.parentElement!;
            const tab = header.closest<HTMLElement>('section.tab')?.dataset.tab;
            if (!tab || !card.querySelector(':scope > .list-item-container > .list-item')) continue;
            const base = `${tab}:${card.dataset.type ?? ''}`;
            const index = seen.get(base) ?? 0;
            seen.set(base, index + 1);
            header.dataset.sortCard = `${base}:${index}`;
            const wrap = (cell: Element | null, key: string) => {
                if (!cell?.textContent?.trim() || cell.querySelector(':scope > .sort-button')) return;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'unbutton sort-button';
                button.dataset.action = 'sortTable';
                button.dataset.sort = key;
                button.append(...cell.childNodes);
                cell.append(button);
            };
            wrap(header.querySelector(':scope > .list-item-start > label'), 'name');
            // a column of several values (a device's A S D F) has no one value to sort by, and keeps its letters over them
            header.querySelectorAll(':scope > .list-item-col').forEach((col, index) => {
                if (col.children.length < 2) wrap(col, `col${index}`);
            });
        }
    }

    /**
     * Header click on a card table: sorts by that column, numbers highest first, text and action types A-Z / cheapest
     * first, the name in the order the card does not already have (A-Z, or Z-A when it lists A-Z). A second click
     * reverses it, a third returns to the card's own order (#cycleSort).
     */
    static #sortTable(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const header = target.closest<HTMLElement>('[data-sort-card]');
        const table = header?.dataset.sortCard;
        const key = target.dataset.sort;
        if (!header || !table || !key) return;
        const rows = cardRows(header).sort((a, b) => Number(a.dataset.sortDefault) - Number(b.dataset.sortDefault));
        const values = rows.map(row => sortValue(sortCell(row, key), key));
        let first: TableSort['dir'];
        let alphabetical = false;
        if (key === 'name') {
            const listed = values.filter(value => value !== null);
            alphabetical = listed.every((value, i) => i === 0 || compareSortValues(listed[i - 1]!, value!) <= 0);
            first = alphabetical ? 'desc' : 'asc';
        } else {
            first = values.some(value => value && 'number' in value && !value.ranked) ? 'desc' : 'asc';
        }
        this.#cycleSort(table, key, first, alphabetical);
        this.#applyTableSort();
    }

    /**
     * The sort button by a tab's search (as dnd5e's): cycles every card of the tab through the sheet's own order, name
     * A-Z and name Z-A. Header sorts of single cards stay possible; the button then shows the sheet order again.
     */
    static #cycleListSort(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const tabId = target.closest<HTMLElement>('[data-list-controls]')?.dataset.listControls;
        if (!tabId) return;
        const headers = this.#sortCards(tabId);
        const next = LIST_SORT_MODES[(LIST_SORT_MODES.indexOf(this.#listSortMode(tabId)) + 1) % LIST_SORT_MODES.length];
        const changes: Record<string, TableSort | null> = {};
        for (const header of headers) {
            const table = header.dataset.sortCard!;
            if (next.sort) this.#tableSort[table] = { ...next.sort };
            else delete this.#tableSort[table];
            changes[table] = this.#tableSort[table] ?? null;
        }
        void game.user?.setFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.SORT_FLAG}.${this.actor.type}` as never, changes as never);
        this.#applyTableSort();
    }

    #sortCards(tabId: string): HTMLElement[] {
        return [...this.element.querySelectorAll<HTMLElement>(`section.tab[data-tab="${tabId}"] [data-sort-card]`)];
    }

    /** A tab's mode for its sort button: name A-Z / Z-A when every card is sorted so, else the sheet's order. */
    #listSortMode(tabId: string): typeof LIST_SORT_MODES[number] {
        const sorts = this.#sortCards(tabId).map(header => this.#tableSort[header.dataset.sortCard!]);
        return LIST_SORT_MODES.find(mode => mode.sort && sorts.length
            && sorts.every(sort => sort?.key === mode.sort.key && sort.dir === mode.sort.dir)) ?? LIST_SORT_MODES[0];
    }

    /** Icon and name of each tab's sort button after its mode. */
    #syncListSortButtons() {
        for (const button of this.element.querySelectorAll<HTMLElement>('.list-sort-button')) {
            const tabId = button.closest<HTMLElement>('[data-list-controls]')?.dataset.listControls;
            if (!tabId) continue;
            const mode = this.#listSortMode(tabId);
            const label = game.i18n.localize(mode.label);
            button.setAttribute('aria-label', `${game.i18n.localize('SR5.Redesign.ListSort.Label')}: ${label}`);
            button.dataset.tooltip = label;
            button.querySelector('i')!.className = `fas ${mode.icon}`;
        }
    }

    /**
     * Order the rows of every card table by its sort state and mark the sorted column (like #applySkillSort). The
     * order the sheet rendered is kept on the rows, so the card can go back to it; ties keep it too.
     */
    #applyTableSort(roots: HTMLElement[] = [this.element]) {
        for (const header of roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('[data-sort-card]')])) {
            const sort = this.#tableSort[header.dataset.sortCard!];
            for (const button of header.querySelectorAll<HTMLElement>('.sort-button[data-sort]')) {
                const active = button.dataset.sort === sort?.key;
                button.parentElement?.setAttribute('aria-sort', active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none');
                button.classList.toggle('sorted', active);
                button.setAttribute('aria-pressed', String(active));
            }
            const rows = cardRows(header);
            rows.forEach((row, index) => { row.dataset.sortDefault ??= String(index); });
            if (rows.length < 2) continue;
            const byDefault = (a: HTMLElement, b: HTMLElement) => Number(a.dataset.sortDefault) - Number(b.dataset.sortDefault);
            const values = new Map(rows.map(row => [row, sort ? sortValue(sortCell(row, sort.key), sort.key) : null]));
            const sorted = [...rows].sort((a, b) => {
                if (!sort) return byDefault(a, b);
                const left = values.get(a)!;
                const right = values.get(b)!;
                if (!left || !right) return (left ? -1 : right ? 1 : 0) || byDefault(a, b);
                const result = compareSortValues(left, right);
                return (sort.dir === 'asc' ? result : -result) || byDefault(a, b);
            });
            if (sorted.every((row, i) => row === rows[i])) continue;
            const anchorNode = rows[rows.length - 1].nextSibling;
            for (const row of sorted) row.parentElement?.insertBefore(row, anchorNode);
        }
        this.#syncListSortButtons();
    }

    /**
     * The book page of every row in its expanded properties, the same link everywhere: an icon by the source's kind
     * and 'SR5 132'. The rows' own source buttons sit in their icon columns, which play mode hides for skills, spells
     * and complex forms (and upstream shows spells' only in edit mode, where the button itself is not drawn).
     */
    #addSourceLinks(roots: HTMLElement[] = [this.element]) {
        for (const row of roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('.list-item-container > .list-item[data-source]')])) {
            const source = row.dataset.source;
            const desc = row.parentElement!.querySelector<HTMLElement>(':scope > .list-item-desc');
            if (!source || !desc) continue;
            // skill groups and echoes expand to their description only: the link gets a properties line of its own
            let properties = desc.querySelector<HTMLElement>(':scope > .list-item-properties');
            if (!properties) {
                properties = document.createElement('div');
                properties.className = 'list-item-properties';
                desc.prepend(properties);
            }
            // once per row: #arrangeProperties moves it into a line, where a later partial render finds it too
            if (properties.querySelector('.source-link')) continue;
            const link = document.createElement('a');
            link.className = 'source-link';
            link.dataset.action = 'openSource';
            link.dataset.source = source;
            link.dataset.tooltip = 'SR5.OpenSource';
            const icon = document.createElement('i');
            icon.className = `fas ${LinksHelpers.sourceIcon(source)}`;
            icon.setAttribute('aria-hidden', 'true');
            link.append(icon, ` ${LinksHelpers.sourceLabel(source)}`);
            // last of the item's own properties: before a device's matrix monitor, which takes a line of its own
            properties.insertBefore(link, properties.querySelector(':scope > .condition-monitor-container'));
        }
    }

    /**
     * Every expanded row's properties in one line, the same order whatever the item type: what it is (kind), its
     * numbers (stats), how it is used (action time, duration, the roll), the source link on the right; a device's
     * matrix monitor on a line of its own under it. The templates mark each property (data-prop); unmarked ones
     * count as stats. Properties the row's columns show are left out (as dnd5e's expanded rows), so the line wraps
     * only in narrow cards; when that would leave the source link alone, they stay.
     */
    #arrangeProperties(roots: HTMLElement[] = [this.element]) {
        const rank = (el: Element) => el.matches('[data-prop="kind"]') ? 0 : el.matches('[data-prop="time"]') ? 2
            : el.matches('[data-prop="roll"]') ? 3 : el.matches('.source-link') ? 4 : 1;
        for (const properties of roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('.list-item-desc > .list-item-properties:not(.arranged)')])) {
            // what the row's own columns show already (spell type / range / duration / drain, ratings, essence, armor,
            // contacts' L / C, loaded rounds...; the action type where the table has a Type column) is left out
            const repeats = (el: Element) => el.matches('.prop-dup, .prop-ammo-count')
                || (el.matches('.prop-action-type') && !!el.closest('section.tab:is([data-tab="actions"], [data-tab="matrixActions"])'));
            // ...unless that leaves the line with the source link alone (an adept power: type, level and PP are all
            // columns): then the row's values come again rather than an empty band beside the link
            const all = [...properties.children];
            const own = all.filter(el => !repeats(el));
            const lonely = own.some(el => el.matches('.source-link')) && !own.some(el => !el.matches('.source-link, .condition-monitor-container'));
            const children = lonely ? all : own;
            for (const el of all) if (!children.includes(el)) el.remove();
            const state = children.filter(el => el.matches('.condition-monitor-container'));
            const main = children.filter(el => !state.includes(el))
                // stable: the template order stays within a rank
                .map((el, i) => [el, i] as const).sort((a, b) => rank(a[0]) - rank(b[0]) || a[1] - b[1]).map(([el]) => el);
            // the source link stays top right: with nothing else in the first line (armor, most gear) it goes on the
            // matrix monitor's line, on its right
            if (state.length && main.length && main.every(el => el.matches('.source-link'))) state.push(...main.splice(0));
            const lines = [main, state].filter(list => list.length).map(list => {
                const line = document.createElement('div');
                line.className = `prop-line ${list === state ? 'prop-line-state' : 'prop-line-main'}`;
                if (list === state) {
                    line.append(...list);
                    return line;
                }
                // the properties wrap among themselves, the source link keeps the top right corner
                const source = list.filter(el => el.matches('.source-link'));
                const props = list.filter(el => !source.includes(el));
                if (props.length) {
                    const chips = document.createElement('div');
                    chips.className = 'prop-chips';
                    chips.append(...props);
                    line.append(chips);
                }
                line.append(...source);
                return line;
            });
            properties.replaceChildren(...lines);
            properties.classList.add('arranged');
        }
    }

    /** The base sheet re-sorts active skills alphabetically while filtering; restore our order after it does. */
    #watchSkillFilter() {
        this.#sortObserver?.disconnect();
        const list = this.element.querySelector('#active-skills-scroll');
        if (!list) return;
        this.#sortObserver = new MutationObserver(() => this.#applySkillSort());
        this.#sortObserver.observe(list, { childList: true });
    }

    /**
     * Tables from the regular SR5 templates use generic `.list-item-col` cells for both text and numbers.
     * Mark a column `sr-num` (right-aligned, tabular digits) when every row of its table shows a number or a dash
     * in it; the header cell at the same position gets the class too, so it sits over its numbers.
     */
    #alignNumericColumns(roots: HTMLElement[] = [this.element]) {
        const numeric = /^([-+−]?\d[\d.,]*(\s*\/\s*\d[\d.,]*)?|[-–—]|)$/;
        for (const header of roots.flatMap(root => [...root.querySelectorAll<HTMLElement>('section.tab:not(.sr-details) .list-item.list-item-header')])) {
            const table = header.parentElement;
            if (!table) continue;
            const rows = Array.from(table.querySelectorAll<HTMLElement>(':scope > .list-item-container > .list-item, :scope > .list-item:not(.list-item-header)'));
            if (!rows.length) continue;
            const headerCols = Array.from(header.querySelectorAll<HTMLElement>(':scope > .list-item-col'));
            headerCols.forEach((headerCol, index) => {
                let numbers = 0;
                const allNumeric = rows.every(row => {
                    const cell = row.querySelectorAll<HTMLElement>(':scope > .list-item-col')[index];
                    if (!cell) return false;
                    if (cell.querySelector('input[type="number"]')) { numbers++; return true; }
                    const text = (cell.textContent ?? '').trim();
                    if (/\d/.test(text)) numbers++;
                    return numeric.test(text);
                });
                if (!allNumeric || !numbers) return;
                headerCol.classList.add('sr-num');
                for (const row of rows) row.querySelectorAll<HTMLElement>(':scope > .list-item-col')[index]?.classList.add('sr-num');
            });
        }
    }

    /**
     * One logic for every card table: a row is the name, its value lanes and the icons lane (reserved, the same
     * width in every row: --tbl-icons). Lanes count from the icons leftwards, and cards stacked in one container give
     * lane k the width of their widest lane k, so a column sits in the same place in every card of the stack
     * whatever columns a card has (Ammo in 88px and Armor in 56px stood 16px apart); lanes never grow or shrink,
     * the name takes the rest. Exceptions: the magic tab's
     * cards fill four shared lanes from the left (a grid, left alone here), header notes (`.lane-note`, the
     * initiation grade on the metamagic card) are no lane. notes/audits/table-alignment.js checks the result.
     */
    #alignTableLanes(roots: HTMLElement[]) {
        const lanes = (row: Element) => [...row.children]
            .filter((cell): cell is HTMLElement => cell instanceof HTMLElement && cell.matches('.list-item-col:not(.lane-note)') && getComputedStyle(cell).display !== 'none')
            .reverse();
        const stacks = new Set<Element>();
        for (const root of roots) {
            for (const header of root.querySelectorAll(':scope .card > .list-item-header')) {
                const stack = header.parentElement?.parentElement;
                if (stack) stacks.add(stack);
            }
            const own = root.closest('.card')?.parentElement; // a part inside a card (the matrix tab's lists)
            if (own) stacks.add(own);
        }
        for (const stack of stacks) {
            const cards = [...stack.children].filter(card => card.matches('.card') && card.querySelector(':scope > .list-item-header'));
            if (!cards.length) continue;
            const headers = cards.map(card => card.querySelector<HTMLElement>(':scope > .list-item-header')!);
            if (headers.some(header => getComputedStyle(header).display === 'grid')) continue;
            const widths: number[] = [];
            for (const header of headers) {
                lanes(header).forEach((lane, k) => { widths[k] = Math.max(widths[k] ?? 0, Number.parseFloat(getComputedStyle(lane).flexBasis) || 0); });
            }
            for (const card of cards) {
                for (const row of card.querySelectorAll(':scope > .list-item, :scope > .list-item-container > .list-item')) {
                    // fixed: a lane neither grows nor shrinks (the upstream filler cell of the ammo card grew), the name does
                    lanes(row).forEach((lane, k) => { if (widths[k]) lane.style.flex = `0 0 ${widths[k]}px`; });
                }
            }
        }
    }

    /**
     * Foundry centres windows on half pixels (e.g. left: 72.5px). On 1x screens that puts every glyph and 1px line
     * of the sheet between device pixels, which renders blurry. Keep the window on whole pixels.
     */
    protected override _updatePosition(position: Parameters<SR5CharacterSheet['_updatePosition']>[0]) {
        const updated = super._updatePosition(position);
        // Small screens (Foundry's minimum is 1024 x 768): the default 900px height is clipped to the window and the
        // sheet touches its top and bottom edges. Keep a margin there instead, down to the sheet's min-height.
        const viewport = document.documentElement.clientHeight;
        const margin = SR5RedesignActorSheet.SCREEN_MARGIN;
        if (typeof updated.height === 'number' && updated.height + 2 * margin > viewport) {
            // read once: this runs on every frame of a drag or resize
            this.#minHeight ??= parseInt(getComputedStyle(this.element).minHeight) || 0;
            const minHeight = this.#minHeight;
            updated.height = Math.max(minHeight, viewport - 2 * margin);
            if (typeof updated.top === 'number') updated.top = Math.max(0, Math.min(Math.max(updated.top, margin), viewport - updated.height - margin));
        }
        // the tab rail hangs outside the window on the right: keep it on screen too (Foundry only clamps the window)
        if (typeof updated.left === 'number' && typeof updated.width === 'number') {
            const maxLeft = document.documentElement.clientWidth - updated.width - SR5RedesignActorSheet.RAIL_WIDTH;
            updated.left = Math.max(0, Math.min(updated.left, maxLeft));
        }
        for (const key of ['left', 'top', 'width', 'height'] as const) {
            if (typeof updated[key] === 'number') updated[key] = Math.round(updated[key]);
        }
        return updated;
    }

    // ---------- window size: each user's sheets of an actor type open at the size they last left one at (as dnd5e) ----------

    /** User flag holding the last size per actor type: {character: {width, height}}. */
    static readonly SIZE_FLAG = 'redesignSheetSize';

    static #savedSize(type: string | undefined): { width: number, height: number } | null {
        if (!type) return null;
        const size = game.user?.getFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.SIZE_FLAG}.${type}` as never) as { width?: unknown, height?: unknown } | undefined;
        return typeof size?.width === 'number' && typeof size?.height === 'number' ? { width: size.width, height: size.height } : null;
    }

    /**
     * Remember the size a user drags the window to (its resize handle). Only such a resize counts: Foundry and
     * _updatePosition also shrink the window to fit a small screen, and that size should not follow to a larger one.
     */
    #rememberResize() {
        const handle = this.element.querySelector<HTMLElement>('.window-resize-handle');
        handle?.addEventListener('pointerdown', () => {
            window.addEventListener('pointerup', () => {
                const { width, height } = this.position;
                if (this.minimized || typeof width !== 'number' || typeof height !== 'number') return;
                const type = this.actor.type;
                const saved = SR5RedesignActorSheet.#savedSize(type);
                if (saved?.width === width && saved?.height === height) return;
                void game.user?.setFlag(SYSTEM_NAME, `${SR5RedesignActorSheet.SIZE_FLAG}.${type}` as never, { width, height } as never);
            }, { once: true });
        });
    }

    /** Space kept above and below the sheet when it is as tall as the screen. */
    static readonly SCREEN_MARGIN = 12;
    /** Width of the tab rail outside the window's right edge (nav.tabs.sr-rail: 45px + 1px frame, + 1px air). */
    static readonly RAIL_WIDTH = 47;
    #minHeight: number | undefined;

    override changeTab(...args: Parameters<SR5CharacterSheet['changeTab']>) {
        // a tab this sheet does not have (a vehicle asked for the magic tab): nothing to show, nothing to draw
        const [tab, group] = args;
        if (group === 'primary' && !(this.constructor as typeof SR5RedesignActorSheet).TABS.primary.tabs.some(entry => entry.id === tab)) return;
        super.changeTab(...args);
        this.#renderShownStale(); // any group: the matrix tab's icon lists are a tab group of their own
        if (args[1] !== 'primary') return;
        this.#applySidebarState();
        this.#markActiveTab();
    }

    /**
     * The attribute row shows on the skills tab only (actor-redesign.scss). A class on the window says which tab is
     * open: a :has() on the window that looked for the active section restyled the whole window, and more, on every
     * class change inside it (5 ms a tab switch on a full character, growing with the chat log).
     */
    #markActiveTab() {
        this.element.classList.toggle('sr-skills-tab', this.tabGroups.primary === 'skills');
    }

    /** When the sidebar was last drawn: the scroll position Foundry restores right after is not the user scrolling. */
    #sidebarDrawnAt = -Infinity;

    /** Timer that ends the sidebar's slide (`sidebar-animating`). */
    #sidebarAnimation?: number;

    /** The left sidebar can be collapsed per tab, remembered per user. */
    get #sidebarFlagKey() {
        return `sr5Redesign.collapseSidebar.${this.tabGroups.primary ?? 'skills'}`;
    }

    /** User flags are typed to a fixed key list; this sheet stores its own per-tab preference. */
    get #userFlags() {
        return game.user as unknown as {
            getFlag(scope: string, key: string): unknown;
            setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
        } | null;
    }

    #applySidebarState(collapsed = !!this.#userFlags?.getFlag(SYSTEM_NAME, this.#sidebarFlagKey)) {
        this.element.classList.toggle('sidebar-collapsed', collapsed);
        const button = this.element.querySelector<HTMLElement>('.sidebar-collapser');
        if (!button) return;
        const label = game.i18n.localize(collapsed ? 'JOURNAL.ViewExpand' : 'JOURNAL.ViewCollapse');
        button.setAttribute('aria-label', label);
        button.setAttribute('aria-expanded', String(!collapsed));
        button.querySelector('i')?.classList.replace(collapsed ? 'fa-caret-left' : 'fa-caret-right', collapsed ? 'fa-caret-right' : 'fa-caret-left');
    }

    // ---------- augmentations tab ----------

    static readonly IMPLANT_TYPES = ['cyberware', 'bioware'] as const;

    /** Inventory type of the augmentations tab's own lists (e.g. spare ware in storage). */
    static readonly IMPLANT_INVENTORY_TYPE = 'implants';

    #isImplantInventory(name: string) {
        return this.actor.system.inventories?.[name]?.type === SR5RedesignActorSheet.IMPLANT_INVENTORY_TYPE;
    }

    /** The augmentations tab's list; the default inventory's name stands for the installed implants. */
    #implantInventoryName() {
        const name = this.#implantInventory;
        return name && this.#isImplantInventory(name) ? name : this.actor.defaultInventory.name;
    }

    /** The augmentations tab's choices: the installed implants, then the implant lists A-Z. */
    #implantInventoryChoices() {
        const lists = Object.values(this.actor.system.inventories ?? {})
            .filter(inventory => inventory.type === SR5RedesignActorSheet.IMPLANT_INVENTORY_TYPE)
            .sort((a, b) => a.name.localeCompare(b.name));
        return [
            { name: this.actor.defaultInventory.name, label: game.i18n.localize('SR5.Redesign.ImplantsInstalled') },
            ...lists.map(inventory => ({ name: inventory.name, label: inventory.label || inventory.name })),
        ];
    }

    /** The inventory tab's choices: Carried, then its inventories (All included) A-Z. */
    #gearInventoryChoices() {
        const lists = Object.values(this.actor.system.inventories ?? {})
            .filter(inventory => inventory.type !== SR5RedesignActorSheet.IMPLANT_INVENTORY_TYPE)
            .sort((a, b) => a.name.localeCompare(b.name));
        return [this.actor.defaultInventory, ...lists]
            .map(inventory => ({ name: inventory.name, label: game.i18n.localize(inventory.label || inventory.name) }));
    }

    /**
     * Top-level implants by type in one list (attached ones are shown by their parent row), with the open state.
     * The installed list holds every implant that is in no implant list.
     */
    #implantSections(name: string) {
        const inventories = Object.values(this.actor.system.inventories ?? {});
        const listed = new Set(inventories
            .filter(inventory => inventory.type === SR5RedesignActorSheet.IMPLANT_INVENTORY_TYPE)
            .flatMap(inventory => inventory.itemIds));
        const inList = name === this.actor.defaultInventory.name
            ? (item: SR5Item) => !listed.has(item.id!)
            : (item: SR5Item) => !!this.actor.system.inventories?.[name]?.itemIds.includes(item.id!);
        return SR5RedesignActorSheet.IMPLANT_TYPES.map(type => ({
            type,
            label: `TYPES.Item.${type}`,
            isOpen: this._inventoryOpenClose[type] ?? true,
            items: this.actor.items
                .filter(item => item.type === type && inList(item)
                    && !this.actor.items.has((item.system as { parentId?: string | null }).parentId ?? ''))
                .sort((a, b) => a.name.localeCompare(b.name)),
        }));
    }

    /**
     * A favorite as the sidebar lists it. Skills (active, knowledge, language) are items too and can be favorites,
     * like the items of the other tabs; they roll as a skill test and show their kind instead of the item type.
     */
    #favoriteEntry(item: SR5Item, context: RedesignPartContext) {
        if (!item.isType('skill')) return { item, title: item.name, subtitle: game.i18n.localize(`TYPES.Item.${item.type}`) };
        const category = item.system.skill?.category ?? 'active';
        return {
            item,
            isSkill: true,
            title: context.skillLabels?.[item.id!] ?? item.name,
            subtitle: game.i18n.localize(`SR5.Redesign.FavoriteSkill.${category}`),
        };
    }

    /** User flag: the magic tab's view (SPELL_GROUPINGS), the same on every sheet of that user. */
    static readonly SPELL_GROUPING_FLAG = 'redesignSpellGrouping';

    #spellGrouping(): typeof SPELL_GROUPINGS[number] {
        const mode = game.user?.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.SPELL_GROUPING_FLAG as never) as string | undefined;
        return SPELL_GROUPINGS.find(grouping => grouping.mode === mode) ?? SPELL_GROUPINGS[0];
    }

    static async #cycleSpellGrouping(this: SR5RedesignActorSheet) {
        const next = SPELL_GROUPINGS[(SPELL_GROUPINGS.indexOf(this.#spellGrouping()) + 1) % SPELL_GROUPINGS.length];
        await game.user?.setFlag(SYSTEM_NAME, SR5RedesignActorSheet.SPELL_GROUPING_FLAG as never, next.mode as never);
        await this.render({ parts: ['magic'] });
    }

    /**
     * The spells in one table (the magic tab's one-list view): the category the cards would split by becomes a
     * column, first after the name. The rows are the system's spell rows (shared with its sheet), so the cell is
     * added here, before the lanes are measured.
     */
    #addSpellCategoryColumn() {
        const categories = SR5.spellCategories as Record<string, string>;
        for (const row of this.element.querySelectorAll<HTMLElement>('.sr-magic .items-section[data-type="spell_all"] .list-item[data-item-id]')) {
            if (row.querySelector(':scope > .spell-category-col')) continue;
            const category = (this.actor.items.get(row.dataset.itemId!)?.system as { category?: string } | undefined)?.category ?? '';
            const cell = document.createElement('div');
            cell.className = 'list-item-col spell-category-col';
            const label = document.createElement('label');
            label.textContent = categories[category] ? game.i18n.localize(categories[category]) : '–';
            cell.append(label);
            row.querySelector(':scope > .list-item-start')?.after(cell);
        }
    }

    /** The actor's own effects or any of its items' (what the Effects tab lists, nested items' on system 0.37 too). */
    #hasEffects() {
        return this.actor.effects.size > 0 || !allApplicableItemsEffects(this.actor).next().done;
    }

    /**
     * Active effects an item carries, its own and those of the items under it (allApplicableItemsEffects of an item:
     * its child items, or on system 0.37 the mods, ammo and ware nested in it).
     */
    static #effectCount(item: SR5Item): number {
        return item.effects.size + [...allApplicableItemsEffects(item)].length;
    }

    /**
     * Empty states. Play mode draws only the tables that have rows, and a tab with nothing in any of them shows one
     * empty state for the whole tab (redesign/empty-tab) when it is shown at all (Show Empty Categories, or a tab the
     * system keeps); edit mode draws every table, an empty one with its empty row (redesign/empty-row).
     */
    protected _isTabEmpty(partId: string, partContext: RedesignPartContext): boolean {
        if (!this.isPlayMode) return false;
        switch (partId) {
            case 'inventory': return !partContext.hasInventoryItems && !(partContext.containers as unknown[] | undefined)?.length;
            case 'augmentations': return !this.#hasImplants();
            case 'magic': return !this._hasMagicItems();
            case 'social': return !this.actor.hasItemOfType('sin', 'lifestyle', 'contact');
            case 'bio': return !this.actor.hasItemOfType('quality', 'metamagic', 'echo');
            case 'effects': return !this.#hasEffects();
            case 'critterPowers': return !this.actor.hasItemOfType('critter_power');
            default: return false;
        }
    }

    #hasImplants() {
        return this.actor.items.some(item => (SR5RedesignActorSheet.IMPLANT_TYPES as readonly string[]).includes(item.type));
    }

    override hideEmptyCategories() {
        const actor = this.actor as unknown as { getFlag(scope: string, key: string): unknown };
        return !actor.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.SHOW_EMPTY_FLAG);
    }

    protected override _prepareTabs(group: string) {
        const tabs = super._prepareTabs(group);
        // like the magic tab: hidden in play mode when there is nothing in it and empty categories are hidden
        if (group === 'primary' && this.isPlayMode && this.hideEmptyCategories()) {
            if (tabs.augmentations && !this.#hasImplants()) tabs.augmentations.hidden = true;
            // the system keeps these two; nothing to read in either, so they go like the other empty tabs
            if (tabs.effects && !this.#hasEffects()) tabs.effects.hidden = true;
            if (tabs.description && !this.actor.system.description?.value?.trim()) tabs.description.hidden = true;
        }
        return tabs;
    }

    // ---------- initiative row: mode menu with every mode's formula and the Blitz switch ----------

    /**
     * Initiative modes offered by the system (meatspace, astral, cold / hot sim) with an icon and the formula each one
     * would roll (InitiativeRules: every row of the menu shows its own pool, Blitz on the one in use).
     */
    #initiativeModes(context: RedesignPartContext): InitiativeModeData[] {
        const icons: Record<string, string> = { meatspace: 'fa-person-running', astral: 'fa-ghost', cold_sim: 'fa-laptop', hot_sim: 'fa-laptop-code' };
        // the prepared modes (meatspace, astral, matrix) and Blitz, which is all InitiativeRules reads of it
        const initiative = this.actor.system.initiative as unknown as Parameters<typeof InitiativeRules.formula>[0];
        const perception = context.initiativePerception as { options: { label: string, value: string }[], value: string } | undefined;
        return (perception?.options ?? []).map(option => {
            const active = option.value === perception?.value;
            return { value: option.value, label: option.label, icon: icons[option.value] ?? 'fa-question', formula: InitiativeRules.formula(initiative, option.value, active), active };
        });
    }

    static async #setInitiativeMode(this: SR5RedesignActorSheet, event: PointerEvent, target: HTMLElement) {
        const mode = target.dataset.mode as Parameters<SR5CharacterSheet['actor']['setInitiativeMode']>[0] | undefined;
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        if (mode) await this.actor.setInitiativeMode(mode);
    }

    static async #toggleSidebar(this: SR5RedesignActorSheet, event: PointerEvent) {
        // a mouse click should not leave the strip in its focus style; keyboard users keep the focus ring
        if (event.detail > 0 && event.target instanceof HTMLElement) event.target.closest('button')?.blur();
        const key = this.#sidebarFlagKey;
        const flags = this.#userFlags;
        const collapsed = !flags?.getFlag(SYSTEM_NAME, key);
        // the sidebar moves at once; the preference follows (a round trip to the server, noticeable on a remote host).
        // `sidebar-animating` turns the slide on for the change (actor-redesign.scss): the states themselves switch
        // without transitions, so a render in either state does not animate.
        window.clearTimeout(this.#sidebarAnimation);
        this.element.classList.add('sidebar-animating');
        this.#applySidebarState(collapsed);
        this.#sidebarAnimation = window.setTimeout(() => this.element.classList.remove('sidebar-animating'), 350);
        await flags?.setFlag(SYSTEM_NAME, key, collapsed);
    }

    /**
     * What a render replaced: the whole window on the first one (its frame too), otherwise the parts it redrew. The
     * markup patched before stays in the parts that were kept, so only the new ones need patching.
     */
    #renderedRoots(options: { isFirstRender?: boolean, parts?: string[] } | undefined): HTMLElement[] {
        if (!options || options.isFirstRender || !options.parts) return [this.element];
        const parts = this.parts as Record<string, HTMLElement | undefined>;
        return options.parts.map(id => parts[id]).filter((part): part is HTMLElement => !!part);
    }

    /** The rendered parts, each widened to its tab, without the ones inside another. */
    #patchRoots(options: { isFirstRender?: boolean, parts?: string[] } | undefined): HTMLElement[] {
        const roots = [...new Set(this.#renderedRoots(options).map(root => root.closest<HTMLElement>('section.tab') ?? root))];
        return roots.filter(root => !roots.some(other => other !== root && other.contains(root)));
    }

    // ---------- sheet art (EXPERIMENT): a background image tinted like the art on SR5 rulebook pages ----------

    /** Actor flag holding the image path; per actor, so every viewer of the sheet sees the same art. */
    static readonly SHEET_ART_FLAG = SheetArt.FLAG;
    /** Actor flag holding where the art is anchored, {x, y} in % (background-position), and its zoom (1 = cover). */
    static readonly SHEET_ART_POSITION_FLAG = SheetArt.POSITION_FLAG;
    /** Actor flag holding the archetype shown in the header (free text). */
    static readonly ARCHETYPE_FLAG = 'archetype';
    /**
     * Actor flag: show the tabs and tables that have nothing in them (play mode). The system's own field for it
     * (category_visibility.default) starts on and is stored on every actor, so it can't tell a choice from the default;
     * this sheet keeps its own, off until someone ticks it.
     */
    static readonly SHOW_EMPTY_FLAG = 'showEmptyCategories';

    /** The header art: shown, repositioned and zoomed, picked and cleared (RedesignSheetArt). */
    #art = new SheetArt(this);

    static #repositionSheetArt(this: SR5RedesignActorSheet) {
        this.#art.startReposition();
    }

    static async #saveSheetArtPosition(this: SR5RedesignActorSheet) {
        await this.#art.save();
    }

    static #cancelSheetArtPosition(this: SR5RedesignActorSheet) {
        this.#art.end();
    }

    protected override _getHeaderControls() {
        const controls = super._getHeaderControls();
        controls.push(
            { action: 'setSheetArt', icon: 'fas fa-image', label: 'SR5.Redesign.SheetArt.Set', ownership: 3 },
            {
                // Font Awesome Free (see the tabs above)
                action: 'clearSheetArt', icon: 'fas fa-trash', label: 'SR5.Redesign.SheetArt.Clear', ownership: 3,
                visible: () => !!this.#art.path,
            },
        );
        return controls;
    }

    static async #setSheetArt(this: SR5RedesignActorSheet) {
        await this.#art.pick();
    }

    static async #clearSheetArt(this: SR5RedesignActorSheet) {
        await this.#art.clear();
    }

    // ---------- matrix device: chosen from a dropdown on the matrix tab's device card ----------

    /** Icon of a device by its category (a device's own image is a picture, too busy at plaque size). */
    static readonly DEVICE_ICONS: Record<string, string> = {
        commlink: 'fa-mobile-screen',
        cyberdeck: 'fa-keyboard', // fa-laptop-code is the matrix tab's icon
        rcc: 'fa-gamepad',
        living_persona: 'fa-brain',
    };

    /** The character's devices to switch between (a technomancer's living persona is not one: it is no device). */
    #matrixDevices(): SR5Item<'device'>[] {
        return this.actor.items.filter(item => item.isType('device') && !item.isLivingPersona()) as SR5Item<'device'>[];
    }

    /**
     * The device plaque: the equipped device's name and icon, and the choices of its dropdown, each with its type and
     * rating, then 'no device' (a technomancer's living persona).
     */
    #matrixDeviceSwitch() {
        const device = this.actor.getMatrixDevice();
        const living = this.actor.isEmerged();
        const none = game.i18n.localize(living ? 'SR5.LivingPersona' : 'SR5.Redesign.MatrixDevice.None');
        const categoryLabel = (category: string) => game.i18n.localize(SR5.deviceCategories[category as keyof typeof SR5.deviceCategories] ?? 'SR5.ItemTypes.Device');
        const choices = this.#matrixDevices().map(item => ({
            id: item.id,
            label: `${item.name} — ${categoryLabel(item.system.category)}, ${game.i18n.localize('SR5.Redesign.MatrixDevice.RatingShort')} ${item.getRating()}`,
            selected: item.id === device?.id,
        }));
        if (choices.length) choices.push({ id: '', label: none, selected: !device });
        const category = device?.isType('device') ? device.system.category : living ? 'living_persona' : '';
        return {
            label: device?.name ?? none,
            icon: SR5RedesignActorSheet.DEVICE_ICONS[category] ?? 'fa-microchip',
            choices,
            // a deck among them: the attribute plates keep the room of their swap chips whichever device is equipped
            hasDeck: this.#matrixDevices().some(item => item.system.category === 'cyberdeck'),
        };
    }

    /**
     * Equip the chosen device and no other ('' equips none). A technomancer's living persona item goes with the
     * choice too: off with a device, on with none (labelled Living Persona). MatrixPrep takes the first equipped
     * device, so a persona item left on before the chosen commlink kept the persona.
     */
    async #switchMatrixDevice(id: string) {
        const personas = this.actor.items.filter(item => item.isLivingPersona()) as SR5Item<'device'>[];
        const changes = [...this.#matrixDevices().map(device => [device, device.id === id] as const), ...personas.map(device => [device, !id] as const)]
            .filter(([device, equip]) => device.isEquipped() !== equip)
            .map(([device, equip]) => ({ _id: device.id, system: { technology: { equipped: equip } } }));
        if (changes.length) await this.actor.updateEmbeddedDocuments('Item', changes as never);
    }

    // ---------- action tracker ----------

    /** Actor flag: the actions spent in the current Action Phase (ActionTracker). */
    static readonly ACTIONS_FLAG = ActionTracker.FLAG;
    /** Actor flag: Free Actions per Action Phase (ActionTracker). */
    static readonly FREE_ACTIONS_FLAG = ActionTracker.FREE_FLAG;
    static readonly MAX_FREE_ACTIONS = ActionTracker.MAX_FREE;

    /** The actor's flags of the sheet (the typed flag API knows the system's own keys only). */
    get #sheetFlags() {
        return this.actor as unknown as { getFlag(scope: string, key: string): unknown; setFlag(scope: string, key: string, value: unknown): Promise<unknown> };
    }

    /** The sidebar's action tracker (RedesignActionTracker). */
    #actions = new ActionTracker(this);

    /** A lozenge of the action tracker: a click spends one action of its kind, Shift + click gets one back. */
    static async #spendAction(this: SR5RedesignActorSheet, event: Event, target: HTMLElement) {
        await this.#actions.change(target, (event as MouseEvent).shiftKey ? -1 : 1);
    }

    /** Every action back (a new Action Phase out of combat, or a slip in combat). */
    static async #resetActions(this: SR5RedesignActorSheet) {
        await this.#actions.reset();
    }

    /** Edit mode: one Free Action more or less per Action Phase. */
    static async #changeFreeActions(this: SR5RedesignActorSheet, event: Event, target: HTMLElement) {
        await this.#actions.changeFree(Number(target.dataset.delta) || 0);
    }

    /** Combat redraws the sidebars of the open sheets of the actors involved (the tracker reads the combat). */
    static #watchCombat() {
        ActionTracker.watchCombat(actors => {
            for (const app of foundry.applications.instances.values()) {
                if (!(app instanceof SR5RedesignActorSheet) || !app.rendered) continue;
                if (actors && !actors.has(app.actor)) continue;
                void app.render({ parts: ['sidebar'] });
            }
        });
    }

    // ---------- sheet portrait: a picture for this sheet only, in place of the actor's portrait ----------

    /** Actor flag holding the image path; per actor, like the header art. The actor's own image (token, lists) stays. */
    static readonly SHEET_PORTRAIT_FLAG = 'sheetPortrait';

    get #sheetPortrait(): string {
        const actor = this.actor as unknown as { getFlag(scope: string, key: string): unknown };
        const path = actor.getFlag(SYSTEM_NAME, SR5RedesignActorSheet.SHEET_PORTRAIT_FLAG);
        return typeof path === 'string' ? path : '';
    }

    static async #setSheetPortrait(this: SR5RedesignActorSheet) {
        const FilePicker = foundry.applications.apps.FilePicker.implementation;
        const picker = new FilePicker({
            type: 'image',
            current: this.#sheetPortrait || this.actor.img || '',
            callback: (path: string) => {
                const actor = this.actor as unknown as { setFlag(scope: string, key: string, value: unknown): Promise<unknown> };
                void actor.setFlag(SYSTEM_NAME, SR5RedesignActorSheet.SHEET_PORTRAIT_FLAG, path);
            },
        });
        await picker.render({ force: true });
    }

    static async #clearSheetPortrait(this: SR5RedesignActorSheet) {
        const actor = this.actor as unknown as { unsetFlag(scope: string, key: string): Promise<unknown> };
        await actor.unsetFlag(SYSTEM_NAME, SR5RedesignActorSheet.SHEET_PORTRAIT_FLAG);
    }

    /**
     * The base sheet's text match, then the skill filter menu: options of one kind (training, attribute, group) are
     * alternatives, different kinds all have to match.
     */
    override _isSkillFiltered(...args: Parameters<SR5CharacterSheet['_isSkillFiltered']>) {
        if (!super._isSkillFiltered(...args)) return false;
        const skill = args[1] as PreparedSkill;
        const kinds = new Map<string, string[]>();
        for (const id of this.#activeSkillFilters()) {
            const [kind, value] = id.split(':');
            kinds.set(kind, [...(kinds.get(kind) ?? []), value]);
        }
        const group = skill.group || this.#skillGroupOf.get(String(skill.name ?? '').toLowerCase())
            || this.#skillGroupOf.get(String(skill.label ?? '').toLowerCase()) || '';
        const test: Record<string, (value: string) => boolean> = {
            training: value => value === 'trained' ? skill.value > 0 : skill.value === 0,
            attr: value => skill.attribute === value,
            group: value => group === value,
        };
        return [...kinds.entries()].every(([kind, values]) => values.some(value => test[kind]?.(value) ?? true));
    }

    /**
     * The general-actions pack, read once per session: the sidebar renders on every actor update, and each pack read
     * is a server round-trip. Dropped when a compendium changes.
     */
    static #packActions: Promise<SR5Item<'action'>[]> | null = null;
    static #packActionsHook = false;

    static async #generalPackActions(): Promise<SR5Item<'action'>[]> {
        if (!SR5RedesignActorSheet.#packActionsHook) {
            SR5RedesignActorSheet.#packActionsHook = true;
            Hooks.on('updateCompendium', () => { SR5RedesignActorSheet.#packActions = null; });
        }
        SR5RedesignActorSheet.#packActions ??= PackItemFlow.getPackActions(PackItemFlow.getGeneralActionsPackName());
        const read = SR5RedesignActorSheet.#packActions;
        // a failed read is not kept
        read.catch(() => { SR5RedesignActorSheet.#packActions = null; });
        return read;
    }

    /**
     * General actions from the system pack with their pools as they will be rolled: attributes + armor, plus the
     * modifiers each action's test applies by itself (Defense takes wounds, Soak does not...).
     */
    /** The quick rolls of this kind of actor: pack action name -> short label key (QUICK_ROLLS for a character). */
    protected _quickRolls(): Record<string, string> {
        return QUICK_ROLLS;
    }

    async _prepareQuickRolls(): Promise<QuickRollData[]> {
        const system = this.actor.system as PreparedSheetSystem;
        const actions = await SR5RedesignActorSheet.#generalPackActions();
        const rolls: QuickRollData[] = [];
        for (const [name, key] of Object.entries(this._quickRolls())) {
            // same rules as PackItemFlow.getActorSheetActions: drain for the awakened, fading for the emerged
            if (key === 'drain' && !this.actor.isAwakened()) continue;
            if (key === 'fade' && !this.actor.isEmerged()) continue;
            const item = actions.find(action => action.name === name);
            if (!item?.uuid) continue;
            const action: { attribute?: string, attribute2?: string, armor?: boolean, test?: string, modifiers?: string[] } = { ...item.system.action };
            // Drain and Fading take their attributes from the tradition / stream: as their tests set them up (the
            // system's registered test classes: imported, the module build would bundle copies of them)
            const tests = game.shadowrun5e.tests as { DrainTest: typeof DrainTest, FadeTest: typeof FadeTest };
            const test = key === 'drain' ? tests.DrainTest : key === 'fade' ? tests.FadeTest : null;
            if (test) Object.assign(action, test._getDefaultTestAction(), test._getDocumentTestAction(item, this.actor as never));
            const attributes = [action.attribute, action.attribute2].filter(Boolean) as string[];
            const base = attributes.reduce((sum: number, attribute: string) => sum + (system.attributes?.[attribute]?.value ?? 0), 0)
                + (action.armor ? system.armor?.rating?.value ?? 0 : 0);
            const baseLabel = [...attributes.map(attribute => game.i18n.localize(`SR5.Redesign.AttrShort.${attribute}`)),
                ...(action.armor ? [game.i18n.localize('SR5.Redesign.Tooltip.Armor')] : [])].join(' + ');
            const label = PackItemFlow.localizePackAction(item.name);
            // the pool its test opens the dialog with (Toughness, Combat Sense... included); fall back to the modifiers
            const testPool = await this._preparedPool(() => TestCreator.fromItem(item, this.actor, { showDialog: false, showMessage: false }));
            const pool = testPool
                ? RedesignPool.fromTest(testPool, base, baseLabel, attributes.length + (action.armor ? 1 : 0))
                : RedesignPool.rolled(base, this.actor.modifiers.totalsFor(ModifierFlow.actionModifierTypes(action)), baseLabel);
            rolls.push({
                uuid: item.uuid,
                name: label,
                short: game.i18n.localize(`SR5.Redesign.QuickRolls.${key}`),
                ...pool,
                tooltip: `${label}: ${pool.tooltip}`,
            });
        }
        return rolls;
    }

    /**
     * Pool of a test as its dialog opens: created like a roll, then prepared (documents, effects, modifiers) without a
     * dialog or message. Null when the test cannot be built.
     */
    protected async _preparedPool(create: () => Promise<SuccessTest | undefined>) {
        // no notifications for a test that is only looked at (a skill the driver cannot default warns on creation);
        // the roll itself warns when it is made
        const notifications = ui.notifications as { warn: (...args: unknown[]) => unknown } | undefined;
        const warn = notifications?.warn;
        if (notifications) notifications.warn = () => undefined;
        try {
            const test = await create();
            if (!test) return null;
            await test._prepareExecution();
            return test.data.pool as { value: number, changes: { name: string, value: number, enabled?: boolean }[] };
        } catch (error) {
            console.warn('Shadowrun 5e | SR5 Redesign could not prepare a test for its pool', error);
            return null;
        } finally {
            if (notifications && warn) notifications.warn = warn;
        }
    }

    /**
     * Ids of the skills whose test pool an effect of the actor changes (qualities like Catlike, ware like
     * Synthacardium). Matched with the system's own effect filter on the data a skill test is matched by, so only
     * those skills need a prepared test; the others are rating + attribute + modifiers.
     */
    #skillsWithPoolEffects(skills: PreparedSkill[]): Set<string> {
        const affected = new Set<string>();
        const targets = [...allApplicableDocumentEffects(this.actor, { applyTo: ['test_all'] }), ...allApplicableItemsEffects(this.actor, { applyTo: ['test_all'] })]
            .flatMap(effect => effect.system.targets.filter(target => target.applyTo === 'test_all'
                && effect.system.changes.some(change => change.target === target.id && /(^|\.)pool$/.test(change.key ?? ''))));
        if (!targets.length) return affected;
        for (const skill of skills) {
            if (!skill.id) continue;
            const attribute = this.actor.system.attributes?.[skill.attribute as keyof typeof this.actor.system.attributes] as { limit?: string } | undefined;
            // what SuccessTestEffectsFlow reads from a skill test (see SR5Actor.skillActionData)
            const test = {
                actor: this.actor, type: 'SkillTest', opposing: false, targets: [],
                data: { categories: [], action: { skill: SkillNamingFlow.nameToKey(skill.name) || skill.name, attribute: skill.attribute, attribute2: '', limit: { attribute: skill.limit || attribute?.limit || '' } } },
            } as unknown as SuccessTest;
            const flow = new SuccessTestEffectsFlow(test);
            if (targets.some(target => flow._evaluateTarget(target))) affected.add(skill.id);
        }
        return affected;
    }

    /**
     * Where each actor modifier of the Configuration tab comes from, for its tooltip: the value set on the sheet, then
     * every effect that changes it, valued the way effects are applied (SR5ActiveEffect.resolveDynamicChangeValue):
     * 'Base 1 · Toughness +1 = 2'. What the system adds while preparing data shows as 'Other'.
     */
    #modifierSources(): Record<string, string> {
        const actor = this.actor;
        const values = actor.system.modifiers as Record<string, number>;
        const base = ((actor._source.system as { modifiers?: Record<string, number> }).modifiers ?? {});
        // Foundry applies changes by priority; a change without one takes its mode's default
        const defaultPriority: Record<string, number> = { custom: 0, multiply: 10, add: 20, downgrade: 30, upgrade: 40, override: 50 };
        const changes: Record<string, { label: string, value: number, type: string, priority: number }[]> = {};
        const effects = [...allApplicableDocumentEffects(actor, { applyTo: ['actor'] }), ...allApplicableItemsEffects(actor, { applyTo: ['actor'] })];
        for (const effect of effects) {
            if (!effect.active) continue;
            for (const change of effect.changesForApplyTo('actor')) {
                const id = /^system\.modifiers\.([a-z_]+)$/.exec(change.key ?? '')?.[1];
                if (!id) continue;
                const resolved = { ...change } as ActiveEffect.ChangeData;
                SR5ActiveEffect.resolveDynamicChangeValue(effect.parent ?? actor, resolved, actor);
                const value = Number(resolved.value);
                const type = String(change.type ?? 'add');
                if (!Number.isFinite(value) || (type === 'add' && !value)) continue;
                (changes[id] ??= []).push({ label: effect.name, value, type, priority: Number(change.priority ?? defaultPriority[type] ?? 20) });
            }
        }
        const number = (value: number) => value < 0 ? `\u2212${Math.abs(value)}` : String(value);
        const sources: Record<string, string> = {};
        for (const [id, total] of Object.entries(values)) {
            if (!total || id === 'wound') continue;
            const own = Number(base[id]) || 0;
            const parts = own ? [`${game.i18n.localize('SR5.Base')} ${own}`] : [];
            let sum = own;
            for (const change of (changes[id] ?? []).sort((a, b) => a.priority - b.priority)) {
                const { label, value } = change;
                parts.push(`${label} ${RedesignPool.change(change.type, value)}`);
                switch (change.type) {
                    case 'add': sum += value; break;
                    case 'multiply': sum *= value; break;
                    case 'upgrade': sum = Math.max(sum, value); break;
                    case 'downgrade': sum = Math.min(sum, value); break;
                    default: sum = value;
                }
            }
            if (sum !== total) parts.push(`${game.i18n.localize('SR5.Redesign.ModifierOther')} ${RedesignPool.signed(total - sum)}`);
            sources[id] = `${parts.join(' \u00b7 ')} = ${number(total)}`;
        }
        return sources;
    }

    /**
     * Physical and stun tracks as cell lists with the wound modifier printed on every threshold cell, then overflow
     * once the physical track is full: a track like the others, without a roll or wound marks.
     */
    _prepareMonitors(context: RedesignPartContext) {
        const system = context.system as PreparedSheetSystem;
        const tolerance = context.woundTolerance;
        const monitors = (['stun', 'physical'] as const)
            .flatMap(id => {
                const track = system.track?.[id];
                return track && !track.disabled && track.max > 0 ? [{ id, track }] : [];
            })
            .map(({ id, track }) => {
                const painTolerance = track.pain_tolerance ?? 0;
                const cells = this._cells(track.value, track.max).map(cell => {
                    const boxes = cell.value - painTolerance;
                    if (tolerance > 0 && boxes > 0 && boxes % tolerance === 0) {
                        cell.wound = MonitorRules.woundModifier(MonitorRules.wounds(cell.value, tolerance, painTolerance));
                    }
                    return cell;
                });
                return {
                    id: id as string,
                    // a grunt's one track (SR5#378, the system turns stun off and keeps physical for overflow) is
                    // the book's Condition Monitor, not a physical track
                    label: game.i18n.localize(id === 'physical' && this.actor.isGrunt() ? 'SR5.Redesign.GruntMonitor'
                        : `SR5.Labels.ActorSheet.${id === 'physical' ? 'PhysicalTrack' : 'StunTrack'}`),
                    icon: id === 'physical' ? 'fa-heart-pulse' : 'fa-kit-medical',
                    rollable: true,
                    value: track.value,
                    max: track.max,
                    columns: SR5RedesignActorSheet._monitorColumns(track.max),
                    cells,
                };
            });
        const physical = system.track?.physical;
        const overflow = physical?.overflow;
        if (physical && overflow && monitors.some(monitor => monitor.id === 'physical') && overflow.max > 0 && physical.value >= physical.max) {
            monitors.push({
                id: 'overflow',
                label: game.i18n.localize('SR5.Overflow'),
                icon: 'fa-droplet',
                rollable: false,
                value: overflow.value,
                max: overflow.max,
                columns: SR5RedesignActorSheet._monitorColumns(overflow.max),
                cells: this._cells(overflow.value, overflow.max),
            });
        }
        return monitors;
    }

    /**
     * Boxes per row for a condition monitor: six, so every box is a 24 x 24 target at least (WCAG 2.5.8) and the wound
     * marks of a three-box tolerance end their rows, like the rulebook's track. Longer tracks wrap, the last row
     * stays short: 10 -> 6 + 4, 11 -> 6 + 5.
     */
    static _monitorColumns(max: number) {
        return Math.max(1, Math.min(max, 6));
    }

    _cells(value: number, max: number): MonitorCellData[] {
        return Array.from({ length: max }, (_, i) => ({ value: i + 1, filled: i + 1 <= value }));
    }
}
