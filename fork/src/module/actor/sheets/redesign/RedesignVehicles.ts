import { SR5 } from '@/module/config';
import { SR5Actor } from '@/module/actor/SR5Actor';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { VEHICLE_CONTROL_ICONS } from '@/module/actor/sheets/redesign/RedesignListFilters';

// The character sheet's Vehicles & Drones tab: the vehicles a character drives, their table and expanded rows, a
// row's menu and monitors, the ownership of a new one, and the hooks that redraw the tab (SR5CharacterSheetRedesign).

let vehiclesWatched = false;

/** The table's stat columns, in the order of the book's stat lines (SR5#462 ff.): short label, full name. */
export const VEHICLE_COLUMNS = [
    { key: 'handling', label: 'SR5.Redesign.Vehicles.Col.Handling', tooltip: 'SR5.Vehicle.Stats.Handling' },
    { key: 'speed', label: 'SR5.Redesign.Vehicles.Col.Speed', tooltip: 'SR5.Vehicle.Stats.Speed' },
    { key: 'acceleration', label: 'SR5.Redesign.Vehicles.Col.Acceleration', tooltip: 'SR5.Vehicle.Stats.Acceleration' },
    { key: 'body', label: 'SR5.Redesign.Vehicles.Col.Body', tooltip: 'SR5.AttrBody' },
    { key: 'armor', label: 'SR5.Redesign.Vehicles.Col.Armor', tooltip: 'SR5.Armor.label' },
    { key: 'pilot', label: 'SR5.Redesign.Vehicles.Col.Pilot', tooltip: 'SR5.Vehicle.Stats.Pilot' },
    { key: 'sensor', label: 'SR5.Redesign.Vehicles.Col.Sensor', tooltip: 'SR5.Vehicle.Stats.Sensor' },
] as const;

/**
 * The vehicles this character drives: world actors of type vehicle whose driver is this actor, the system's
 * ownership of a vehicle (ActorOwnershipFlow, the matrix tab's owned icons). Foundry's permissions are separate:
 * a row opens the vehicle's sheet for users who may see it, and only its owners change it.
 */
export function drivenVehicles(character: SR5Actor): SR5Actor[] {
    const { uuid, id } = character;
    if (!uuid) return [];
    // the system's Chummer character import writes the driver's id, not its uuid (its own lookups miss those):
    // listed here all the same, so an imported rigger's drones show up
    return (game.actors?.contents ?? []).filter(actor => {
        const driver = actor.type === 'vehicle' ? (actor.system as { driver?: string }).driver : undefined;
        return !!driver && (driver === uuid || driver === id);
    }) as SR5Actor[];
}

/**
 * The tab's cards by the view: by type (Vehicles, then Drones), by category (a vehicle's Chummer category A-Z,
 * then the drone sizes, smallest first) or one list; rows A-Z. A row: the table's values, its kind under the
 * name, and its expanded part (what it is, acceleration, seats; the vehicle's own monitors).
 */
