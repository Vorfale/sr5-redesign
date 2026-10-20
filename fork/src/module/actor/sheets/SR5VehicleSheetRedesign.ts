import { SR5RedesignActorSheet } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import type { PreparedSheetSystem, RedesignPartContext } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import { VEHICLE_CONTROL_ICONS } from '@/module/actor/sheets/redesign/RedesignListFilters';
import { InitiativeRules } from '@/module/rules/InitiativeRules';
import { systemAction } from '@/module/actor/sheets/redesign/RedesignSystemActions';
import { SR5Actor } from '@/module/actor/SR5Actor';
import { SR5Item } from '@/module/item/SR5Item';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { SR5 } from '@/module/config';
import { SYSTEM_NAME } from '@/module/constants';
import { Helpers } from '@/module/helpers';
import { MatrixRules } from '@/module/rules/MatrixRules';
import { MonitorRules } from '@/module/rules/MonitorRules';
import { PackItemFlow } from '@/module/item/flows/PackItemFlow';
import { MatrixNetworkFlow } from '@/module/item/flows/MatrixNetworkFlow';
import { SkillRules } from '@/module/rules/SkillRules';
import { TestCreator } from '@/module/tests/TestCreator';
import { RedesignPool } from '@/module/actor/sheets/RedesignPool';
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

const sheetTemplate = (path: string) => SheetFlow.templateBase(`actor/redesign/${path}`);

/** The character sheet's parts a vehicle shows; the rest (magic, social, bio, ware, its own vehicles...) stay out. */
const VEHICLE_PART_IDS = new Set([
    'header', 'sidebar', 'abilities', 'tabs', 'skills', 'inventory',
    'matrix', 'matrixActions', 'networkIcons', 'markedIcons', 'ownedIcons', 'programs', 'complexForms', 'compilations', 'spritePowers',
    'actions', 'effects', 'description', 'misc', 'collapser', 'footer',
]);

/** General actions a vehicle rolls most (the pack filters the drone tests to vehicles, PackItemFlow). */
const VEHICLE_QUICK_ROLLS: Record<string, string> = {
    'Drone Pilot Vehicle': 'pilot',
    'Physical Defense': 'defense',
    'Physical Damage Resist': 'soak',
    'Drone Perception': 'dronePerception',
    'Drone Infiltration': 'droneInfiltration',
};

/** The stat plates over the Vehicle tab, in the book's order (SR5#199): the rolls each one makes, the pair it has. */
const VEHICLE_PLATES: { id: string; off?: string; roll?: 'pilot' | 'attribute'; attribute?: string; tooltip: string }[] = [
    { id: 'handling', off: 'off_road_handling', roll: 'pilot', tooltip: 'vehicle_stats.handling' },
    { id: 'speed', off: 'off_road_speed', roll: 'pilot', tooltip: 'vehicle_stats.speed' },
    { id: 'acceleration', off: 'off_road_acceleration', tooltip: 'vehicle_stats.acceleration' },
    { id: 'body', roll: 'attribute', attribute: 'body', tooltip: 'attributes.body' },
    { id: 'armor', tooltip: 'armor.rating' },
    { id: 'pilot', roll: 'attribute', attribute: 'pilot', tooltip: 'vehicle_stats.pilot' },
    { id: 'sensor', roll: 'attribute', attribute: 'sensor', tooltip: 'vehicle_stats.sensor' },
    { id: 'seats', tooltip: 'vehicle_stats.seats' },
];

/** Modification slot categories (Rigger 5.0 p.151), with a Font Awesome Free icon each. */
const MOD_CATEGORIES: { id: string; icon: string }[] = [
    { id: 'powertrain', icon: 'fa-gears' },
    { id: 'protection', icon: 'fa-shield' },
    { id: 'weapons', icon: 'fa-gun' },
    { id: 'body', icon: 'fa-truck' },
    { id: 'electromagnetic', icon: 'fa-bolt' },
    { id: 'cosmetic', icon: 'fa-image' },
];


const ENVIRONMENT_ICONS: Record<string, string> = { handling: 'fa-route', speed: 'fa-gauge-high' };

/** A vehicle's prepared system data. */
type VehicleSystem = SR5Actor<'vehicle'>['system'];
/** The vehicle sheet's context: the base sheet's plus the vehicle fields (_prepareContext) and the rigging group. */
type VehicleSheetContext = RedesignPartContext & { vehicle?: { driver?: SR5Actor; master?: unknown }; rigging?: { autopilot: boolean } };
/** The vehicle's system data of a context (the base context types it as a character's). */
const vehicleSystem = (context: { system?: unknown }) => context.system as VehicleSystem;
/** A stat as the plates and limits read it: an attribute, the armor rating or a vehicle stat. */
type PreparedStat = { value?: number; base?: number; hidden?: boolean; label?: string };
/** The system fields of the plates: the base of each stat, for the edit boxes. */
type PlateFields = {
    attributes?: { fields?: { body?: { fields?: { base?: unknown } } } };
    armor?: { fields?: { rating?: { fields?: { base?: unknown } } } };
    vehicle_stats?: { fields?: Record<string, { fields?: { base?: unknown } } | undefined> };
};

interface VehiclePlateData {
    id: string;
    short: string;
    /** the stat's name; in play the name of the road's stat ("Handling (Off Road)" while off the road) */
    label: string;
    activeLabel: string;
    /** play: the value and base of the road the vehicle is on; edit: the on-road stat (off-road bases: Configuration) */
    value: number;
    base: number;
    field: unknown;
    roll: string | null;
    tooltip: string;
}

