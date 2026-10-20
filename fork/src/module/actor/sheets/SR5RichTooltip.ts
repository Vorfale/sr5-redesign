import { LinksHelpers } from '@/module/utils/links';
import { SR5 } from '@/module/config';
import { SR5Item } from '@/module/item/SR5Item';
import { SR5Actor } from '@/module/actor/SR5Actor';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { SkillRules } from '@/module/rules/SkillRules';
import { Helpers } from '@/module/helpers';
import { ModifierFlow } from '@/module/actor/flows/ModifierFlow';
import { RedesignPool } from '@/module/actor/sheets/RedesignPool';
import { SR5ActiveEffect } from '@/module/effect/SR5ActiveEffect';
import { prepareEffectDurationStatus } from '@/module/effect/EffectDurationStatus';

/**
 * Font Awesome icons (Foundry ships the Pro set) standing in for a picture on the cards of attributes, limits, armor and
 * movement. Picked to read as Shadowrun rather than the dnd5e sheet: Magic a sparkling hand (no wand), armor an armored
 * vest (dnd5e's AC is a shield); Edge keeps its lucky clover. Pro icons are used on the user's own FA Pro license.
 */
/** A value with its modifiers as the system prepares it: an attribute, a limit, armor, movement, a vehicle stat. */
type CardValue = { value?: number; base?: number; label?: string; hidden?: boolean; changes?: { value?: unknown }[] };
/** What the cards read of an actor's prepared data, of every actor type: all of it may be missing. */
type CardActorSystem = {
    limits?: Record<string, CardValue | undefined>;
    armor?: { rating?: CardValue };
    movement?: Record<string, CardValue | undefined>;
    attributes?: Record<string, CardValue | undefined>;
    vehicle_stats?: Record<string, CardValue | undefined>;
    environment?: string;
    isOffRoad?: boolean;
    modificationCategories?: Record<string, number>;
};
/** A value as an item keeps it: prepared (`value`) or only its base. */
type CardNumber = { value?: number; base?: number };
/**
 * What the item card reads of an item's data, across the item types and both system versions (0.37 keeps the
 * computed availability, cost and essence under technology.calculated and the availability as a string): all of it
 * may be missing.
 */
type ItemCardSystem = {
    importFlags?: { category?: string };
    description?: { source?: string };
    action?: {
        limit?: CardNumber;
        damage?: CardNumber & { type?: { value?: string; base?: string }; element?: { value?: string; base?: string }; ap?: CardNumber };
    };
    category?: string;
    /** a weapon's ranges and firing modes, or a spell's / critter power's range */
    range?: unknown;
    ammo?: { current?: { value?: number; max?: number } };
    melee?: { reach?: number };
    armor?: CardNumber & { accessory?: boolean };
    grade?: string;
    atts?: Record<string, { value?: number; att?: string } | undefined>;
    combat?: { type?: string };
    type?: string;
    duration?: string;
    drain?: number;
    target?: string;
    fade?: number;
    pp?: number;
    level?: number;
    powerType?: string;
    karma?: number;
    rating?: number;
    loyalty?: number;
    connection?: number;
    family?: boolean;
    blackmail?: boolean;
    group?: boolean;
    linkedActor?: string;
    cost?: number;
    permanent?: boolean;
    comforts?: number;
    security?: number;
    neighborhood?: number;
    guests?: number;
    technology?: {
        rating?: number;
        quantity?: number;
        equipped?: boolean;
        wireless?: string;
        availability?: string | { label?: string; value?: string };
        cost?: number | CardNumber;
        essence?: CardNumber;
        calculated?: { availability?: { value?: string }; cost?: { value?: number }; essence?: { value?: number } };
    };
};

/** Foundry's tooltip placement (protected in its types): the side it opens on, or a position of its own. */
type TooltipPlacement = { _setAnchor(direction: string): void; _setStyle(position: Record<string, unknown>): void };
/** A modification's slots (or drone mod points) as the cards read them. */
const modSlotsOf = (item: SR5Item) => {
    const system = item.system as { slots?: number; technology?: { quantity?: number } };
    return (Number(system.slots) || 0) * (Number(system.technology?.quantity) || 1);
};

const STAT_ICONS: Record<string, string> = {
    body: 'fa-dumbbell', agility: 'fa-person-running', reaction: 'fa-bolt', strength: 'fa-hand-fist',
    willpower: 'fa-brain', logic: 'fa-microchip', intuition: 'fa-eye', charisma: 'fa-masks-theater',
    edge: 'fa-clover', magic: 'fa-hand-sparkles', resonance: 'fa-wave-square', essence: 'fa-heart-pulse',
    limit_physical: 'fa-person', limit_mental: 'fa-brain', limit_social: 'fa-comments', limit_astral: 'fa-ghost',
    armor: 'fa-vest', walk: 'fa-person-walking', run: 'fa-person-running',
    // a vehicle's stats and limits (the vehicle sheet's plates)
    vehicle_handling: 'fa-route', vehicle_speed: 'fa-gauge-high', vehicle_acceleration: 'fa-forward',
    vehicle_body: 'fa-car-side', vehicle_armor: 'fa-shield', vehicle_pilot: 'fa-robot',
    vehicle_sensor: 'fa-satellite-dish', vehicle_seats: 'fa-chair',
    limit_handling: 'fa-route', limit_speed: 'fa-gauge-high', limit_sensor: 'fa-satellite-dish',
    vehicle_walk: 'fa-gauge', vehicle_run: 'fa-gauge-high',
};
/**
 * Rulebook page of each stat card, linked in its footer like an item's source: the attribute descriptions (SR5#51,
 * special attributes SR5#52), using Edge (SR5#56), limits (Tests and Limits, SR5#46), armor (SR5#169), movement (SR5#161).
 */
const STAT_SOURCES: Record<string, string> = {
    body: 'SR5 51', agility: 'SR5 51', reaction: 'SR5 51', strength: 'SR5 51',
    willpower: 'SR5 51', logic: 'SR5 51', intuition: 'SR5 51', charisma: 'SR5 51',
    edge: 'SR5 56', magic: 'SR5 52', resonance: 'SR5 52', essence: 'SR5 52',
    limit_physical: 'SR5 46', limit_mental: 'SR5 46', limit_social: 'SR5 46', limit_astral: 'SR5 46',
    armor: 'SR5 169', walk: 'SR5 161', run: 'SR5 161',
    // vehicle attributes (SR5#199), seats (SR5#461), vehicle test limits (SR5#199, chases SR5#203), movement (SR5#202)
    vehicle_handling: 'SR5 199', vehicle_speed: 'SR5 199', vehicle_acceleration: 'SR5 199', vehicle_body: 'SR5 199',
    vehicle_armor: 'SR5 199', vehicle_pilot: 'SR5 199', vehicle_sensor: 'SR5 199', vehicle_seats: 'SR5 461',
    limit_handling: 'SR5 199', limit_speed: 'SR5 199', limit_sensor: 'SR5 199',
    vehicle_walk: 'SR5 202', vehicle_run: 'SR5 202',
};
/** Icons of the modification slot categories, as on the vehicle sheet's slot card. */
const MOD_SLOT_ICONS: Record<string, string> = {
    powertrain: 'fa-gears', protection: 'fa-shield', weapons: 'fa-gun', body: 'fa-truck',
    electromagnetic: 'fa-bolt', cosmetic: 'fa-image', points: 'fa-microchip',
};
/** Paired vehicle stats: the on-road field and its off-road twin (VehiclePrep picks one by isOffRoad). */
const VEHICLE_OFF_ROAD: Record<string, string> = { handling: 'off_road_handling', speed: 'off_road_speed', acceleration: 'off_road_acceleration' };
const PHYSICAL = new Set(['body', 'agility', 'reaction', 'strength']);
const MENTAL = new Set(['willpower', 'logic', 'intuition', 'charisma']);