export function vehicleSections(character: SR5Actor, mode: string, open: Record<string, boolean | undefined>) {
    const i18n = (key: string) => game.i18n.localize(key);
    const value = (field: { value?: number } | undefined) => field?.value ?? 0;
    // on-road / off-road, as the book writes them ("4/3") when they differ
    const pair = (on: { value?: number } | undefined, off: { value?: number } | undefined) =>
        value(off) && value(off) !== value(on) ? `${value(on)}/${value(off)}` : `${value(on)}`;
    const sizes = SR5.vehicle.categories as Record<string, string>;
    const types = SR5.vehicle.types as Record<string, string>;
    // what a vehicle is: a drone's size, a vehicle's Chummer category (else its type)
    const categoryOf = (system: SR5Actor<'vehicle'>['system']) => system.isDrone
        ? { key: `size-${system.category}`, label: sizes[system.category] ? i18n(sizes[system.category]) : '' }
        : { key: `cat-${system.importFlags?.category || system.vehicleType}`, label: system.importFlags?.category || i18n(types[system.vehicleType] ?? '') };
    const rows = drivenVehicles(character).sort((a, b) => a.name.localeCompare(b.name)).map(vehicle => {
        const system = (vehicle as SR5Actor<'vehicle'>).system;
        const stats = system.vehicle_stats;
        const category = categoryOf(system);
        const columns: Record<string, string> = {
            handling: pair(stats.handling, stats.off_road_handling),
            speed: pair(stats.speed, stats.off_road_speed),
            acceleration: pair(stats.acceleration, stats.off_road_acceleration),
            body: `${value(system.attributes?.body)}`,
            armor: `${value(system.armor.rating)}`,
            pilot: `${value(stats.pilot)}`,
            sensor: `${value(stats.sensor)}`,
        };
        // the expanded row: what the table does not say (seats, the network it is on); what it is and the
        // acceleration repeat the row and stay only when nothing else would be there (#arrangeProperties)
        const network = vehicle.network as { name?: string } | null;
        // the control mode and the device rating (a vehicle's is its Pilot, SR5#269) live here, not in the table
        const control = i18n((SR5.vehicle.control_modes as Record<string, string>)[system.controlMode] ?? '');
        // in the order a rigger reads them: the device rating, the network, the control mode, the seats (cars)
        const props = [
            { prop: 'kind', dup: true, icon: system.isDrone ? 'fa-robot' : 'fa-car-side', text: [i18n(system.isDrone ? 'SR5.Vehicle.Drone' : 'SR5.Vehicle.Vehicle'), category.label].filter(Boolean).join(' · ') },
            { prop: 'stat', icon: 'fa-signal', text: `${i18n('SR5.Rating')} ${system.matrix?.rating ?? value(stats.pilot)}`, tooltip: i18n('SR5.Redesign.Vehicles.DeviceRating') },
            ...(network?.name ? [{ prop: 'stat', icon: 'fa-wifi', text: game.i18n.format('SR5.Redesign.Vehicles.ConnectedTo', { name: network.name }) }] : []),
            { prop: 'stat', icon: VEHICLE_CONTROL_ICONS[system.controlMode] ?? 'fa-question', text: control, tooltip: i18n('SR5.Vehicle.ControlMode') },
            ...(value(stats.seats) ? [{ prop: 'stat', icon: 'fa-chair', text: `${i18n('SR5.Vehicle.Stats.Seats')} ${value(stats.seats)}` }] : []),
            { prop: 'stat', dup: true, icon: 'fa-gauge-high', text: `${i18n('SR5.Vehicle.Stats.Acceleration')} ${pair(stats.acceleration, stats.off_road_acceleration)}` },
        ];
        const track = system.track;
        const monitors = [
            { id: 'physical', label: 'SR5.Redesign.Vehicles.Damage', icon: 'fa-car-burst', value: track.physical?.value ?? 0, max: track.physical?.max ?? 0 },
            { id: 'matrix', label: 'SR5.Labels.ActorSheet.Matrix', icon: 'fa-microchip', value: track.matrix?.value ?? 0, max: track.matrix?.max ?? 0 },
        ].filter(monitor => monitor.max > 0);
        return {
            uuid: vehicle.uuid,
            name: vehicle.name,
            img: vehicle.img,
            source: system.description?.source ?? '',
            isDrone: !!system.isDrone,
            categoryKey: category.key,
            categoryLabel: category.label,
            // under the name what its card does not say: by type the size or category, by category nothing,
            // in one list a drone says it is one
            kind: mode === 'category' ? '' : mode === 'none' && system.isDrone ? `${i18n('SR5.Vehicle.Drone')} · ${category.label}` : category.label,
            stats: VEHICLE_COLUMNS.map(column => columns[column.key]),
            props,
            monitors,
            canView: vehicle.testUserPermission(game.user!, 'LIMITED'),
            canEdit: vehicle.isOwner,
        };
    });
    const card = (type: string, label: string, list: typeof rows, extra: Record<string, unknown> = {}) =>
        ({ type, label, isOpen: open[type] ?? true, rows: list, ...extra });
    if (mode === 'none') return [card('vehicle_all', 'SR5.Redesign.Tabs.Vehicles', rows)];
    if (mode === 'category') {
        const sizeOrder = Object.keys(sizes);
        const keys = [...new Set(rows.map(row => row.categoryKey))].sort((a, b) => {
            const [kindA, kindB] = [a.startsWith('size-'), b.startsWith('size-')];
            if (kindA !== kindB) return kindA ? 1 : -1;
            if (kindA) return sizeOrder.indexOf(a.slice(5)) - sizeOrder.indexOf(b.slice(5));
            return a.localeCompare(b);
        });
        return keys.map(key => {
            const list = rows.filter(row => row.categoryKey === key);
            // drone sizes read as Chummer's categories ("Drones: Small"); a vehicle's is its own
            const label = list[0].categoryLabel || i18n('SR5.Redesign.Vehicles.Other');
            return card(`vehicle_${key}`, list[0].isDrone ? `${i18n('SR5.Redesign.Vehicles.Drones')}: ${label}` : label, list);
        });
    }
    return [
        card('vehicle_vehicles', 'SR5.Redesign.Vehicles.Vehicles', rows.filter(row => !row.isDrone), { isDrone: false, addLabel: 'SR5.Redesign.Vehicles.AddVehicle' }),
        card('vehicle_drones', 'SR5.Redesign.Vehicles.Drones', rows.filter(row => row.isDrone), { isDrone: true, addLabel: 'SR5.Redesign.Vehicles.AddDrone' }),
    ];
}