/**
 * EXPERIMENTAL (lab/redesign-vehicle-sheet): the SR5 Redesign for vehicles and drones.
 *
 * The character sheet's frame, render pipeline, tables, filters, tooltips and accessibility, with the vehicle's
 * own content: stat plates (handling / speed / acceleration on and off the road, body, armor, pilot, sensor,
 * seats) with the vehicle test limits under them, a sidebar with both condition monitors, the control mode, the
 * chase environment, the road and the driver, a Vehicle tab with the skills and their pools, the modification
 * slots and the autosofts; inventory, matrix, actions, effects, description and configuration as the character's.
 * The vehicle logic is the upstream vehicle sheet's (SR5VehicleActorSheet).
 */
export class SR5VehicleSheetRedesign extends SR5RedesignActorSheet {
    /** The vehicle's own system data (this sheet is registered for vehicles only). */
    get #system(): VehicleSystem {
        return this.actor.system as VehicleSystem;
    }

    static override DEFAULT_OPTIONS = {
        ...SR5RedesignActorSheet.DEFAULT_OPTIONS,
        actions: {
            ...SR5RedesignActorSheet.DEFAULT_OPTIONS.actions,
            rollAttribute: SR5VehicleSheetRedesign.#rollVehicleAttribute,
            pickDriver: SR5VehicleSheetRedesign.#pickDriver,
            removeVehicleDriver: SR5VehicleSheetRedesign.#removeVehicleDriver,
            connectToDriver: SR5VehicleSheetRedesign.#connectToDriver,
            removeMaster: SR5VehicleSheetRedesign.#removeMaster,
            toggleChaseEnvironment: SR5VehicleSheetRedesign.#toggleChaseEnvironment,
            toggleOffRoad: SR5VehicleSheetRedesign.#toggleOffRoad,
            setEnvironment: SR5VehicleSheetRedesign.#setEnvironment,
            setRoad: SR5VehicleSheetRedesign.#setRoad,
            setControlMode: SR5VehicleSheetRedesign.#setControlMode,
            setPortraitMode: SR5VehicleSheetRedesign.#setPortraitMode,
            setDriver: SR5VehicleSheetRedesign.#setDriver,
            // the matrix track is the vehicle's own (track.matrix, what its rolls read); the upstream handler writes a
            // persona device's monitor
            modifyConditionMonitor: SR5VehicleSheetRedesign.#modifyConditionMonitor,
            clearConditionMonitor: SR5VehicleSheetRedesign.#clearConditionMonitor,
        },
    };

    static override TABS = {
        ...SR5RedesignActorSheet.TABS,
        primary: {
            initial: 'skills',
            tabs: [
                { id: 'skills', label: 'SR5.Tabs.Actor.Vehicle', icon: 'fas fa-gauge-high', tooltip: 'SR5.Tabs.Actor.Vehicle', cssClass: '' },
                { id: 'inventory', label: 'SR5.Tabs.Actor.Inventory', icon: 'fas fa-toolbox', tooltip: 'SR5.Tabs.Actor.Inventory', cssClass: '' },
                { id: 'matrix', label: 'SR5.Tabs.Actor.Matrix', icon: 'fas fa-laptop-code', tooltip: 'SR5.Tabs.Actor.Matrix', cssClass: '' },
                { id: 'actions', label: 'SR5.Tabs.Actor.Actions', icon: 'fas fa-hand-fist', tooltip: 'SR5.Tabs.Actor.Actions', cssClass: '' },
                { id: 'effects', label: 'SR5.Tabs.Actor.Effects', icon: 'fas fa-bolt-lightning', tooltip: 'SR5.Tabs.Actor.Effects', cssClass: '' },
                { id: 'description', label: 'SR5.Description', icon: 'fas fa-info', tooltip: 'SR5.Tooltips.Actor.Description', cssClass: '' },
                { id: 'misc', label: 'SR5.Redesign.Tabs.Misc', icon: 'fas fa-gear', tooltip: 'SR5.Redesign.Tabs.Misc', cssClass: '' },
            ],
        },
    };

    // the character's parts in the character's order (the render pipeline sorts by it), two with vehicle templates
    static override PARTS = Object.fromEntries(Object.entries(SR5RedesignActorSheet.PARTS as Record<string, HandlebarsApplicationMixin.HandlebarsTemplatePart>)
        .filter(([id]) => VEHICLE_PART_IDS.has(id))
        .map(([id, part]) => {
            if (id === 'abilities') return [id, { template: sheetTemplate('vehicle-stats') }];
            if (id === 'skills') return [id, { ...part, template: sheetTemplate('vehicle-details') }];
            return [id, part];
        })) as typeof SR5RedesignActorSheet.PARTS;

    /** As the upstream vehicle sheet: programs are handled (the matrix tab lists them), the rest is gear. */
    override getHandledItemTypes(): Item.ConfiguredSubType[] {
        return [...super.getHandledItemTypes(), 'program'];
    }

    override getInventoryItemTypes(): Item.ConfiguredSubType[] {
        return [...super.getInventoryItemTypes(), 'weapon', 'ammo', 'armor', 'bioware', 'container', 'cyberware', 'device', 'equipment', 'modification'];
    }

    /** As the upstream vehicle sheet: a vehicle has no attack or sleaze, so the actions using them stay out. */
    protected override async _getMatrixPackActions() {
        return (await PackItemFlow.getMatrixPackActions()).filter(action =>
            !MatrixRules.isIllegalAction(action.getAction()?.attribute as Shadowrun.ActorAttribute, action.getAction()?.attribute2 as Shadowrun.ActorAttribute, action.getAction()?.limit?.attribute as Shadowrun.ActorAttribute));
    }

    protected override _quickRolls() {
        return VEHICLE_QUICK_ROLLS;
    }

    /** An actor dropped on the sheet becomes the driver (the upstream vehicle sheet's drop); a vehicle cannot drive. */
    override async _onDropActor(event: DragEvent, actor: SR5Actor) {
        // a compendium actor cannot drive (its uuid would not resolve to an actor after a reload)
        if (!actor?.uuid || actor.type === 'vehicle' || actor.pack || !this.isEditable) return null;
        await this.actor.addVehicleDriver(actor.uuid);
        return null;
    }

    /** A device, host or grid dropped on the sheet puts the vehicle on that network (the upstream vehicle sheet's drop). */
    override async _onDropItem(event: DragEvent, item: SR5Item) {
        if (item.canBeMaster) {
            await this.actor.connectNetwork(item);
            return null;
        }
        return super._onDropItem(event, item);
    }

    override async _prepareContext(options: Parameters<SR5RedesignActorSheet['_prepareContext']>[0]) {
        const data = await super._prepareContext(options) as VehicleSheetContext;
        const system = vehicleSystem(data);
        data.isVehicle = true;
        data.isCharacter = false;
        // the upstream vehicle sheet's fields: the driver, the network master (PAN)
        data.vehicle = { driver: this.actor.getVehicleDriver(), master: this.actor.master || undefined };
        data.modifications = this.#equippedModifications();
        // the archetype line and the karma / nuyen / reputation ledgers are a character's; a vehicle says what it is
        // and what it costs (footer.hbs)
        data.archetype = '';
        data.footerLedgers = { karma: false, nuyen: false, reputation: false };
        // the sidebar picture: the portrait, or the token fitted whole (actor flag sheetPortraitMode, edit mode switch)
        const flags = this.actor as unknown as { getFlag(scope: string, key: string): unknown };
        data.tokenPortrait = flags.getFlag(SYSTEM_NAME, SR5VehicleSheetRedesign.PORTRAIT_MODE_FLAG) === 'token';
        // an unlinked token's sheet shows that token's image; a wildcard prototype ('drones/*.webp', random per
        // token) is no image, so the portrait instead
        const tokenSrc: string | null | undefined = this.actor.token?.texture?.src || this.actor.prototypeToken?.texture?.src;
        data.tokenImage = tokenSrc && !tokenSrc.includes('*') ? tokenSrc : this.actor.img;
        data.vehicleKind = this.#vehicleKind(system);
        // the plates: no character attributes, the vehicle's stats
        data.attributeGroups = [];
        data.vehiclePlates = this.#plates(data);
        data.attributeLimits = this.#limits(system);
        // the skill pools of the trained skills as their tests roll them: the driver's attributes and skills in manual,
        // remote and rigger control (RiggingRules), the control rig; rating + Pilot would be wrong for them
        if (!options?.parts || options.parts.includes('skills')) await this.#poolsFromTests(data, system);
        return data;
    }

    override async _preparePartContext(...[partId, context, options]: Parameters<SR5RedesignActorSheet['_preparePartContext']>) {
        const partContext = await super._preparePartContext(partId, context, options) as VehicleSheetContext;
        if (partId === 'sidebar') {
            partContext.rigging = this.#rigging(partContext);
            partContext.handlingPenalty = this.#handlingPenalty(partContext);
            // one initiative, no menu (setInitiativeMode is for characters and spirits): whose it is follows the control mode
            if (!partContext.initiativeModes?.length) {
                partContext.initiativeModes = [this.#vehicleInitiative(partContext)];
                partContext.initiativeMode = partContext.initiativeModes[0];
            }
        }
        if (partId === 'skills') {
            const modSlots = this.#modSlots(partContext);
            partContext.modSlots = modSlots;
            // the skills table lists the trained skills in play: none says so (skills.hbs)
            partContext.trainedSkillCount = Object.values(vehicleSystem(partContext).skills?.active ?? {}).filter(skill => skill.value > 0).length;
            const autosofts = this.#autosofts();
            partContext.autosofts = autosofts;
            // the autosofts card folds like the inventory's sections (toggleExpanded, its own key)
            partContext.openSections = { autosofts: this._inventoryOpenClose.autosofts ?? true };
            // play mode with nothing for the right column (no modifications, no autosofts): the skills take the width
            partContext.detailsSingleColumn = this.isPlayMode && !modSlots.anyUsed && !autosofts.length;
        }
        // the configuration tab: the full defense attribute is a character's (a vehicle defends with Pilot)
        if (partId === 'misc') {
            partContext.hasFullDefense = false;
            // the off-road bases of the paired stats (the plates edit the on-road ones)
            const fields = (partContext.systemFields as PlateFields | undefined)?.vehicle_stats?.fields ?? {};
            const source = (this.actor._source.system as { vehicle_stats?: Record<string, { base?: number } | undefined> }).vehicle_stats ?? {};
            partContext.offRoadStats = ['off_road_handling', 'off_road_speed', 'off_road_acceleration'].map(id => ({
                label: game.i18n.localize((SR5.vehicle.stats as Record<string, string>)[id]),
                field: fields[id]?.fields?.base,
                base: source[id]?.base ?? 0,
            }));
        }
        // the matrix tab's device plaque: a vehicle is its own device (its rating is its Pilot, SR5#269), no switch
        if (partId === 'matrix') partContext.matrixDeviceSwitch = {
            label: this.actor.name,
            icon: vehicleSystem(partContext).isDrone ? 'fa-robot' : 'fa-car-side',
            choices: [],
            hasDeck: false,
        };
        return partContext;
    }

    /**
     * Physical track with the damage marks (every third box is −1 on Handling tests, SR5#201) and the matrix track
     * (a vehicle is a device: bricked when it fills, SR5#228), both in the sidebar. Neither rolls: vehicles do not
     * heal, they are repaired.
     */
    override _prepareMonitors(context: RedesignPartContext) {
        const system = context.system as PreparedSheetSystem;
        const tolerance = context.woundTolerance as number;
        const monitors: ReturnType<SR5RedesignActorSheet['_prepareMonitors']> = [];
        const physical = system.track?.physical;
        if (physical && !physical.disabled && physical.max > 0) {
            // no pain tolerance: vehicles have no WoundsPrep, it is a character's quality
            const cells = this._cells(physical.value, physical.max).map(cell => {
                if (tolerance > 0 && cell.value > 0 && cell.value % tolerance === 0) cell.wound = MonitorRules.woundModifier(MonitorRules.wounds(cell.value, tolerance, 0));
                return cell;
            });
            monitors.push({
                id: 'physical', label: game.i18n.localize('SR5.Redesign.Vehicles.Damage'), icon: 'fa-car-burst', rollable: false,
                value: physical.value, max: physical.max, columns: SR5RedesignActorSheet._monitorColumns(physical.max), cells,
            });
        }
        const matrix = system.track?.matrix;
        if (matrix && !matrix.disabled && matrix.max > 0) {
            monitors.push({
                id: 'matrix', label: game.i18n.localize('SR5.Redesign.MatrixMonitor'), icon: 'fa-microchip', rollable: false,
                value: matrix.value, max: matrix.max, columns: SR5RedesignActorSheet._monitorColumns(matrix.max), cells: this._cells(matrix.value, matrix.max),
            });
        }
        return monitors;
    }

    /** What the vehicle is, for the header line: drone or vehicle, its size or Chummer category, its type. */
    #vehicleKind(system: VehicleSystem) {
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const sizes = SR5.vehicle.categories as Record<string, string>;
        const types = SR5.vehicle.types as Record<string, string>;
        const isDrone = !!system.isDrone;
        return {
            isDrone,
            kind: i18n(isDrone ? 'SR5.Vehicle.Drone' : 'SR5.Vehicle.Vehicle'),
            detail: isDrone ? i18n(sizes[system.category]) : (system.importFlags?.category || ''),
            type: i18n(types[system.vehicleType]),
        };
    }

    #plates(data: VehicleSheetContext): VehiclePlateData[] {
        const system = vehicleSystem(data);
        const fields = data.systemFields as PlateFields | undefined;
        const stats = system.vehicle_stats as Record<string, PreparedStat | undefined>;
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        // edit mode edits the on-road stats in the plates (the off-road bases are on the Configuration tab)
        const offRoad = !!system.isOffRoad && this.isPlayMode;
        const statField = (id: string) => fields?.vehicle_stats?.fields?.[id]?.fields?.base;
        return VEHICLE_PLATES.flatMap(plate => {
            const stat: PreparedStat | undefined = plate.id === 'body' ? system.attributes?.body : plate.id === 'armor' ? system.armor?.rating : stats[plate.id];
            if (!stat || stat.hidden) return [];
            const field = plate.id === 'body' ? fields?.attributes?.fields?.body?.fields?.base
                : plate.id === 'armor' ? fields?.armor?.fields?.rating?.fields?.base : statField(plate.id);
            const label = plate.id === 'body' ? i18n('SR5.AttrBody') : plate.id === 'armor' ? i18n('SR5.Armor.label') : i18n(stat.label);
            const offStat = plate.off ? stats[plate.off] : null;
            // as the character's plates: the value in play big, its base rating in the box under it
            const shown = offRoad && offStat ? offStat : stat;
            return [{
                id: plate.id,
                short: i18n(`SR5.Redesign.VehicleStatShort.${plate.id}`),
                label,
                activeLabel: offRoad && offStat ? i18n(offStat.label) : label,
                value: shown.value ?? 0,
                base: shown.base ?? 0,
                field,
                roll: plate.roll === 'pilot' ? plate.id : plate.roll === 'attribute' ? plate.attribute! : null,
                tooltip: plate.tooltip,
            }];
        });
    }

    /**
     * The limits under the plates: handling and speed (a vehicle test's limit is the one of the chase environment,
     * SR5#203; the card of each says whether it is the one in use), sensor (perception and targeting), then any other
     * limit with a value.
     */
    #limits(system: VehicleSystem) {
        const i18n = (key: string) => game.i18n.localize(key);
        const limits = (system.limits ?? {}) as Record<string, PreparedStat | undefined>;
        const vehicle = (['handling', 'speed', 'sensor'] as const)
            .flatMap(id => limits[id] ? [{ id, label: i18n(`SR5.Redesign.LimitLabel.${id}`), value: limits[id].value ?? 0 }] : []);
        const others = (['physical', 'social'] as const)
            .flatMap(id => {
                const limit = limits[id];
                return limit && !limit.hidden && (limit.value ?? 0) > 0 ? [{ id, label: i18n(`SR5.Redesign.LimitLabel.${id}`), value: limit.value ?? 0 }] : [];
            });
        return [...vehicle, ...others];
    }

    /** The control group of the sidebar: the control mode (a menu), the chase environment, the road, the driver. */
    #rigging(context: VehicleSheetContext) {
        const system = vehicleSystem(context);
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const modes = Object.entries(SR5.vehicle.control_modes as Record<string, string>).map(([value, label]) => ({
            value, label: i18n(label), icon: VEHICLE_CONTROL_ICONS[value] ?? 'fa-question', active: value === system.controlMode,
        }));
        const driver = context.vehicle?.driver;
        const environments = SR5.vehicle.environments as Record<string, string>;
        return {
            modes,
            mode: modes.find(mode => mode.active) ?? modes[0],
            environment: { value: system.environment, label: i18n(environments[system.environment]), icon: ENVIRONMENT_ICONS[system.environment] ?? 'fa-gauge-high' },
            offRoad: !!system.isOffRoad,
            // the sidebar's two segmented switches: the chase environment (SR5#203) and the road
            switches: [
                {
                    label: i18n('SR5.Vehicle.ChaseEnvironment'), hint: 'SR5.Redesign.Rigging.EnvironmentHint', action: 'setEnvironment',
                    options: (['speed', 'handling'] as const).map(value => ({ value, label: i18n(environments[value]), icon: ENVIRONMENT_ICONS[value], active: system.environment === value })),
                },
                {
                    label: i18n('SR5.Vehicle.IsOffRoad'), hint: 'SR5.Redesign.Rigging.RoadHint', action: 'setRoad',
                    options: [
                        { value: 'on', label: i18n('SR5.Vehicle.OnRoad'), icon: 'fa-road', active: !system.isOffRoad },
                        { value: 'off', label: i18n('SR5.Vehicle.OffRoad'), icon: 'fa-truck-monster', active: !!system.isOffRoad },
                    ],
                },
            ],
            road: { label: i18n(system.isOffRoad ? 'SR5.Vehicle.OffRoad' : 'SR5.Vehicle.OnRoad'), icon: system.isOffRoad ? 'fa-truck-monster' : 'fa-road' },
            driver: driver ? { name: driver.name, uuid: driver.uuid, img: driver.img } : null,
            // "jumped in": a rigger at the controls (SR5#265)
            jumpedIn: system.controlMode === 'rigger' && !!driver,
            // how the driver controls it, under their name: jumped in, by remote, at the wheel; on autopilot the Pilot drives
            driverRole: i18n(`SR5.Redesign.Rigging.DriverRole.${system.controlMode}`),
            autopilot: system.controlMode === 'autopilot' || !driver,
        };
    }

    /**
     * The initiative field: whose initiative the vehicle acts on (InitiativeRules.vehicleSource) with its formula, and a
     * tooltip that says why and, when it differs, what the combat tracker rolls (the system rolls the vehicle's own, b155).
     */
    #vehicleInitiative(context: VehicleSheetContext) {
        const system = vehicleSystem(context);
        const driver = context.vehicle?.driver;
        const source = InitiativeRules.vehicleSource(system.controlMode, !!driver && !context.rigging?.autopilot);
        const own = InitiativeRules.vehicleFormula('own', system.initiative, undefined);
        if (source === 'own') {
            const hint = game.i18n.localize(system.controlMode === 'autopilot' ? 'SR5.Redesign.Rigging.InitAutopilotHint' : 'SR5.Redesign.Rigging.InitNoDriverHint');
            return { value: 'meatspace', label: 'SR5.Vehicle.Stats.Pilot', icon: 'fa-robot', formula: own, active: true, hint };
        }
        const jumpedIn = source === 'rigger';
        const hint = [
            game.i18n.localize(jumpedIn ? 'SR5.Redesign.Rigging.InitRiggerHint' : 'SR5.Redesign.Rigging.InitDriverHint'),
            game.i18n.format('SR5.Redesign.Rigging.InitTrackerNote', { formula: own }),
        ].join(' ');
        return {
            value: 'meatspace',
            // "Driver", not the name: the driver field above already names them
            label: jumpedIn ? 'SR5.Redesign.Rigging.InitRiggerLabel' : 'SR5.Redesign.Rigging.InitDriverLabel',
            icon: VEHICLE_CONTROL_ICONS[system.controlMode] ?? 'fa-user',
            formula: InitiativeRules.vehicleFormula(source, system.initiative, (driver?.system as { initiative?: { current?: object, matrix?: object } } | undefined)?.initiative),
            active: true,
            hint,
        };
    }

    /** The damaged vehicle's handling penalty (SR5#201: −1 per wound threshold of boxes), for the sidebar's line. */
    #handlingPenalty(context: VehicleSheetContext): number {
        const system = vehicleSystem(context);
        const physical = system.track?.physical;
        const tolerance = context.woundTolerance as number;
        if (!physical || physical.disabled || !(tolerance > 0)) return 0;
        return Math.floor(Math.max(physical.value ?? 0, 0) / tolerance);
    }

    #equippedModifications(): SR5Item<'modification'>[] {
        return (this.actor.itemsForType.get('modification') as SR5Item<'modification'>[] | undefined)?.filter(item => item.isEquipped()) ?? [];
    }

    /**
     * Modification slots (Rigger 5.0 p.151: Body slots in each of six categories, plus the extra slots set on the
     * configuration tab) or a drone's mod points (R5 p.122: Body points in all): used by the equipped modifications.
     */
    #modSlots(context: VehicleSheetContext) {
        const system = vehicleSystem(context);
        const i18n = (key: string) => game.i18n.localize(key);
        const mods = this.#equippedModifications();
        const body = system.attributes?.body?.value ?? 0;
        const extra = (system.modificationCategories ?? {}) as unknown as Record<string, number>;
        const slotsOf = (items: SR5Item<'modification'>[]) => items.reduce((sum, item) => sum + (Number(item.system.slots) || 0) * (Number(item.system.technology?.quantity) || 1), 0);
        const isDrone = !!system.isDrone;
        const rows = isDrone
            ? [{ id: 'points', label: i18n('SR5.ModPoints'), icon: 'fa-microchip', used: slotsOf(mods), max: body, over: false }]
            : MOD_CATEGORIES.map(category => {
                const used = slotsOf(mods.filter(item => item.system.modification_category === category.id));
                const max = body + (Number(extra[category.id]) || 0);
                return { id: category.id, label: i18n((SR5.modificationCategories as Record<string, string>)[category.id] ?? `SR5.Vehicle.ModificationCategoryTypes.${category.id}`), icon: category.icon, used, max, over: used > max };
            });
        for (const row of rows) row.over = row.used > row.max;
        // each digit in a cell of its own (the widest digit's width), so the counts line up digit under digit:
        // Orbitron has no tabular figures and its 1 is half as wide as its 0
        const digits = (value: number) => [...String(value)];
        return {
            isDrone,
            rows: rows.map(row => ({ ...row, usedDigits: digits(row.used), maxDigits: digits(row.max) })),
            anyUsed: rows.some(row => row.used > 0),
            label: i18n(isDrone ? 'SR5.ModPoints' : 'SR5.Redesign.Rigging.ModSlots'),
        };
    }

    /** Autosofts: Chummer imports them as equipment (its "Autosofts" gear category), so they are told by that or their name. */
    #autosofts(): SR5Item[] {
        return this.actor.items
            .filter(item => item.type === 'equipment' && ((item.system as { importFlags?: { category?: string } }).importFlags?.category === 'Autosofts' || /autosoft/i.test(item.name)))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /** Pools of the trained skills from prepared tests (driver, control rig, matrix modifiers of a jumped-in rigger). */
    async #poolsFromTests(data: VehicleSheetContext, system: VehicleSystem) {
        // under a driver (manual, remote, rigger) the driver's skills roll: a skill the vehicle lacks has a pool too
        const driven = this.actor.isControlledByDriver();
        const skills = Object.values(system.skills?.active ?? {}).filter(skill => skill.id && (driven || skill.value > 0));
        const attributes = system.attributes as unknown as Record<string, { value: number } | undefined>;
        data.skillPools ??= {};
        for (const skill of skills) {
            const attribute = attributes[skill.attribute];
            const action = this.actor.skillActionData(skill.name || skill.label);
            if (!attribute || !action) continue;
            const attributeLabel = game.i18n.localize(`SR5.Redesign.AttrShort.${skill.attribute}`);
            const baseLabel = game.i18n.format('SR5.Redesign.PoolTooltip', { attribute: attributeLabel });
            const base = SkillRules.pool(skill, attribute.value);
            // the skill as the test sees it (the driver's in manual, remote and rigger control): one that cannot be
            // rolled (untrained, no defaulting) shows no pool, as the character sheet's rows do
            const rolled = this.actor.getSkill(skill.name || skill.label) ?? skill;
            if (!SkillRules.allowRoll(rolled)) { data.skillPools[skill.id] = { attribute: attributeLabel, ...RedesignPool.rolled(null, [], baseLabel) }; continue; }
            const testPool = await this._preparedPool(() => TestCreator.fromAction(action, this.actor, { showDialog: false, showMessage: false }));
            if (!testPool) continue;
            // the base as the test built it (the driver's rating and attribute under a driver): compared with the
            // vehicle's own it read as a loss and showed the pool red
            const testBase = testPool.changes.filter(change => change.enabled !== false && change.value).slice(0, 2).reduce((sum, change) => sum + change.value, 0);
            const ownBase = driven ? testBase : base;
            if (ownBase !== null) data.skillPools[skill.id] = { attribute: attributeLabel, ...RedesignPool.fromTest(testPool, ownBase, baseLabel, 2) };
        }
    }

    // ---------- actions ----------

    /** Handling and speed roll the vehicle's pilot skill with that limit (as upstream); the rest an attribute. */
    static async #rollVehicleAttribute(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        event.preventDefault();
        const attribute = target.closest<HTMLElement>('[data-attribute-id]')?.dataset.attributeId;
        if (!attribute) return;
        if (attribute === 'handling' || attribute === 'speed') await this.actor.rollVehiclePilotByLimit(attribute, { event });
        else await this.actor.rollAttribute(attribute, { event });
    }

    static async #pickDriver(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        const actor = Helpers.getControlledTokenActors().find(candidate => !!candidate && candidate.type !== 'vehicle');
        if (!actor?.uuid) { ui.notifications?.warn('SR5.Redesign.Rigging.NoControlledToken', { localize: true }); return; }
        await this.actor.addVehicleDriver(actor.uuid);
    }

    static async #removeVehicleDriver(this: SR5VehicleSheetRedesign) {
        await this.actor.removeVehicleDriver();
    }

    /** Puts the vehicle on the driver's PAN (the driver's matrix device as its master). */
    static async #connectToDriver(this: SR5VehicleSheetRedesign) {
        const driver = this.actor.getVehicleDriver();
        if (!driver) { ui.notifications?.error('SR5.Vehicle.MissingDriver', { localize: true }); return; }
        const device = driver.getMatrixDevice();
        if (!device) { ui.notifications?.error('SR5.Redesign.Rigging.DriverHasNoDevice', { localize: true }); return; }
        await device.addSlave(this.actor);
        void this.render({ parts: ['matrix', 'sidebar'] });
    }

    static async #removeMaster(this: SR5VehicleSheetRedesign) {
        await MatrixNetworkFlow.removeSlaveFromMaster(this.actor);
        void this.render({ parts: ['matrix', 'sidebar'] });
    }

    static async #toggleChaseEnvironment(this: SR5VehicleSheetRedesign) {
        const environment = this.#system.environment === 'handling' ? 'speed' : 'handling';
        await this.actor.update({ system: { environment } });
    }

    static async #toggleOffRoad(this: SR5VehicleSheetRedesign) {
        await this.actor.update({ system: { isOffRoad: !this.#system.isOffRoad } });
    }

    static async #setEnvironment(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const environment = target.dataset.value;
        if ((environment === 'speed' || environment === 'handling') && environment !== this.#system.environment) {
            await this.actor.update({ system: { environment } });
        }
    }

    static async #setRoad(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const isOffRoad = target.dataset.value === 'off';
        if (isOffRoad !== !!this.#system.isOffRoad) await this.actor.update({ system: { isOffRoad } });
    }

    override async _onRender(...args: Parameters<SR5RedesignActorSheet['_onRender']>) {
        await super._onRender(...args);
        this.#wireDriverMenu();
        SR5VehicleSheetRedesign.#watchDrivers();
    }

    /** The Vehicle tab (the skills part) shows the mod slots and the autosofts: modifications and equipment draw it too. */
    static override readonly ITEM_PARTS: Record<string, string[]> = {
        ...SR5RedesignActorSheet.ITEM_PARTS,
        modification: [...SR5RedesignActorSheet.ITEM_PARTS.modification, 'skills'],
        equipment: [...SR5RedesignActorSheet.ITEM_PARTS.equipment, 'skills'],
    };

    static #driversWatched = false;

    /**
     * The sidebar (the driver's name, portrait, initiative) and the skill pools (the driver's skills and attributes)
     * read the driver, another actor: a change to it, or its deletion, redraws the open sheets of the vehicles it drives.
     */
    static #watchDrivers() {
        if (SR5VehicleSheetRedesign.#driversWatched) return;
        SR5VehicleSheetRedesign.#driversWatched = true;
        const redraw = (actor: Actor) => {
            if (!actor || actor.type === 'vehicle') return;
            for (const app of foundry.applications.instances.values()) {
                if (!(app instanceof SR5VehicleSheetRedesign) || !app.rendered) continue;
                const driver = (app.actor.system as { driver?: string }).driver;
                if (driver && (driver === actor.uuid || driver === actor.id)) void app.render({ parts: ['sidebar', 'skills'] });
            }
        };
        for (const hook of ['updateActor', 'deleteActor']) (Hooks.on.bind(Hooks) as (hook: string, fn: (actor: Actor) => void) => number)(hook, redraw);
    }

    /** Most rows the driver list shows at once (the search narrows them); a world can hold hundreds of characters. */
    static readonly DRIVER_LIST_MAX = 40;

    /**
     * Who can drive this vehicle, best first: the player characters (for a player: their own), then every other
     * character the user can see, A-Z. Vehicles never drive; the controlled token has its own row above the list.
     */
    #driverCandidates(): { actor: SR5Actor; hint: string }[] {
        const user = game.user!;
        const current = (this.actor.system as { driver?: string }).driver;
        const seen = new Set<string>();
        const out: { actor: SR5Actor; hint: string }[] = [];
        const add = (actor: SR5Actor | null | undefined, hint: string) => {
            if (!actor?.uuid || actor.type === 'vehicle' || seen.has(actor.uuid) || actor.uuid === current || actor.id === current) return;
            seen.add(actor.uuid);
            out.push({ actor, hint });
        };
        const characters = (game.actors?.filter(actor => actor.type === 'character' && actor.testUserPermission(user, 'LIMITED')) ?? []) as SR5Actor[];
        characters.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
        const mine = (actor: SR5Actor) => user.isGM ? actor.hasPlayerOwner : actor.isOwner;
        for (const actor of characters) if (mine(actor)) add(actor, game.i18n.localize('SR5.Redesign.Rigging.PlayerCharacter'));
        for (const actor of characters) add(actor, actor.folder?.name ?? '');
        return out;
    }

    /**
     * The driver dropdown (no driver yet): placed under its field like the control mode's menu, the search focused on
     * opening; typing narrows the list (name, folder), arrow keys move between the search and the rows, Enter takes the
     * first match, Escape closes. The rows are built when it opens, never during a render.
     */
    #wireDriverMenu() {
        const menu = this.element.querySelector<HTMLElement>('.driver-menu');
        const bar = menu?.closest('.driver-bar')?.querySelector<HTMLElement>('.bar');
        if (!menu || !bar || menu.dataset.wired) return;
        menu.dataset.wired = 'true';
        const input = menu.querySelector<HTMLInputElement>('input[type="search"]')!;
        const list = menu.querySelector<HTMLElement>('.driver-options')!;
        let candidates: { actor: SR5Actor; hint: string }[] = [];
        const norm = (text: string) => text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase(game.i18n.lang);
        const fill = () => {
            const query = norm(input.value.trim());
            const matches = query ? candidates.filter(({ actor, hint }) => norm(`${actor.name} ${hint}`).includes(query)) : candidates;
            list.replaceChildren(...matches.slice(0, SR5VehicleSheetRedesign.DRIVER_LIST_MAX).map(({ actor, hint }) => {
                const option = document.createElement('button');
                option.type = 'button';
                option.className = 'init-option driver-option';
                option.setAttribute('role', 'option');
                option.tabIndex = -1;
                option.dataset.action = 'setDriver';
                option.dataset.uuid = actor.uuid!;
                const img = document.createElement('img');
                img.src = actor.img ?? '';
                img.alt = '';
                const label = document.createElement('span');
                label.className = 'mode';
                label.textContent = actor.name;
                const note = document.createElement('span');
                note.className = 'formula';
                note.textContent = hint;
                option.append(img, label, note);
                return option;
            }));
            if (!matches.length) {
                const empty = document.createElement('div');
                empty.className = 'driver-empty';
                empty.textContent = game.i18n.localize('SR5.Redesign.Rigging.NoDriverMatch');
                list.append(empty);
            }
        };
        const close = () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
        menu.addEventListener('beforetoggle', event => {
            if ((event as ToggleEvent).newState !== 'open') return;
            candidates = this.#driverCandidates();
            // the "selected token" row names the controlled character, or stays dimmed with none controlled
            const token = Helpers.getControlledTokenActors().find(candidate => !!candidate && candidate.type !== 'vehicle');
            const tokenRow = menu.querySelector<HTMLButtonElement>('.driver-token');
            if (tokenRow) {
                tokenRow.disabled = !token;
                tokenRow.querySelector('.formula')!.textContent = token?.name ?? game.i18n.localize('SR5.Redesign.Rigging.NoTokenSelected');
            }
            input.value = '';
            fill();
            // always under the field, as every dropdown here; the list scrolls in the room left down to the window's edge
            const rect = bar.getBoundingClientRect();
            Object.assign(menu.style, { left: `${Math.round(rect.left)}px`, top: `${Math.round(rect.bottom + 2)}px`, width: `${Math.round(Math.max(rect.width, 240))}px` });
            menu.style.setProperty('--driver-list-max', `${Math.max(120, Math.round(window.innerHeight - rect.bottom - 2 - 8 - 80))}px`);
        });
        menu.addEventListener('toggle', event => {
            if ((event as ToggleEvent).newState === 'open') input.focus();
        });
        input.addEventListener('input', fill);
        menu.addEventListener('keydown', event => {
            const options = [...menu.querySelectorAll<HTMLElement>('.driver-option:not(:disabled)')];
            const index = options.indexOf(document.activeElement as HTMLElement);
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                const next = event.key === 'ArrowDown' ? index + 1 : index - 1;
                if (next < 0) input.focus();
                else options[Math.min(next, options.length - 1)]?.focus();
            } else if (event.key === 'Enter' && document.activeElement === input) {
                event.preventDefault();
                list.querySelector<HTMLElement>('.driver-option')?.click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation(); // close the menu, not the sheet
                close();
                this.element.querySelector<HTMLElement>('.driver-pick')?.focus();
            } else if (event.key === 'Tab') {
                close();
            }
        });
    }

    static async #setDriver(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const uuid = target.dataset.uuid;
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        if (uuid) await this.actor.addVehicleDriver(uuid);
    }

    /** Actor flag: what the sidebar's picture shows, 'token' or (unset) the portrait. */
    static readonly PORTRAIT_MODE_FLAG = 'sheetPortraitMode';

    static async #setPortraitMode(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const actor = this.actor as unknown as { setFlag(scope: string, key: string, value: unknown): Promise<unknown>; unsetFlag(scope: string, key: string): Promise<unknown> };
        if (target.dataset.mode === 'token') await actor.setFlag(SYSTEM_NAME, SR5VehicleSheetRedesign.PORTRAIT_MODE_FLAG, 'token');
        else await actor.unsetFlag(SYSTEM_NAME, SR5VehicleSheetRedesign.PORTRAIT_MODE_FLAG);
    }

    static async #setControlMode(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const mode = target.dataset.mode;
        target.closest<HTMLElement>('[popover]')?.hidePopover();
        if (mode && mode in (SR5.vehicle.control_modes as Record<string, string>)) await this.actor.update({ system: { controlMode: mode as VehicleSystem['controlMode'] } });
    }

    /** The matrix track's boxes write the vehicle's own track (what getMatrixTrack and its rolls read); the rest as upstream. */
    static async #modifyConditionMonitor(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const cell = target.closest<HTMLElement>('[data-action="modifyConditionMonitor"]');
        if (cell?.dataset.id !== 'matrix') return systemAction(SR5VehicleSheetRedesign, 'modifyConditionMonitor')?.call(this, event, target);
        event.preventDefault();
        let value = Number(cell.dataset.value);
        const current = this.#system.track?.matrix?.value ?? 0;
        if (current === value) value = 0;
        await this.actor.update({ system: { track: { matrix: { value } } } });
    }

    static async #clearConditionMonitor(this: SR5VehicleSheetRedesign, event: PointerEvent, target: HTMLElement) {
        const button = target.closest<HTMLElement>('[data-action="clearConditionMonitor"]');
        if (button?.dataset.id !== 'matrix') return systemAction(SR5VehicleSheetRedesign, 'clearConditionMonitor')?.call(this, event, target);
        event.preventDefault();
        await this.actor.update({ system: { track: { matrix: { value: 0 } } } });
    }
}
