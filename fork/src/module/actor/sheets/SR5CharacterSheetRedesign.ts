import { SR5Actor } from '@/module/actor/SR5Actor';
import { SYSTEM_NAME } from '@/module/constants';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { SR5RedesignActorSheet } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import type { RedesignPartContext } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import { VEHICLE_COLUMNS, clearVehicleMonitor, drivenVehicles, modifyVehicleMonitor, vehicleContextOptions, vehicleOf, vehicleOwnership, vehicleSections, watchVehicles } from '@/module/actor/sheets/redesign/RedesignVehicles';
import { OwnGroupTab, ownGroupOf, ownGroups, splitOwnGroups, vehicleRowKey } from '@/module/actor/sheets/redesign/RedesignOwnGroups';

import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

export { VEHICLE_CONTROL_ICONS } from '@/module/actor/sheets/redesign/RedesignListFilters';

const sheetTemplate = (path: string) => SheetFlow.templateBase(`actor/redesign/${path}`);

/** The vehicles tab's views (its grouping button): Vehicles / Drones, by Chummer category and drone size, one list. */
const VEHICLE_GROUPINGS = [
    { mode: 'type', label: 'SR5.Redesign.Vehicles.Grouping.Type', icon: 'fa-layer-group' },
    { mode: 'category', label: 'SR5.Redesign.Vehicles.Grouping.Category', icon: 'fa-layer-group' },
    { mode: 'none', label: 'SR5.Redesign.Vehicles.Grouping.None', icon: 'fa-list' },
] as const;

/** Parts or tabs with `entry` placed right after `after` (the render pipeline and the tab rail keep this order). */
function insertAfter<T>(entries: [string, T][], after: string, entry: [string, T]): [string, T][] {
    const index = entries.findIndex(([id]) => id === after);
    return [...entries.slice(0, index + 1), entry, ...entries.slice(index + 1)];
}

/**
 * The redesigned character sheet (registered under this name, so actors keep it). The machinery it shares with the
 * vehicle sheet is SR5RedesignActorSheet (actor/sheets/redesign/RedesignActorSheet); what only a character has comes
 * down here, a feature at a time: so far the Vehicles & Drones tab.
 */
export class SR5CharacterSheetRedesign extends SR5RedesignActorSheet {
    static override DEFAULT_OPTIONS = {
        ...SR5RedesignActorSheet.DEFAULT_OPTIONS,
        actions: {
            ...SR5RedesignActorSheet.DEFAULT_OPTIONS.actions,
            // the vehicles & drones tab
            createVehicle: SR5CharacterSheetRedesign.#createVehicle,
            unlinkVehicle: SR5CharacterSheetRedesign.#unlinkVehicle,
            deleteVehicle: SR5CharacterSheetRedesign.#deleteVehicle,
            cycleVehicleGrouping: SR5CharacterSheetRedesign.#cycleVehicleGrouping,
            modifyVehicleMonitor: SR5CharacterSheetRedesign.#modifyVehicleMonitor,
            clearVehicleMonitor: SR5CharacterSheetRedesign.#clearVehicleMonitor,
        },
    };

    static override TABS = {
        ...SR5RedesignActorSheet.TABS,
        primary: {
            ...SR5RedesignActorSheet.TABS.primary,
            tabs: insertAfter(SR5RedesignActorSheet.TABS.primary.tabs.map(tab => [tab.id, tab] as [string, typeof tab]), 'augmentations',
                ['vehicles', { id: 'vehicles', label: 'SR5.Redesign.Tabs.Vehicles', icon: 'fas fa-car-side', tooltip: 'SR5.Redesign.Tabs.Vehicles', cssClass: '' }])
                .map(([, tab]) => tab),
        },
    };

    static override PARTS = Object.fromEntries(insertAfter(Object.entries(SR5RedesignActorSheet.PARTS as Record<string, HandlebarsApplicationMixin.HandlebarsTemplatePart>), 'augmentations', [
        // the vehicles and drones the character drives (actors of their own, linked by their driver)
        'vehicles', {
            template: sheetTemplate('vehicles'),
            templates: [sheetTemplate('tab-title'), sheetTemplate('list-controls'), sheetTemplate('empty-row'), sheetTemplate('empty-tab'), sheetTemplate('own-group')],
            scrollable: [''],
        } as HandlebarsApplicationMixin.HandlebarsTemplatePart,
    ])) as typeof SR5RedesignActorSheet.PARTS;