/**
 * Rich hover cards on the SR5 Redesign character sheet: picture, name and kind, the stats
 * that matter for the item type, its description, tags and the source. Attributes, limits, armor and movement get a
 * card too (icon, what it does, the modifier breakdown).
 * Foundry's TooltipManager does the hover delay and hiding, like for every tooltip; this fills the tooltip when it
 * opens and places it the way dnd5e places its item cards: beside the hovered element (left of it, right of it when
 * the screen ends there), centred on it, not following the pointer. Actor values (attributes, limits...) open below
 * or above, like core tooltips.
 *
 * Usage: `RichTooltip.attach(element, uuid)` / `RichTooltip.attachStat(element, actor, kind, id)` on render;
 * `RichTooltip.install()` once.
 */
export class RichTooltip {
    static readonly TEMPLATE = 'systems/shadowrun5e/dist/templates/v2/actor/redesign/tooltip.hbs';
    static readonly CSS_CLASS = 'sr5-redesign-tooltip sr-rich-tooltip';
    static readonly PLACEHOLDER = '<section class="sr-rich loading"><i class="fas fa-spinner fa-spin"></i></section>';
    static #installed = false;
    /** Pending card for an element that got the keyboard focus. */
    static #focusTimer: number | undefined;
    /** How long the focus rests on an element before its card opens: tabbing through a list does not flash every card. */
    static readonly FOCUS_DELAY_MS = 400;
    /** How long a card the pointer entered stays after the pointer leaves it (a slip over its edge keeps it). */
    static readonly HOVER_LEAVE_MS = 250;

    /** Marks an element as the hover target of an item's rich tooltip. */
    static attach(element: HTMLElement, uuid: string) {
        element.dataset.richUuid = uuid;
        RichTooltip.#mark(element);
    }

    /** Marks an element as the hover target of an actor value's card: an attribute, a limit, armor or movement. */
    static attachStat(element: HTMLElement, actor: SR5Actor, kind: 'attribute' | 'limit' | 'armor' | 'movement' | 'vehicle' | 'modslots', id: string) {
        element.dataset.richActor = actor.uuid ?? '';
        element.dataset.richStat = `${kind}:${id}`;
        RichTooltip.#mark(element);
        // the card carries the system's modifier breakdown itself
        delete element.dataset.attributeModifierTooltip;
        delete element.dataset.limitModifierTooltip;
        delete element.dataset.modifierTooltipPath;
    }