/** A vehicle's monitor cell (its expanded row): that damage, or none when the filled last one is clicked. */
export async function modifyVehicleMonitor(target: HTMLElement) {
    const vehicle = vehicleOf(target);
    if (!vehicle?.isOwner) return;
    const track = target.dataset.id;
    let value = Number(target.dataset.value);
    const tracks = (vehicle as SR5Actor<'vehicle'>).system.track as Record<string, { value?: number } | undefined>;
    const current = tracks[track ?? '']?.value ?? 0;
    if (current === value) value = 0;
    // both straight into the vehicle's tracks: setMatrixDamage writes a vehicle's legacy matrix.condition_monitor,
    // not the track.matrix its sheet, its rolls (getMatrixTrack) and this tab read
    if (track === 'matrix' || track === 'physical') await vehicle.update({ [`system.track.${track}.value`]: value });
}

/** A vehicle's monitor cleared (the ban icon of its expanded row). */
export async function clearVehicleMonitor(target: HTMLElement) {
    const vehicle = vehicleOf(target);
    if (!vehicle?.isOwner) return;
    const track = target.dataset.id === 'matrix' ? 'matrix' : 'physical';
    await vehicle.update({ [`system.track.${track}.value`]: 0 });
}

/** A new vehicle's ownership: the character's owners own it too (so the player can drive and edit it), default none. */
export function vehicleOwnership(character: SR5Actor) {
    const ownership: Record<string, number> = { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE };
    for (const [id, level] of Object.entries(character.ownership ?? {})) {
        if (id !== 'default' && level === CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) ownership[id] = level;
    }
    if (game.user?.id) ownership[game.user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    return ownership;
}

/** A vehicle row's menu: open its sheet, its book page, and for its owners stop driving it or delete it. */
export function vehicleContextOptions(confirmDeletion: (title: string) => Promise<boolean>) {
    const vehicle = (target: HTMLElement) => vehicleOf(target);
    return [
        {
            label: 'SR5.Redesign.Vehicles.Menu.Open',
            icon: "<i class='fas fa-up-right-from-square'></i>",
            condition: (target: HTMLElement) => !!vehicle(target)?.testUserPermission(game.user!, 'LIMITED'),
            callback: async (target: HTMLElement) => { await vehicle(target)?.sheet?.render(true); },
        },
        SheetFlow._getSourceContextOption(),
        {
            label: 'SR5.Redesign.Vehicles.Menu.Unlink',
            icon: "<i class='fas fa-link-slash'></i>",
            condition: (target: HTMLElement) => !!vehicle(target)?.isOwner,
            callback: async (target: HTMLElement) => { await vehicle(target)?.removeVehicleDriver(); },
        },
        {
            label: 'SR5.Redesign.Vehicles.Menu.Delete',
            icon: "<i class='fas fa-trash'></i>",
            condition: (target: HTMLElement) => !!vehicle(target)?.isOwner,
            callback: async (target: HTMLElement) => {
                const doc = vehicle(target);
                if (doc && await confirmDeletion(`${game.i18n.localize('SR5.Redesign.Vehicles.DeleteTitle')}: ${doc.name}`)) await doc.delete();
            },
        },
    ];
}

/** The vehicle a row or a control in it stands for. */
export function vehicleOf(target: HTMLElement) {
    const uuid = target.closest<HTMLElement>('[data-vehicle-uuid]')?.dataset.vehicleUuid;
    return uuid ? fromUuidSync(uuid) as SR5Actor | null : null;
}

/**
 * A vehicle created, changed or deleted (its driver, its stats, its name) redraws the vehicles tab of the open
 * redesigned sheets it is on (`redraw` gets the vehicle), and the tab bar (the tab shows or hides with it). The vehicle is another actor, so the
 * sheet's own update map never sees it.
 */
export function watchVehicles(redraw: (vehicle: SR5Actor) => void) {
    if (vehiclesWatched) return;
    vehiclesWatched = true;
    const onChange = (actor: Actor) => { if (actor?.type === 'vehicle') redraw(actor as unknown as SR5Actor); };
    for (const hook of ['createActor', 'updateActor', 'deleteActor']) (Hooks.on.bind(Hooks) as (hook: string, fn: (actor: Actor) => void) => number)(hook, onChange);
}