    override async _preparePartContext(...[partId, context, options]: Parameters<SR5RedesignActorSheet['_preparePartContext']>) {
        const partContext = await super._preparePartContext(partId, context, options) as RedesignPartContext;
        if (partId === 'vehicles') {
            // edit mode always by type (its cards are where Add makes a vehicle or a drone)
            const grouping = this.isPlayMode ? this.#vehicleGrouping() : null;
            partContext.vehicleGrouping = grouping;
            const sections = vehicleSections(this.actor, grouping?.mode ?? 'type', this._inventoryOpenClose);
            partContext.vehicleColumns = SR5CharacterSheetRedesign.VEHICLE_COLUMNS;
            // Add makes a world actor: only for users allowed to create actors (players are not, by default)
            const canCreate = !!game.user?.can('ACTOR_CREATE');
            partContext.canCreateVehicles = canCreate;
            // the vehicles put in own groups go to those groups' cards (one list shows them all)
            if (grouping?.mode === 'none') partContext.vehicleSections = sections;
            else Object.assign(partContext, this.#vehicleOwnGroups(sections, canCreate));
            // the tab's view button (list-controls.hbs), as the other tabs with views
            if (grouping) partContext.listGrouping = { ...grouping, action: 'cycleVehicleGrouping', isDefault: grouping.mode === 'type' };
        }
        return partContext;
    }

    override async _onFirstRender(...args: Parameters<SR5RedesignActorSheet['_onFirstRender']>) {
        await super._onFirstRender(...args);
        SR5CharacterSheetRedesign.#watchVehicles();
        // vehicles tab: the rows' menu (right click, the ⋮ button RowMenu adds), as the item rows'; "Move to group"
        // after the book page (its entries' older field names, as vehicleContextOptions)
        const move = this._ownGroupMoveOption();
        const moveEntry = { label: move.label, icon: move.icon, condition: (target: HTMLElement) => move.visible(target),
            callback: async (target: HTMLElement) => move.onClick(null, target) };
        this._createContextMenu(() => vehicleContextOptions(async title => this._confirmDeletion(title)).toSpliced(2, 0, moveEntry), "[data-vehicle-uuid][data-context-menu='vehicle']", {
            hookName: 'getVehicleListContextOptions',
            jQuery: false,
            fixed: true,
        });
        // vehicles tab: a row drags as its actor (onto the canvas for a token, onto another sheet as a drop)
        this.element.addEventListener('dragstart', event => {
            const row = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-vehicle-uuid]') : null;
            if (!row || !event.dataTransfer) return;
            event.stopPropagation();
            event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'Actor', uuid: row.dataset.vehicleUuid }));
        });
    }

    /** The vehicles this sheet lists, as of its last render (#watchVehicles redraws the sheets a vehicle is on). */
    #listedVehicles = new Set<string>();

    protected override _isTabEmpty(partId: string, partContext: RedesignPartContext): boolean {
        if (partId === 'vehicles') return this.isPlayMode && !this.#listedVehicles.size;
        return super._isTabEmpty(partId, partContext);
    }

    protected override _prepareTabs(group: string) {
        const tabs = super._prepareTabs(group);
        // every render prepares the tabs (ApplicationV2#_prepareContext), before the parts
        if (group === 'primary') this.#listedVehicles = new Set(drivenVehicles(this.actor).map(vehicle => vehicle.uuid!));
        // like the magic tab: hidden in play mode when there is nothing in it and empty categories are hidden
        if (group === 'primary' && this.isPlayMode && this.hideEmptyCategories() && tabs.vehicles && !this.#listedVehicles.size) tabs.vehicles.hidden = true;
        return tabs;
    }

    // ---------- vehicles & drones tab ----------

    /** The table's stat columns (RedesignVehicles). */
    static readonly VEHICLE_COLUMNS = VEHICLE_COLUMNS;

    /** User flag: the vehicles tab's view (VEHICLE_GROUPINGS), the same on every sheet of that user. */
    static readonly VEHICLE_GROUPING_FLAG = 'redesignVehicleGrouping';

    #vehicleGrouping(): typeof VEHICLE_GROUPINGS[number] {
        const mode = game.user?.getFlag(SYSTEM_NAME, SR5CharacterSheetRedesign.VEHICLE_GROUPING_FLAG as never) as string | undefined;
        return VEHICLE_GROUPINGS.find(grouping => grouping.mode === mode) ?? VEHICLE_GROUPINGS[0];
    }

    static async #cycleVehicleGrouping(this: SR5CharacterSheetRedesign) {
        const next = VEHICLE_GROUPINGS[(VEHICLE_GROUPINGS.indexOf(this.#vehicleGrouping()) + 1) % VEHICLE_GROUPINGS.length];
        await game.user?.setFlag(SYSTEM_NAME, SR5CharacterSheetRedesign.VEHICLE_GROUPING_FLAG as never, next.mode as never);
        await this.render({ parts: ['vehicles'] });
    }

    /**
     * A vehicle dropped on the sheet (from the sidebar, a compendium's import or another sheet's row): this character
     * becomes its driver, the system's way to own it. Other actors keep the upstream drop (a contact).
     */
    override async _onDropActor(event: DragEvent, actor: SR5Actor) {
        if (actor?.type !== 'vehicle') return super._onDropActor(event, actor);
        const driven = (actor.system as { driver?: string }).driver === this.actor.uuid;
        const vehicle = await this.#linkVehicle(actor);
        if (!vehicle || driven) return null;
        // the tab may only now exist (it is hidden while there is nothing in it): drawn first, then shown
        await this.render({ parts: ['tabs', 'vehicles'] });
        if (this.element.querySelector('nav [data-group="primary"][data-tab="vehicles"]')) this.changeTab('vehicles', 'primary');
        return null;
    }

    /** A dropped vehicle driven by this character (_onDropActor): a compendium's imported first; the vehicle, or null. */
    async #linkVehicle(actor: SR5Actor): Promise<SR5Actor | null> {
        if (!this.isEditable) return null;
        // a compendium's vehicle comes in as a world actor first, next to the character
        let vehicle = actor;
        if (actor.pack) {
            if (!game.user?.can('ACTOR_CREATE')) { ui.notifications?.warn('SR5.Redesign.Vehicles.CreateNoPermission', { localize: true }); return null; }
            const data = game.actors!.fromCompendium(actor as Actor.Implementation);
            Object.assign(data, { folder: this.actor.folder?.id ?? null, ownership: vehicleOwnership(this.actor) });
            vehicle = await Actor.create(data) as unknown as SR5Actor;
            if (!vehicle) return null;
        }
        if (!vehicle.isOwner) { ui.notifications?.warn('SR5.Redesign.Vehicles.LinkNoPermission', { localize: true }); return null; }
        if ((vehicle.system as { driver?: string }).driver !== this.actor.uuid) await vehicle.addVehicleDriver(this.actor.uuid!);
        return vehicle;
    }

    // ---------- the vehicles tab's own groups (RedesignOwnGroups) ----------

    /**
     * The vehicles put in own groups taken out of the tab's cards, and those groups' cards (one table each, A-Z; under
     * a name what it is, as in one list, since a group may hold vehicles and drones).
     */
    #vehicleOwnGroups(sections: ReturnType<typeof vehicleSections>, canAdd: boolean) {
        const flags = this.actor as unknown as { getFlag(scope: string, key: string): unknown };
        const groups = ownGroups(flags, 'vehicles');
        const placed = ownGroupOf(flags);
        type Row = typeof sections[number]['rows'][number];
        const inGroups = new Map<string, Row[]>();
        const listed: [string, string, string][] = [];
        const vehicleSections = sections.map(section => {
            for (const row of section.rows) {
                const key = vehicleRowKey(row.uuid);
                if (key) listed.push([key, section.type, game.i18n.localize(section.label)]);
            }
            const split = splitOwnGroups(section.rows, row => vehicleRowKey(row.uuid), groups, placed);
            for (const [id, rows] of split.byGroup) inGroups.set(id, [...inGroups.get(id) ?? [], ...rows.map(row => ({ ...row, kind: row.looseKind }))]);
            return { ...section, rows: split.rest };
        });
        this._listOwnGroupRows('vehicles', listed);
        const ownGroupCards = this._ownGroupCards(groups, id => ({
            rows: (inGroups.get(id) ?? []).sort((a, b) => a.name.localeCompare(b.name)), rowPartial: 'vehicleRow',
        }), canAdd);
        return { vehicleSections, ownGroups: ownGroupCards };
    }

    protected override _ownGroupAccepts(tab: OwnGroupTab, documentName: string, type: string): boolean {
        if (tab === 'vehicles') return documentName === 'Actor' && type === 'vehicle';
        return super._ownGroupAccepts(tab, documentName, type);
    }

    /** A vehicle dropped on an own group: driven by this character as any drop (#linkVehicle); its actor id. */
    protected override async _dropOwnGroupRow(event: DragEvent, data: { type?: string, uuid?: string }): Promise<string | null> {
        if (data.type !== 'Actor') return super._dropOwnGroupRow(event, data);
        const actor = data.uuid ? await fromUuid(data.uuid) as SR5Actor | null : null;
        const vehicle = actor?.type === 'vehicle' ? await this.#linkVehicle(actor) : null;
        return vehicle?.id ?? null;
    }

    protected override _ownGroupAddChoices(tab: OwnGroupTab) {
        if (tab !== 'vehicles') return super._ownGroupAddChoices(tab);
        const i18n = (key: string) => game.i18n.localize(key);
        return [
            { value: 'vehicle', label: i18n('SR5.Vehicle.Vehicle'), card: i18n('SR5.Redesign.Vehicles.Vehicles') },
            { value: 'drone', label: i18n('SR5.Vehicle.Drone'), card: i18n('SR5.Redesign.Vehicles.Drones') },
        ];
    }

    /** An own group's Add on the vehicles tab: a new vehicle or drone (#newVehicle), in that group. */
    protected override async _createOwnGroupRow(tab: OwnGroupTab, choice: string, group: string) {
        if (tab !== 'vehicles') return super._createOwnGroupRow(tab, choice, group);
        const vehicle = await this.#newVehicle(choice === 'drone');
        if (vehicle?.id) await this._placeInOwnGroup(vehicle.id, group);
        await vehicle?.sheet?.render(true);
    }

    /** Edit mode, a card's Add: a new vehicle or drone actor, driven by this character, next to it in the sidebar. */
    static async #createVehicle(this: SR5CharacterSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const vehicle = await this.#newVehicle(target.dataset.drone === 'true');
        await vehicle?.sheet?.render(true);
    }

    /** A new vehicle or drone actor driven by this character, for users who may create actors. */
    async #newVehicle(isDrone: boolean): Promise<SR5Actor | undefined> {
        if (!game.user?.can('ACTOR_CREATE')) { ui.notifications?.warn('SR5.Redesign.Vehicles.CreateNoPermission', { localize: true }); return; }
        return await Actor.create({
            name: game.i18n.localize(isDrone ? 'SR5.Redesign.Vehicles.NewDrone' : 'SR5.Redesign.Vehicles.NewVehicle'),
            type: 'vehicle',
            folder: this.actor.folder?.id ?? null,
            ownership: vehicleOwnership(this.actor),
            system: { isDrone, driver: this.actor.uuid, ...(isDrone ? { category: 'small' } : {}) },
        } as Actor.CreateData) as SR5Actor | undefined;
    }

    /** A vehicle's monitor cell (its expanded row): that damage, or none when the filled last one is clicked. */
    static async #modifyVehicleMonitor(this: SR5CharacterSheetRedesign, event: PointerEvent, target: HTMLElement) {
        await modifyVehicleMonitor(target);
    }

    static async #clearVehicleMonitor(this: SR5CharacterSheetRedesign, event: PointerEvent, target: HTMLElement) {
        await clearVehicleMonitor(target);
    }

    /**
     * A vehicle created, changed or deleted redraws the vehicles tab and the tab bar of the open sheets it is on: the
     * ones that list it (it changed, left or was deleted) and its driver's (it came).
     */
    static #watchVehicles() {
        watchVehicles(vehicle => {
            const driver = (vehicle.system as { driver?: string }).driver;
            for (const app of foundry.applications.instances.values()) {
                if (!(app instanceof SR5CharacterSheetRedesign) || !app.rendered || !('vehicles' in (app.constructor as typeof SR5CharacterSheetRedesign).PARTS)) continue;
                const drives = !!driver && (driver === app.actor.uuid || driver === app.actor.id);
                if (drives || app.#listedVehicles.has(vehicle.uuid ?? '')) void app.render({ parts: ['tabs', 'vehicles'] });
            }
        });
    }

    /** Edit mode: the character stops driving it (the vehicle itself stays, without a driver). */
    static async #unlinkVehicle(this: SR5CharacterSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const vehicle = vehicleOf(target);
        if (vehicle?.isOwner) await vehicle.removeVehicleDriver();
    }

    /** Edit mode: deletes the vehicle actor, after the sheet's confirmation (like an item's delete). */
    static async #deleteVehicle(this: SR5CharacterSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const vehicle = vehicleOf(target);
        if (!vehicle?.isOwner || !(await this._confirmDeletion(`${game.i18n.localize('SR5.Redesign.Vehicles.DeleteTitle')}: ${vehicle.name}`))) return;
        await vehicle.delete();
    }
}