    static #mark(element: HTMLElement) {
        element.dataset.tooltipHtml = RichTooltip.PLACEHOLDER;
        element.dataset.tooltipClass = RichTooltip.CSS_CLASS;
        delete element.dataset.tooltip;
        delete element.dataset.tooltipDirection;
    }

    /** Fills the tooltip when Foundry activates it for an attached element. */
    static install() {
        if (RichTooltip.#installed || !game.tooltip?.tooltip) return;
        RichTooltip.#installed = true;
        // loaded now, so the first hover does not wait for the template
        void foundry.applications.handlebars.loadTemplates([RichTooltip.TEMPLATE]);
        const tooltip = game.tooltip.tooltip;
        const options = { capture: true, passive: true };
        document.addEventListener('pointermove', () => {
            // a re-render replaced the hovered row: the browser sends no pointerleave for it
            if (RichTooltip.#isOpen() && !game.tooltip.element?.isConnected) game.tooltip.deactivate();
        }, options);
        // a click, a context menu, scrolling or Escape close the card at once (it would cover the menu, or stay
        // behind while its row scrolls away). Not the middle button: Foundry locks the tooltip when it comes up.
        const close = () => { if (RichTooltip.#isOpen()) game.tooltip.deactivate(); };
        document.addEventListener('pointerdown', event => { if (event.button !== 1) close(); }, options);
        document.addEventListener('wheel', close, options);
        // Escape closes an open or locked card, and only that: Foundry would close the sheet on the same key (its
        // keyboard manager listens on the window, after this)
        document.addEventListener('keydown', event => {
            if (event.key !== 'Escape') return;
            const locked = !!document.querySelector('.locked-tooltip.sr-rich-tooltip');
            if (!RichTooltip.#isOpen() && !locked) return;
            close();
            if (locked) game.tooltip.dismissLockedTooltips();
            event.stopPropagation();
        });
        RichTooltip.#showOnFocus();
        RichTooltip.#lockOnHover(tooltip);
        // the source in a card's footer opens like the rows' source links (a hover-locked card takes clicks)
        document.addEventListener('click', event => {
            const link = event.target instanceof Element ? event.target.closest<HTMLElement>('.sr-rich-tooltip .sr-rich-source') : null;
            if (!link) return;
            event.preventDefault();
            game.tooltip.dismissLockedTooltips();
            void LinksHelpers.openSource(link.dataset.source);
        });
        // like dnd5e: a middle click inside a locked card does not start the browser's autoscroll
        document.addEventListener('pointerdown', event => {
            if (event.button === 1 && event.target instanceof Element && event.target.closest('.locked-tooltip')) event.preventDefault();
        }, { capture: true });
        new MutationObserver(records => {
            if (tooltip.classList.contains('active')) RichTooltip.#applyTheme(tooltip);
            const activated = records.some(record => record.oldValue !== null && !record.oldValue.split(' ').includes('active')
                && tooltip.classList.contains('active'));
            if (activated || records.some(record => record.oldValue === null)) {
                RichTooltip.#placePlain();
                void RichTooltip.#onActivate();
            }
        }).observe(tooltip, { attributes: true, attributeFilter: ['class'], attributeOldValue: true });
    }

    /**
     * Keyboard users get the cards too (WCAG 2.1.1, 1.4.13): an attached element that keeps the keyboard focus
     * (:focus-visible, so not after a click) opens its card, which goes when the focus leaves or on Escape. Foundry
     * links the card to the element (aria-describedby), so a screen reader reads it as the element's description.
     */
    static #showOnFocus() {
        const attached = (target: EventTarget | null) => target instanceof HTMLElement && (target.dataset.richUuid || target.dataset.richStat) ? target : null;
        document.addEventListener('focusin', event => {
            const element = attached(event.target);
            window.clearTimeout(RichTooltip.#focusTimer);
            if (!element || !element.matches(':focus-visible')) return;
            RichTooltip.#focusTimer = window.setTimeout(() => {
                if (document.activeElement === element && element.isConnected) game.tooltip.activate(element);
            }, RichTooltip.FOCUS_DELAY_MS);
        });
        document.addEventListener('focusout', event => {
            window.clearTimeout(RichTooltip.#focusTimer);
            const element = attached(event.target);
            if (element && game.tooltip.element === element && !element.matches(':hover')) game.tooltip.deactivate();
        });
    }

    /**
     * The pointer can move onto a card to read it, select its text or follow its links (WCAG 1.4.13 "hoverable"):
     * a card the pointer enters is locked (Foundry's locked tooltips take the pointer) and goes once the pointer leaves
     * it; a middle click inside keeps it for good, like a middle click on its row. On the way there the pointer
     * crosses the row's other controls, whose plain tooltips would replace the card at once: while a card is open
     * they keep quiet.
     */
    static #lockOnHover(tooltip: HTMLElement) {
        tooltip.addEventListener('pointerenter', () => {
            if (!RichTooltip.#isOpen() || tooltip.querySelector('.sr-rich.loading')) return;
            const card = game.tooltip.lockTooltip();
            card.classList.add('sr-hover-locked');
            let leaving: number | undefined;
            card.addEventListener('pointerenter', () => window.clearTimeout(leaving));
            card.addEventListener('pointerleave', () => {
                if (!card.classList.contains('sr-hover-locked')) return;
                leaving = window.setTimeout(() => { if (card.isConnected) game.tooltip.dismissLockedTooltip(card); }, RichTooltip.HOVER_LEAVE_MS);
            });
            card.addEventListener('pointerup', event => { if (event.button === 1) card.classList.remove('sr-hover-locked'); });
        });
        // window capture runs before Foundry's listener on the body
        window.addEventListener('pointerenter', event => {
            const anchor = game.tooltip.element;
            const target = event.target;
            if (!RichTooltip.#isOpen() || !anchor || !(target instanceof HTMLElement) || target === anchor) return;
            if (target.dataset.richUuid || target.dataset.richStat) return;
            const row = anchor.closest('.list-item, .favorite, .pill');
            if (row && row.contains(target)) event.stopImmediatePropagation();
        }, { capture: true });
    }

    /**
     * Foundry draws every tooltip dark. The sheet's tooltips take the theme of the sheet they came from instead: its
     * own theme, else the applications' theme on the body. Called on every class change of the tooltip; a no-op once set.
     */
    static #applyTheme(tooltip: HTMLElement) {
        if (!tooltip.classList.contains('sr5-redesign-tooltip')) return;
        const light = !!game.tooltip.element?.closest('.theme-light, .theme-dark')?.classList.contains('theme-light');
        tooltip.classList.toggle('sr-tooltip-light', light);
        tooltip.classList.toggle('theme-light', light);
        tooltip.classList.toggle('theme-dark', !light);
    }

    /** The pointer stays on the row while its context menu is open, so Foundry would open the card again over the menu. */
    static #menuOpen() {
        return !!document.getElementById('context-menu');
    }

    /** Whether the shared tooltip currently shows one of these cards. */
    static #isOpen() {
        const anchor = game.tooltip?.element;
        return !!anchor && !!(anchor.dataset.richUuid || anchor.dataset.richStat);
    }

    static async #onActivate() {
        const anchor = game.tooltip?.element;
        const tooltip = game.tooltip.tooltip;
        if (!anchor || !tooltip.querySelector('.sr-rich.loading')) return;
        const { richUuid, richActor, richStat } = anchor.dataset;
        if (!richUuid && !richStat) return;
        if (RichTooltip.#menuOpen()) return game.tooltip.deactivate();
        RichTooltip.#place(anchor);
        let context: Record<string, unknown> | null = null;
        if (richUuid) {
            const document = await fromUuid(richUuid);
            if (document instanceof SR5ActiveEffect) context = await RichTooltip.effectContext(document);
            else if (document instanceof SR5Item) context = await RichTooltip.context(document as SR5Item);
            else if (document instanceof SR5Actor && document.type === 'vehicle') context = await RichTooltip.vehicleContext(document as SR5Actor);
        } else if (richActor && richStat) {
            const actor = await fromUuid(richActor) as SR5Actor | null;
            const [kind, id] = richStat.split(':');
            if (actor) context = await RichTooltip.statContext(actor, kind, id);
        }
        if (!context || game.tooltip.element !== anchor) return;
        const html = await foundry.applications.handlebars.renderTemplate(RichTooltip.TEMPLATE, context);
        if (game.tooltip.element !== anchor) return;
        tooltip.innerHTML = html;
        // placed again once the content has its size, as dnd5e does
        requestAnimationFrame(() => { if (game.tooltip.element === anchor) RichTooltip.#place(anchor); });
    }

    /**
     * Beside the hovered row, as dnd5e places its item cards, but against the table the row is in: left of the
     * table, on its right where the screen ends; a favorite against the sidebar, a quality pill against itself, any
     * other row outside a table by its icon. Centred on the
     * row (Foundry keeps it on screen). An element can ask for a side with data-tooltip-direction. Actor values keep
     * Foundry's own choice, below or above.
     */
    static #place(anchor: HTMLElement) {
        const manager = game.tooltip as unknown as TooltipPlacement;
        const directions = foundry.helpers.interaction.TooltipManager.TOOLTIP_DIRECTIONS;
        const margin = foundry.helpers.interaction.TooltipManager.TOOLTIP_MARGIN_PX;
        // actor values: below the whole plate / lozenge / limit with its label (dnd5e's armor class and speed open
        // below their block), not over the plate's own value
        // attributes open above their plate (the rows below stay readable), limits below; armor and movement sit in
        // the sidebar and open beside it like the favorites, so they cover neither the sidebar nor the tab
        const stat = anchor.dataset.richStat && !anchor.dataset.tooltipDirection
            ? anchor.closest<HTMLElement>('.ability-score, .lozenge, .limit') ?? anchor : null;
        if (stat && !stat.closest('.sr-sidebar')) return RichTooltip.#belowOrAbove(stat, 'left', stat.matches('.ability-score, .lozenge'));
        const tooltip = game.tooltip.tooltip;
        const row = stat ?? anchor.closest<HTMLElement>('.list-item, .favorite, .pill, .network-row') ?? anchor;
        // what the card lines up with: a favorite, armor and movement the sidebar, a quality pill itself, a row its table
        const edge = row.matches('.favorite') || stat ? row.closest<HTMLElement>('.sr-sidebar')
            : row.matches('.pill') ? row : row.closest<HTMLElement>('.card, .network-table');
        const side = (edge ?? row.querySelector<HTMLElement>('img, .item-icon') ?? anchor).getBoundingClientRect();
        const middle = row.getBoundingClientRect();
        const width = tooltip.offsetWidth;
        let direction = anchor.dataset.tooltipDirection ?? directions.LEFT;
        if (direction === directions.LEFT && side.left - width - margin < margin) direction = directions.RIGHT;
        else if (direction === directions.RIGHT && side.right + width + margin > window.innerWidth - margin) direction = directions.LEFT;
        if (direction !== directions.LEFT && direction !== directions.RIGHT) return manager._setAnchor(direction);
        const top = middle.top + middle.height / 2 - tooltip.offsetHeight / 2;
        manager._setStyle(direction === directions.LEFT
            ? { right: window.innerWidth - side.left + margin, top, textAlign: 'left' }
            : { left: side.right + margin, top, textAlign: 'left' });
    }

    /**
     * Below the box, centred on it, or above it where the screen ends below (`preferAbove`: the other way round).
     * Foundry's own choice looks at the top of the element: near the bottom of the screen it picks below, then pushes
     * the tooltip back up over the element.
     */
    static #belowOrAbove(box: HTMLElement, textAlign: 'left' | 'center', preferAbove = false) {
        const margin = foundry.helpers.interaction.TooltipManager.TOOLTIP_MARGIN_PX;
        const tooltip = game.tooltip.tooltip;
        const rect = box.getBoundingClientRect();
        const left = rect.left + rect.width / 2 - tooltip.offsetWidth / 2;
        const fitsBelow = rect.bottom + margin + tooltip.offsetHeight <= window.innerHeight - margin;
        const fitsAbove = rect.top - margin - tooltip.offsetHeight >= margin;
        const below = preferAbove ? !fitsAbove && fitsBelow : fitsBelow || !fitsAbove;
        (game.tooltip as unknown as TooltipPlacement)._setStyle(below
            ? { left, top: rect.bottom + margin, textAlign }
            : { left, bottom: window.innerHeight - rect.top + margin, textAlign });
    }

    /** Plain tooltips of the sheet without a direction of their own: below their element, or above it, never over it. */
    static #placePlain() {
        const anchor = game.tooltip.element;
        if (!anchor || anchor.dataset.richUuid || anchor.dataset.richStat) return;
        // a card rendered ahead into data-tooltip-html (the network manager's networks): beside its table, like the
        // item cards; once now and once it has its size
        if (game.tooltip.tooltip.classList.contains('sr-rich-tooltip')) {
            RichTooltip.#place(anchor);
            requestAnimationFrame(() => { if (game.tooltip.element === anchor) RichTooltip.#place(anchor); });
            return;
        }
        if (!anchor.closest('.sr5v2.sr5-redesign')) return;
        if (anchor.closest('[data-tooltip-direction]')) return;
        RichTooltip.#belowOrAbove(anchor, 'center');
    }

    /** Card of an actor value: icon, what it is for, its value and the system's modifier breakdown. */
    static async statContext(actor: SR5Actor, kind: string, id: string) {
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const system = actor.system as CardActorSystem;
        let value: CardValue | null | undefined;
        let name = '';
        let detail = '';
        let label = '';
        const isVehicle = actor.type === 'vehicle';
        const tags: string[] = [];
        // a vehicle's stat (vehicle sheet plates): the stat of the road the vehicle is on, the other road's beside it
        if (kind === 'vehicle') return RichTooltip.#vehicleStatContext(actor, id);
        if (kind === 'modslots') return RichTooltip.#modSlotsContext(actor, id);
        switch (kind) {
            case 'attribute':
                value = actor.getAttribute(id);
                name = i18n(value?.label);
                label = i18n('SR5.Redesign.Tooltip.AttributeKind');
                detail = i18n(`SR5.Redesign.Tooltip.${PHYSICAL.has(id) ? 'PhysicalAttribute' : MENTAL.has(id) ? 'MentalAttribute' : 'SpecialAttribute'}`);
                break;
            case 'limit':
                value = actor.getLimit(id) ?? system.limits?.[id];
                name = i18n(`SR5.Redesign.LimitLabel.${id}`);
                label = i18n('SR5.Redesign.Tooltip.Limit');
                // a vehicle test takes the chase environment's limit (SR5#203): the card says which one is in use
                if (isVehicle && (id === 'handling' || id === 'speed')) {
                    tags.push(i18n(system.environment === id ? 'SR5.Redesign.Rigging.LimitInUse' : 'SR5.Redesign.Rigging.LimitNotInUse'));
                    if (system.isOffRoad) tags.push(i18n('SR5.Vehicle.OffRoad'));
                }
                break;
            case 'armor':
                value = system.armor?.rating;
                name = i18n('SR5.Redesign.ArmorRating');
                label = i18n('SR5.Redesign.Tooltip.Armor');
                break;
            case 'movement':
                value = system.movement?.[id];
                name = i18n(isVehicle ? `SR5.Redesign.Rigging.Move.${id}` : id === 'run' ? 'SR5.RunningSpeed' : 'SR5.WalkingSpeed');
                label = i18n('SR5.Movement');
                break;
        }
        if (!value) return null;
        const key = kind === 'limit' ? `limit_${id}` : kind === 'attribute' ? id : kind === 'armor' ? (isVehicle ? 'vehicle_armor' : 'armor')
            : isVehicle && kind === 'movement' ? `vehicle_${id}` : id;
        const total = id === 'essence' ? Helpers.formatEssence(value.value) : value.value;
        const stats: { label: string, value: string | number }[] = [{ label: i18n('SR5.Redesign.Tooltip.Value'), value: total ?? 0 }];
        if (kind === 'attribute' && value.base !== undefined && value.base !== value.value) {
            stats.push({ label: i18n('SR5.Redesign.Tooltip.Base'), value: id === 'essence' ? Helpers.formatEssence(value.base) : value.base });
        }
        if (kind === 'movement') stats[0].value = `${total ?? 0} m`;
        // the run card also says what a Sprinting test adds per hit (movement.sprint: shown only, no roll uses it)
        const sprint = (system.movement as { sprint?: number } | undefined)?.sprint;
        if (kind === 'movement' && id === 'run' && sprint) {
            stats.push({ label: i18n('SR5.SprintingBonus'), value: game.i18n.format('SR5.Redesign.SprintPerHit', { value: sprint }) });
        }
        // the breakdown only says something when modifiers change the base value; zero entries ("Bonus 0") are left out
        const changes = (value.changes ?? []).filter(change => Number(change.value) !== 0);
        const breakdown = changes.length
            ? (await foundry.applications.handlebars.renderTemplate(SheetFlow.templateBase('common/modifiers-tooltip'), { value: { ...value, changes } })).trim() : '';
        return {
            icon: STAT_ICONS[key] ?? 'fa-circle-info',
            name,
            kind: label,
            detail,
            stats,
            description: `<p>${i18n(`SR5.Redesign.StatInfo.${key}`)}</p>`,
            breakdown,
            tags,
            source: STAT_SOURCES[key] ?? '',
        };
    }

    /**
     * A vehicle's modification slots of one category (Rigger 5.0 p.151: Body slots in each, plus the extra slots set on
     * the Configuration tab), or a drone's mod points (R5 p.122: Body points in all): taken / there, and the equipped
     * modifications in them with the slots each takes.
     */
    static #modSlotsContext(actor: SR5Actor, id: string) {
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const system = actor.system as CardActorSystem;
        const points = id === 'points';
        const slots = modSlotsOf;
        const installed = actor.items.filter(item => item.type === 'modification' && item.isEquipped()
            && (points || (item.system as { modification_category?: string }).modification_category === id)) as SR5Item[];
        const used = installed.reduce((sum, item) => sum + slots(item), 0);
        const body = Number(system.attributes?.body?.value) || 0;
        const extra = points ? 0 : Number(system.modificationCategories?.[id]) || 0;
        const stats: { label: string, value: string | number }[] = [
            { label: i18n('SR5.Redesign.Rigging.Used'), value: used },
            { label: i18n('SR5.Redesign.Rigging.Max'), value: body + extra },
        ];
        if (extra) stats.push({ label: i18n('SR5.AttrBody'), value: body }, { label: i18n('SR5.Redesign.Rigging.Extra'), value: extra });
        const name = points ? i18n('SR5.ModPoints') : i18n((SR5.modificationCategories as Record<string, string>)[id] ?? `SR5.Vehicle.ModificationCategoryTypes.${id}`);
        const over = used > body + extra ? `<p>${i18n('SR5.Redesign.Rigging.SlotsOver')}</p>` : '';
        return {
            icon: MOD_SLOT_ICONS[id] ?? 'fa-wrench',
            name,
            kind: i18n(points ? 'SR5.Redesign.Rigging.PointsKind' : 'SR5.Redesign.Rigging.SlotsKind'),
            detail: '',
            stats,
            description: `<p>${i18n(points ? 'SR5.Redesign.Rigging.PointsInfo' : 'SR5.Redesign.Rigging.SlotsInfo')}</p>${over}${installed.length ? '' : `<p>${i18n('SR5.Redesign.Rigging.NothingInstalled')}</p>`}`,
            breakdown: '',
            tagsLabel: installed.length ? i18n('SR5.Redesign.Rigging.Installed') : '',
            tags: installed.map(item => slots(item) ? `${item.name} · ${slots(item)}` : item.name),
            source: points ? 'R5 122' : 'R5 151',
        };
    }

    /**
     * A vehicle stat's card: what it does (own words), the value in play and its base, the other road's value for
     * handling / speed / acceleration, and the modifiers (a modification's effect, an active effect).
     */
    static async #vehicleStatContext(actor: SR5Actor, id: string) {
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const system = actor.system as CardActorSystem;
        const offId = VEHICLE_OFF_ROAD[id];
        const onRoad = id === 'body' ? system.attributes?.body : id === 'armor' ? system.armor?.rating : system.vehicle_stats?.[id];
        if (!onRoad) return null;
        const offRoad = offId ? system.vehicle_stats?.[offId] : null;
        const value = system.isOffRoad && offRoad ? offRoad : onRoad;
        const stats: { label: string, value: string | number }[] = [{ label: i18n('SR5.Redesign.Tooltip.Value'), value: value.value ?? 0 }];
        if (value.base !== undefined && value.base !== value.value) stats.push({ label: i18n('SR5.Redesign.Tooltip.Base'), value: value.base });
        if (offRoad && offRoad.value !== onRoad.value) {
            stats.push(system.isOffRoad
                ? { label: i18n('SR5.Vehicle.OnRoad'), value: onRoad.value ?? 0 }
                : { label: i18n('SR5.Vehicle.OffRoad'), value: offRoad.value ?? 0 });
        }
        const changes = (value.changes ?? []).filter(change => Number(change.value) !== 0);
        const breakdown = changes.length
            ? (await foundry.applications.handlebars.renderTemplate(SheetFlow.templateBase('common/modifiers-tooltip'), { value: { ...value, changes } })).trim() : '';
        const key = `vehicle_${id}`;
        const name = id === 'body' ? i18n('SR5.AttrBody') : id === 'armor' ? i18n('SR5.Armor.label') : i18n(SR5.vehicle.stats[id as keyof typeof SR5.vehicle.stats] ?? onRoad.label);
        return {
            icon: STAT_ICONS[key] ?? 'fa-circle-info',
            name,
            kind: i18n('SR5.Redesign.Rigging.StatKind'),
            // the road only matters when the two values differ
            detail: offRoad && offRoad.value !== onRoad.value ? i18n(system.isOffRoad ? 'SR5.Vehicle.OffRoad' : 'SR5.Vehicle.OnRoad') : '',
            stats,
            description: `<p>${i18n(`SR5.Redesign.StatInfo.${key}`)}</p>`,
            breakdown,
            tags: [],
            source: STAT_SOURCES[key] ?? '',
        };
    }

    // ---------- content ----------

    static async context(item: SR5Item) {
        const system = item.system as ItemCardSystem;
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const stats: { label: string, value: string | number }[] = [];
        const tags: string[] = [];
        const stat = (key: string, value: unknown) => {
            if (value === undefined || value === null || value === '') return;
            stats.push({ label: i18n(`SR5.Redesign.Tooltip.${key}`), value: value as string | number });
        };
        const signed = (value: number) => value > 0 ? `+${value}` : `${value}`;
        const valueOf = (field: CardNumber | undefined) => field?.value || field?.base || 0;
        const technology = system.technology;

        const kind = i18n(CONFIG.Item.typeLabels[item.type]);
        let detail = system.importFlags?.category ?? '';

        switch (item.type) {
            case 'weapon': {
                const damage = system.action?.damage;
                const type = damage?.type?.value ?? damage?.type?.base;
                const element = damage?.element?.value ?? damage?.element?.base;
                stat('Acc', valueOf(system.action?.limit) || undefined);
                stat('DV', damage ? `${valueOf(damage)}${type === 'stun' ? i18n('SR5.DmgCodeStun') : type === 'physical' ? i18n('SR5.DmgCodePhysical') : ''}${element ? `(${element[0]})` : ''}` : undefined);
                stat('AP', damage ? (valueOf(damage.ap) ? signed(valueOf(damage.ap)) : '–') : undefined);
                const range = system.range as { modes?: Record<string, boolean>; rc?: CardNumber } | undefined;
                if (system.category === 'range') {
                    const modes = Object.entries(SR5.rangeWeaponModeLabel as Record<string, string>)
                        .filter(([mode]) => range?.modes?.[mode === 'burst_file' ? 'burst_fire' : mode])
                        .map(([, label]) => i18n(label));
                    stat('Mode', modes.join('/') || undefined);
                    stat('RC', valueOf(range?.rc));
                    if (system.ammo?.current?.max) stat('Ammo', `${system.ammo.current.value}/${system.ammo.current.max}`);
                } else if (system.category === 'melee') {
                    stat('Reach', system.melee?.reach ?? 0);
                }
                detail ||= i18n(SR5.weaponCategories[system.category as keyof typeof SR5.weaponCategories]);
                break;
            }
            case 'armor':
                stat('Armor', `${system.armor?.accessory ? '+' : ''}${valueOf(system.armor)}`);
                break;
            case 'cyberware':
            case 'bioware': {
                // 0.37 keeps the computed essence under technology.calculated (also for the standalone module)
                const essence = valueOf(technology?.essence) || technology?.calculated?.essence?.value;
                stat('Essence', essence ? Helpers.formatEssence(essence) : undefined);
                if (system.grade) stat('Grade', i18n(SR5.cyberwareGrades[system.grade as keyof typeof SR5.cyberwareGrades]));
                break;
            }
            case 'device': {
                detail = i18n(SR5.deviceCategories[system.category as keyof typeof SR5.deviceCategories]) || detail;
                for (const att of Object.values(system.atts ?? {})) {
                    if (att?.value) stat(`Matrix.${att.att}`, att.value);
                }
                break;
            }
            // abbreviated like the rulebook entries: "Type: P  Range: LOS (A)  Damage: P  Duration: I  Drain: F – 1"
            case 'spell': {
                const category = i18n(SR5.spellCategories[system.category as keyof typeof SR5.spellCategories]);
                const combatType = system.category === 'combat' && system.combat?.type
                    ? i18n(SR5.combatSpellTypes[system.combat.type as keyof typeof SR5.combatSpellTypes]) : '';
                const element = system.category === 'combat' ? system.action?.damage?.element?.value || system.action?.damage?.element?.base : '';
                detail = [category, [combatType, element ? i18n('SR5.Redesign.Tooltip.Elemental') : ''].filter(Boolean).join(', ')]
                    .filter(Boolean).join(' · ') || detail;
                stat('Type', system.type ? i18n(`SR5.Redesign.Tooltip.Abbr.${system.type}`) : undefined);
                stat('Range', typeof system.range === 'string' && system.range ? i18n(`SR5.Redesign.Tooltip.Abbr.${system.range}`) : undefined);
                const damageType = system.category === 'combat' ? system.action?.damage?.type?.value || system.action?.damage?.type?.base : '';
                if (damageType === 'physical' || damageType === 'stun') stat('Damage', i18n(damageType === 'stun' ? 'SR5.DmgCodeStun' : 'SR5.DmgCodePhysical'));
                stat('Duration', system.duration ? i18n(`SR5.Redesign.Tooltip.Abbr.${system.duration}`) : undefined);
                stat('Drain', Helpers.formatForceValue(i18n('SR5.Redesign.Tooltip.Abbr.force'), system.drain));
                break;
            }
            // "Target: Persona  Duration: P  FV: L + 1"
            case 'complex_form':
                stat('Target', system.target ? i18n(SR5.matrixTargets[system.target as keyof typeof SR5.matrixTargets]) : undefined);
                stat('Duration', system.duration ? i18n(`SR5.Redesign.Tooltip.Abbr.${system.duration}`) : undefined);
                stat('FV', Helpers.formatForceValue(i18n('SR5.Redesign.Tooltip.Abbr.level'), system.fade));
                break;
            case 'adept_power':
                stat('PP', system.pp);
                if (system.level) stat('Level', system.level);
                if (system.type) stat('Type', i18n(SR5.adeptPower.types[system.type as keyof typeof SR5.adeptPower.types]));
                break;
            case 'critter_power':
                stat('Type', system.powerType ? i18n(`SR5.Redesign.Tooltip.Abbr.${system.powerType}`) : undefined);
                stat('Range', typeof system.range === 'string' && system.range ? i18n(SR5.critterPower.ranges[system.range as keyof typeof SR5.critterPower.ranges]) : undefined);
                stat('Duration', system.duration ? i18n(SR5.critterPower.durations[system.duration as keyof typeof SR5.critterPower.durations]) : undefined);
                break;
            case 'sprite_power':
                stat('Duration', system.duration ? i18n(SR5.spritePower.durations[system.duration as keyof typeof SR5.spritePower.durations]) : undefined);
                break;
            case 'quality':
                detail = system.type ? i18n(SR5.qualityTypes[system.type as keyof typeof SR5.qualityTypes]) : detail;
                if (system.karma) stat('Karma', system.karma);
                if (system.rating) stat('Rating', system.rating);
                break;
            case 'skill':
                return RichTooltip.#skillContext(item, i18n);
            // "Paramedic  Loyalty 4  Connection 2" (the L / C column's order), family / blackmail / group and the
            // linked actor as tags
            case 'contact': {
                detail = system.type || detail;
                stats.push({ label: i18n('SR5.Contact.Loyalty'), value: system.loyalty ?? 0 });
                stats.push({ label: i18n('SR5.Contact.Connection'), value: system.connection ?? 0 });
                for (const flag of ['family', 'blackmail', 'group'] as const) {
                    if (system[flag]) tags.push(i18n(`SR5.Contact.FIELDS.${flag}.label`));
                }
                const linked = system.linkedActor ? fromUuidSync(system.linkedActor) as { name?: string } | null : null;
                if (linked?.name) tags.push(`${i18n('SR5.Contact.LinkedActor')}: ${linked.name}`);
                break;
            }
            // the price (by the month, or bought outright) and the lifestyle points it is made of
            case 'lifestyle': {
                detail = system.type ? i18n(SR5.lifestyleTypes[system.type as keyof typeof SR5.lifestyleTypes]) : detail;
                // imported lifestyles may come without a price: no "0¥" then
                const cost = system.cost ? `${Number(system.cost).toLocaleString()}\u00a5` : '';
                if (cost) stats.push({ label: i18n('SR5.Redesign.Tooltip.Cost'), value: system.permanent ? cost : `${cost}${i18n('SR5.Lifestyle.PerMonth')}` });
                for (const field of ['comforts', 'security', 'neighborhood', 'guests'] as const) {
                    if (system[field]) stats.push({ label: i18n(`SR5.Lifestyle.FIELDS.${field}.label`), value: system[field] });
                }
                if (system.permanent) tags.push(i18n('SR5.Lifestyle.FIELDS.permanent.label'));
                break;
            }
        }

        // technology: rating, quantity, then availability and cost as tags (a price line)
        if (technology) {
            if (technology.rating && !stats.some(s => s.label === i18n('SR5.Redesign.Tooltip.Rating'))) stat('Rating', technology.rating);
            if ((technology.quantity ?? 0) > 1) stat('Qty', technology.quantity);
            if (technology.equipped) tags.push(i18n('SR5.Redesign.Tooltip.Equipped'));
            // 'none': the item has no wireless function, nothing to say
            const wireless = technology.wireless !== 'none' && SR5.wirelessModes[technology.wireless as keyof typeof SR5.wirelessModes];
            if (wireless) tags.push(i18n(wireless));
            // imported ware may keep Chummer's formula ("(Rating * 3)R") as its label: show it only when resolved
            // 0.37: a plain string, the computed one under technology.calculated
            const availability = typeof technology.availability === 'object' ? technology.availability : undefined;
            const avail = availability?.label || availability?.value || technology.calculated?.availability?.value
                || (typeof technology.availability === 'string' ? technology.availability : '');
            if (avail && avail !== '0' && !/rating/i.test(String(avail))) tags.push(`${i18n('SR5.Redesign.Tooltip.Avail')} ${avail}`);
            // 0.38: a prepared value; 0.37: the computed cost first, then the plain number
            const cost = (typeof technology.cost === 'object' ? valueOf(technology.cost) : 0) || technology.calculated?.cost?.value
                || (typeof technology.cost === 'number' ? technology.cost : 0);
            if (cost) tags.push(`${cost.toLocaleString()}¥`);
        }

        return {
            img: item.img,
            name: item.name,
            kind,
            detail: detail && detail !== kind ? detail : '',
            stats,
            tags,
            description: await RichTooltip.#description(item),
            source: system.description?.source ?? '',
        };
    }

    /**
     * Card of an active effect: what it belongs to, whether it applies now, how long, what it changes (valued the way
     * it is applied, formulas resolved) and the tests it is limited to.
     */
    static async effectContext(effect: SR5ActiveEffect) {
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const actor = effect.actor instanceof SR5Actor ? effect.actor : null;
        // under the name: the item it belongs to; its type when the effect is named like the item (Catlike » Catlike)
        const parent = effect.parent instanceof SR5Item ? effect.parent : null;
        const source = !parent ? '' : parent.name === effect.name ? i18n(CONFIG.Item.typeLabels[parent.type]) : parent.name;
        const targets = effect.effectiveTargets;
        const applyTo = [...new Set(targets.map(target => target.applyTo))]
            .map(applyTo => i18n(SR5.effectApplyTo[applyTo as keyof typeof SR5.effectApplyTo])).filter(Boolean).join(', ');
        const duration = prepareEffectDurationStatus(effect);
        const stats: { label: string, value: string | number }[] = [
            { label: i18n('SR5.Redesign.Tooltip.Status'), value: i18n(`SR5.Redesign.Tooltip.${effect.disabled ? 'Disabled' : effect.isSuppressed ? 'Suppressed' : 'Active'}`) },
            { label: i18n('SR5.Redesign.Tooltip.Duration'), value: duration.state === 'permanent' ? i18n('SR5.Redesign.Tooltip.Unlimited') : duration.summary },
        ];
        if (applyTo) stats.push({ label: i18n('SR5.Redesign.Tooltip.AppliesTo'), value: applyTo });

        // the changes as the system's modifier breakdown draws them: name on the left, the value on the right
        const escape = (text: string) => foundry.utils.escapeHTML(text);
        const rows = effect.system.changes.map(change => {
            const resolved = { ...change } as ActiveEffect.ChangeData;
            try { SR5ActiveEffect.resolveDynamicChangeValue(effect.parent ?? actor, resolved, actor ?? undefined); } catch { /* shown as written */ }
            return `<div class="list-item"><div class="value-modifier-name"><label>${escape(RichTooltip.#changeLabel(change.key, actor))}</label></div>`
                + `<div class="value-modifiers-modifier"><label>${escape(RedesignPool.change(String(change.type ?? 'add'), resolved.value))}</label></div></div>`;
        });
        const breakdown = rows.length
            ? `<div class="value-modifiers-container"><div class="value-modifiers">${rows.join('')}</div></div>` : '';

        // what it is limited to: "Skills: Perception", "Limits: Mental", "Tests: not Physical Resist"
        const tags: string[] = [];
        if (effect.system.onlyForEquipped) tags.push(i18n('SR5.ActiveEffect.FIELDS.onlyForEquipped.label'));
        if (effect.system.onlyForWireless) tags.push(i18n('SR5.ActiveEffect.FIELDS.onlyForWireless.label'));
        for (const condition of targets.flatMap(target => target.conditions ?? [])) {
            const values = (condition.values ?? []).map((value: string) => RichTooltip.#conditionValue(condition.type, value, actor));
            if (!values.length) continue;
            const not = condition.mode === 'exclude' ? `${i18n('SR5.Redesign.Tooltip.Not')} ` : '';
            tags.push(`${i18n(SR5.effectFilterTypes[condition.type as keyof typeof SR5.effectFilterTypes])}: ${not}${values.join(', ')}`);
        }

        const description = effect.description?.replace(/<[^>]+>/g, '').trim()
            ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(effect.description, { relativeTo: effect, secrets: effect.isOwner })
            : '';
        return {
            img: effect.img,
            name: effect.name,
            kind: i18n('SR5.Redesign.Tooltip.Effect'),
            detail: source,
            stats,
            description,
            breakdown,
            tags,
            source: '',
        };
    }

    /** What an effect change key changes, by name: 'system.limits.physical' → 'Physical limit', 'data.pool' → 'Pool'. */
    static #changeLabel(key: string, actor: SR5Actor | null): string {
        const i18n = (label?: string) => label && game.i18n.has(label) ? game.i18n.localize(label) : '';
        const path = key.replace(/^(system|data)\./, '');
        const [head, id, sub] = path.split('.');
        switch (head) {
            // test effects change the test itself
            case 'pool': return i18n('SR5.Redesign.Tooltip.Pool');
            case 'limit': return i18n('SR5.Redesign.Tooltip.Limit');
            // a modifier with a category name ('wounds' → 'Wounds'); the others fall through to their field label
            case 'modifiers': if (SR5.modifierTypes[id as keyof typeof SR5.modifierTypes]) return RedesignPool.label(id); break;
            case 'attributes': if (SR5.attributes[id as keyof typeof SR5.attributes]) return i18n(SR5.attributes[id as keyof typeof SR5.attributes]); break;
            case 'limits': return i18n(`SR5.Redesign.LimitLabel.${id}`) || i18n(SR5.limits[id as keyof typeof SR5.limits]);
            case 'armor':
                if (id === 'elements' && sub) {
                    const element = i18n(SR5.armorElementTypes[sub as keyof typeof SR5.armorElementTypes]) || i18n(SR5.elementTypes[sub as keyof typeof SR5.elementTypes]);
                    if (element) return element;
                    break;
                }
                return i18n('SR5.Redesign.ArmorRating');
            case 'initiative': {
                const category = i18n(SR5.initiativeCategories[id as keyof typeof SR5.initiativeCategories]);
                return `${i18n(sub === 'dice' ? 'SR5.Redesign.Tooltip.InitiativeDice' : 'SR5.Initiative')}${category ? ` (${category})` : ''}`;
            }
            case 'vehicle_stats': if (SR5.vehicle.stats[id as keyof typeof SR5.vehicle.stats]) return i18n(SR5.vehicle.stats[id as keyof typeof SR5.vehicle.stats]); break;
        }
        // other actor data: the field's own label, where the data model has one
        try {
            const models = CONFIG.Actor.dataModels as unknown as Record<string, { schema?: { getField(path: string): { label?: string } | undefined } } | undefined>;
            const field = models[actor?.type ?? 'character']?.schema?.getField(path);
            // Foundry localizes field labels when it prepares the data model: no key left to look up
            if (field?.label) return game.i18n.localize(field.label);
        } catch { /* no such field */ }
        return path;
    }

    /** A value an effect condition matches, by name: a test, an action category, a skill, an attribute or a limit. */
    static #conditionValue(type: string, value: string, actor: SR5Actor | null): string {
        const i18n = (label?: string) => label && game.i18n.has(label) ? game.i18n.localize(label) : '';
        switch (type) {
            case 'tests': return i18n((game.shadowrun5e.tests as Record<string, { label?: string }>)[value]?.label) || value;
            case 'categories': return i18n(SR5.actionCategories[value as keyof typeof SR5.actionCategories]) || value;
            // the actor's own skill first (its name as shown, custom skills too), else the system's skill list
            case 'skills': return (actor?.getSkill(value) as { label?: string } | undefined)?.label
                || i18n(SR5.activeSkills[value as keyof typeof SR5.activeSkills]) || value;
            case 'attributes': return i18n(SR5.attributes[value as keyof typeof SR5.attributes]) || value;
            case 'limits': return i18n(`SR5.Redesign.LimitLabel.${value}`) || i18n(SR5.limits[value as keyof typeof SR5.limits]) || value;
        }
        return value;
    }

    static async #skillContext(item: SR5Item, i18n: (key?: string) => string) {
        // a skill item (system 0.38): its skill data, the actor's prepared skill for the rest
        const skill = (item as SR5Item<'skill'>).system.skill;
        const actor = item.actor;
        const prepared = (item.id ? actor?.getSkill(item.id) : undefined) ?? actor?.getSkill(item.name);
        const rating = prepared?.value ?? skill.rating ?? 0;
        const attributeId = prepared?.attribute ?? skill.attribute;
        // the attribute the roll uses: a vehicle under a driver rolls the driver's (RiggingRules, in its roll data),
        // as getSkill above gives the driver's skill
        const driven = actor?.type === 'vehicle' && actor.isControlledByDriver();
        const attributes = (driven ? (actor.getRollData() as { attributes?: unknown }).attributes : actor?.system.attributes) as Record<string, { value?: number } | undefined> | undefined;
        const attribute = attributeId ? attributes?.[attributeId]?.value : undefined;
        const stats: { label: string, value: string | number }[] = [];
        const isLanguage = skill.category === 'language';
        const isNative = isLanguage && skill.language?.isNative;
        // same order as the skill tables: attribute, rating, pool
        if (attributeId) stats.push({ label: i18n('SR5.Redesign.Tooltip.Attribute'), value: i18n(`SR5.Redesign.AttrShort.${attributeId}`) });
        stats.push({ label: i18n('SR5.Redesign.Tooltip.Rating'), value: isNative ? i18n('SR5.Skill.abbr.Native') : rating });
        if (attribute !== undefined && !isNative) {
            // the pool as it will be rolled; the modifiers the roll adds (wounds, global) sit between rating and pool,
            // so the card adds up like the roll dialog
            const modifiers: { name: string, value: number }[] = (actor?.modifiers.totalsFor(ModifierFlow.actionModifierTypes({ test: 'SkillTest' })) ?? [])
                .filter(modifier => modifier.value);
            for (const modifier of modifiers) stats.push({ label: RedesignPool.label(modifier.name), value: RedesignPool.signed(modifier.value) });
            const pool = RedesignPool.rolled(prepared ? SkillRules.pool(prepared, attribute) : null, modifiers, '').pool;
            stats.push({ label: i18n('SR5.Redesign.Tooltip.Pool'), value: pool ?? '–' });
        }
        // the prepared skill's names, or the item's own entries ({ name })
        const specs: (string | { name?: string })[] = prepared?.specs ?? skill.specializations ?? [];
        // badge: Skill / Knowledge / Language; under the name: the skill group, or the knowledge type
        const kind = skill.category === 'active' || !skill.category ? i18n('SR5.Redesign.Tooltip.Skill')
            : i18n(SR5.skillCategories[skill.category as keyof typeof SR5.skillCategories]);
        const knowledgeType = skill.category === 'knowledge' && skill.knowledgeType
            ? i18n(SR5.knowledgeSkillCategories[skill.knowledgeType as keyof typeof SR5.knowledgeSkillCategories]) : '';
        const group = skill.group ? `${i18n('SR5.Redesign.Tooltip.Group')}: ${skill.group}` : knowledgeType;
        return {
            img: item.img,
            name: prepared?.label ?? item.name,
            kind,
            detail: group,
            stats,
            tags: specs.map(spec => typeof spec === 'string' ? spec : (spec as { name?: string }).name ?? ''),
            tagsLabel: specs.length ? i18n('SR5.Redesign.Tooltip.Specializations') : '',
            description: await RichTooltip.#description(item),
            source: (item.system as { description?: { source?: string } }).description?.source ?? '',
        };
    }

    /**
     * A vehicle or drone (the vehicles tab's rows): what it is, the book's stat line (on-road / off-road where they
     * differ), seats, its control mode, its driver, and its description (its damage is the expanded row's).
     */
    static async vehicleContext(vehicle: SR5Actor) {
        const system = (vehicle as SR5Actor<'vehicle'>).system;
        const i18n = (key?: string) => key ? game.i18n.localize(key) : '';
        const value = (field: { value?: number } | undefined) => field?.value ?? 0;
        const pair = (on: { value?: number } | undefined, off: { value?: number } | undefined) =>
            value(off) && value(off) !== value(on) ? `${value(on)}/${value(off)}` : `${value(on)}`;
        const stats_ = system.vehicle_stats;
        const stats: { label: string, value: string | number }[] = [
            { label: i18n('SR5.Vehicle.Stats.Handling'), value: pair(stats_.handling, stats_.off_road_handling) },
            { label: i18n('SR5.Vehicle.Stats.Speed'), value: pair(stats_.speed, stats_.off_road_speed) },
            { label: i18n('SR5.Vehicle.Stats.Acceleration'), value: pair(stats_.acceleration, stats_.off_road_acceleration) },
            { label: i18n('SR5.AttrBody'), value: value(system.attributes?.body) },
            { label: i18n('SR5.Armor.label'), value: value(system.armor.rating) },
            { label: i18n('SR5.Vehicle.Stats.Pilot'), value: value(stats_.pilot) },
            { label: i18n('SR5.Vehicle.Stats.Sensor'), value: value(stats_.sensor) },
        ];
        if (value(stats_.seats)) stats.push({ label: i18n('SR5.Vehicle.Stats.Seats'), value: value(stats_.seats) });
        const categories = SR5.vehicle.categories as Record<string, string>;
        const detail = system.isDrone
            ? i18n(categories[system.category]) || system.importFlags?.category || ''
            : system.importFlags?.category || i18n((SR5.vehicle.types as Record<string, string>)[system.vehicleType]);
        const tags = [i18n((SR5.vehicle.control_modes as Record<string, string>)[system.controlMode])];
        const driver = vehicle.getVehicleDriver();
        if (driver) tags.push(`${i18n('SR5.Vehicle.Driver')}: ${driver.name}`);
        const raw = system.description?.value ?? '';
        const description = raw.replace(/<[^>]+>/g, '').trim()
            ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, { relativeTo: vehicle, secrets: vehicle.isOwner })
            : '';
        return {
            img: vehicle.img,
            name: vehicle.name,
            kind: i18n(system.isDrone ? 'SR5.Vehicle.Drone' : 'SR5.Vehicle.Vehicle'),
            detail,
            stats,
            description,
            tags: tags.filter(Boolean),
            source: system.description?.source ?? '',
        };
    }

    static async #description(item: SR5Item) {
        const raw = (item.system as { description?: { value?: string } }).description?.value ?? '';
        if (!raw.replace(/<[^>]+>/g, '').trim()) return '';
        return foundry.applications.ux.TextEditor.implementation.enrichHTML(raw, { relativeTo: item, secrets: item.isOwner });
    }
}
