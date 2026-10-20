import { SR5Actor } from '@/module/actor/SR5Actor';
import { SR5Item } from '@/module/item/SR5Item';
import { SR5 } from '@/module/config';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { NetworkManager } from '@/module/apps/NetworkManager';
import type { NetworkManagerData } from '@/module/apps/NetworkManager';
import { PromptDialog } from '@/module/apps/dialogs/PromptDialog';
import type { PromptDialogOptions } from '@/module/apps/dialogs/PromptDialog';
import { MatrixDamageFlow } from '@/module/flows/MatrixDamageFlow';
import { wireListFilterMenu } from '@/module/actor/sheets/RedesignListControls';

const sheetTemplate = (path: string) => SheetFlow.templateBase(`actor/redesign/${path}`);

/** One network in the manager: what it is, and what the actor can do with it. */
interface NetworkRow {
    uuid: string;
    name: string;
    img: string;
    detail: string;
    /** a host whose rating the user does not know ("Rating ?") */
    detailUnknown: boolean;
    /** sort key of the rating mode: a host's rating, a grid's reach (local < global < public) */
    rank: number;
    /** filter ids the row matches (NETWORK_FILTERS) */
    filters: string;
    hidden: boolean;
    /** the hover card (redesign/tooltip.hbs) */
    tooltip: string;
    connected: boolean;
    canConnect: boolean;
    canMark: boolean;
}

/** Order of the grid categories in the rating sort, the widest last (a grid has no rating of its own). */
const GRID_RANKS: Record<string, number> = { local: 1, global: 2, public: 3 };

/**
 * The filter menu: options of one group are alternatives (any of them), different groups all have to match, like
 * the sheet's list search. Visibility only for the GM: players see the visible networks alone.
 */
const NETWORK_FILTERS: { label: string; gm?: boolean; chips: { id: string; label: string; icon?: string }[] }[] = [
    { label: 'SR5.Redesign.NetworkManager.Filter.Access', chips: [
        { id: 'connect', label: 'SR5.ConnectToNetwork', icon: 'fa-right-to-bracket' },
        { id: 'mark', label: 'SR5.Redesign.NetworkManager.Filter.Mark', icon: 'fa-door-open' },
    ] },
    { label: 'SR5.Redesign.NetworkManager.Filter.GridType', chips: [
        { id: 'local', label: 'SR5.Labels.Matrix.Local' },
        { id: 'global', label: 'SR5.Labels.Matrix.Global' },
        { id: 'public', label: 'SR5.Labels.Matrix.Public' },
    ] },
    { label: 'SR5.Redesign.NetworkManager.Filter.Visibility', gm: true, chips: [
        { id: 'visible', label: 'SR5.Redesign.NetworkManager.Filter.Visible', icon: 'fa-eye' },
        { id: 'hidden', label: 'SR5.Redesign.NetworkManager.Filter.Hidden', icon: 'fa-eye-slash' },
    ] },
] as const;

/** Modes of the sort button, in the order it cycles through them. */
const NETWORK_SORT_MODES = [
    { label: 'SR5.Redesign.ListSort.NameAsc', icon: 'fa-arrow-down-a-z', key: 'name', dir: 1 },
    { label: 'SR5.Redesign.ListSort.NameDesc', icon: 'fa-arrow-down-z-a', key: 'name', dir: -1 },
    { label: 'SR5.Redesign.ListSort.RatingDesc', icon: 'fa-arrow-down-wide-short', key: 'rank', dir: -1 },
] as const;

/** Rulebook pages of the cards' rules lines (SR5 233-234: grids, 246-247: hosts). */
const GRID_SOURCE = 'SR5 233';
const HOST_SOURCE = 'SR5 246';

/**
 * The hover card of a network, in the sheet's rich card (redesign/tooltip.hbs): what the system knows of it (type or
 * rating and, for the GM, whether players see it in the head; a host's attributes and IC, the actor's marks, other
 * icons on it), the GM's description, then the rules that apply to it, with the page.
 */
async function networkCard(network: SR5Item, actor: SR5Actor): Promise<string> {
    const i18n = (key: string) => game.i18n.localize(key);
    const stats: { label: string; value: string | number }[] = [];
    const rules: string[] = [];
    let tags: string[] = [];
    const known = knowsDetails(network);
    if (network.isType('host')) {
        if (known) for (const att of Object.values(network.system.atts ?? {}) as { att: string; value: number }[]) {
            const label = SR5.matrixAttributes[att.att as keyof typeof SR5.matrixAttributes];
            if (label) stats.push({ label: i18n(label), value: att.value });
        }
        if (known) tags = network.getIC().map(ic => ic.name ?? '');
        rules.push(i18n('SR5.Redesign.NetworkManager.Rules.HostEnter'), i18n('SR5.Redesign.NetworkManager.Rules.HostShare'),
            i18n('SR5.Redesign.NetworkManager.Rules.HostConvergence'));
    } else if (network.isType('grid')) {
        const category = network.system.category;
        rules.push(i18n(`SR5.Redesign.NetworkManager.Rules.Grid${category.capitalize()}`),
            i18n('SR5.Redesign.NetworkManager.Rules.GridCross'), i18n('SR5.Redesign.NetworkManager.Rules.GridHop'));
    }
    const marks = actor.getMarksPlaced(network.uuid ?? '');
    if (marks) stats.push({ label: i18n('SR5.Redesign.NetworkManager.YourMarks'), value: marks });
    // icons on the network besides its IC (the tags list those)
    const icons = known ? network.slaves.filter(slave => slave.type !== 'ic').length : 0;
    if (icons) stats.push({ label: i18n('SR5.Redesign.NetworkManager.Icons'), value: icons });
    // the head: type and rating as in the row, for the GM whether players see it
    const detail = [networkDetail(network), game.user?.isGM ? i18n(network.matrixIconVisibleToPlayer()
        ? 'SR5.Redesign.NetworkManager.Filter.Visible' : 'SR5.Redesign.NetworkManager.Filter.Hidden') : '']
        .filter(Boolean).join(' · ');

    // what the players do not see: for the GM a line on how to share it, for a player the way to learn it
    // not a rule: a note under them, quieter
    let note = '';
    if (network.isType('host')) {
        const playersKnow = game.users.some(user => !user.isGM && network.testUserPermission(user, 'OBSERVER'));
        if (!known) note = i18n('SR5.Redesign.NetworkManager.Rules.Perception');
        else if (game.user?.isGM) note = i18n(playersKnow ? 'SR5.Redesign.NetworkManager.Rules.PlayersKnow'
            : 'SR5.Redesign.NetworkManager.Rules.PlayersDontKnow');
    }
    const text = known && network.system.description?.value
        ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(network.system.description.value, { relativeTo: network })
        : '';
    return foundry.applications.handlebars.renderTemplate(sheetTemplate('tooltip'), {
        img: network.img,
        name: network.name,
        detail,
        kind: i18n(`TYPES.Item.${network.type}`),
        stats,
        description: `${text}<ul class="sr-rich-rules">${rules.map(rule => `<li>${rule}</li>`).join('')}</ul>`
            + (note ? `<p class="sr-rich-note"><i class="fas fa-eye-slash" aria-hidden="true"></i>${note}</p>` : ''),
        tags,
        tagsLabel: tags.length ? i18n('SR5.Redesign.NetworkManager.IC') : '',
        source: network.isType('host') ? HOST_SOURCE : GRID_SOURCE,
    });
}

/** Debounce of the search field, as the sheet's (LIST_SEARCH_DELAY_MS there). */
const SEARCH_DELAY_MS = 120;

/**
 * Whether the user may see what a network keeps to itself: a host's rating, attributes and IC, the GM's description,
 * the icons on it. Players learn those by Matrix Perception, one per hit (SR5 235); the GM shares them by giving the
 * player Observer access to the network, as for any document. Name, type, a grid's kind and the rules are common
 * knowledge, the actor's own marks it always knows.
 */
function knowsDetails(network: SR5Item): boolean {
    return (game.user?.isGM ?? false) || network.testUserPermission(game.user!, 'OBSERVER');
}

/** The type of a network for its row and the connection banner: a grid's category, a host's rating (if known). */
function networkDetail(network: SR5Item): string {
    if (network.isType('host')) return `${game.i18n.localize('SR5.Rating')} ${knowsDetails(network) ? network.system.rating : '?'}`;
    const category = network.isType('grid') ? SR5.gridCategories[network.system.category] : undefined;
    return category ? game.i18n.localize(category) : '';
}

/**
 * The system's network manager in the SR5 Redesign look (the sheet opens it with `sr5-redesign-app`). The upstream
 * window lists a network up to twice, once to connect and once to place a mark; here every network has one row in
 * a Grids or a Hosts table, with the actions the actor has on it: place a mark (visible networks, no public grids)
 * and connect (networks the actor can reach). The current network sits on top, with a disconnect button, and keeps
 * its row, marked. Over the tables a search, a filter menu and a sort button like the sheet's list search: they work
 * in place on the rendered rows (no render while typing) and keep their state through renders of the window.
 */
export class RedesignNetworkManager extends NetworkManager {
    static override PARTS = {
        details: { template: sheetTemplate('apps/network-manager') },
    // the details part only: the footer's buttons are in the rows here
    } as unknown as typeof NetworkManager.PARTS;

    static override DEFAULT_OPTIONS = {
        position: { width: 540, height: 'auto' as const },
        window: { resizable: false },
        actions: {
            disconnectNetwork: RedesignNetworkManager.#disconnectNetwork,
            toggleNetworkFilter: RedesignNetworkManager.#toggleFilter,
            clearNetworkFilters: RedesignNetworkManager.#clearFilters,
            cycleNetworkSort: RedesignNetworkManager.#cycleSort,
        },
    // Foundry merges these into the parent's (its classes, form and actions stay)
    } as unknown as typeof NetworkManager.DEFAULT_OPTIONS;

    #query = '';
    #chips = new Set<string>();
    #sortMode = 0;

    override async _prepareContext(options: Parameters<NetworkManager['_prepareContext']>[0]) {
        const context = await super._prepareContext(options) as NetworkManagerData & Record<string, unknown>;
        const connected: SR5Item | null = context.connected_network;
        const reachable = new Set(context.selectable_networks.map(network => network.uuid));
        const markable = new Set([...context.grids, ...context.hosts].map((network: SR5Item) => network.uuid));

        const networks = new Map<string, SR5Item>();
        for (const network of [...context.selectable_networks, ...context.grids, ...context.hosts, connected]) {
            if (network?.uuid) networks.set(network.uuid, network);
        }
        const actor = this.document as SR5Actor;
        const cards = new Map(await Promise.all([...networks.values()].map(async network =>
            [network.uuid, await networkCard(network, actor)] as const)));
        const rows = (type: 'grid' | 'host') => [...networks.values()]
            .filter(network => network.type === type)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((network): NetworkRow => {
                const canConnect = reachable.has(network.uuid) && network.uuid !== connected?.uuid;
                const canMark = markable.has(network.uuid);
                const hidden = !network.matrixIconVisibleToPlayer();
                const category = network.isType('grid') ? network.system.category : '';
                return {
                    uuid: network.uuid ?? '',
                    name: network.name,
                    img: network.img ?? '',
                    detail: networkDetail(network),
                    detailUnknown: network.isType('host') && !knowsDetails(network),
                    // an unknown rating sorts last, and tells nothing
                    rank: network.isType('host') ? (knowsDetails(network) ? network.system.rating : 0) : GRID_RANKS[category] ?? 0,
                    filters: [canConnect && 'connect', canMark && 'mark', category, hidden ? 'hidden' : 'visible'].filter(Boolean).join(' '),
                    hidden,
                    tooltip: cards.get(network.uuid) ?? '',
                    connected: network.uuid === connected?.uuid,
                    canConnect,
                    canMark,
                };
            });

        context.gridRows = rows('grid');
        context.hostRows = rows('host');
        context.rootId = this.id; // ids of the search field and the filter menu (a document sheet's context has it)
        context.isGM = game.user?.isGM ?? false;
        context.filterGroups = NETWORK_FILTERS.filter(group => !('gm' in group) || context.isGM);
        context.connection = connected ? {
            uuid: connected.uuid,
            name: connected.name,
            img: connected.img,
            type: game.i18n.localize(`TYPES.Item.${connected.type}`),
            detail: networkDetail(connected),
        } : null;
        return context;
    }

    override async _onRender(...args: Parameters<NetworkManager['_onRender']>) {
        await super._onRender(...args);
        // tooltips in the sheet's style and theme (SR5CharacterSheetRedesign#enhanceAccessibility, RichTooltip)
        for (const el of this.element.querySelectorAll<HTMLElement>('[data-tooltip], [data-tooltip-html]')) {
            if (!el.dataset.tooltipClass) el.dataset.tooltipClass = 'sr5-redesign-tooltip';
        }
        const controls = this.element.querySelector<HTMLElement>('.network-controls');
        if (!controls) return;
        const input = controls.querySelector<HTMLInputElement>('.list-search-input')!;
        const menu = controls.querySelector<HTMLElement>('.list-filter-menu')!;
        const button = controls.querySelector<HTMLElement>('.list-filter-button')!;
        wireListFilterMenu(menu, button);
        input.value = this.#query;
        let timer: number | undefined;
        input.addEventListener('input', () => {
            this.#query = input.value;
            window.clearTimeout(timer);
            timer = window.setTimeout(() => this.#applyView(), SEARCH_DELAY_MS);
        });
        input.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || !input.value) return;
            event.preventDefault();
            event.stopPropagation(); // keep the window open: Escape only clears the search
            input.value = this.#query = '';
            this.#applyView();
        });
        this.#applyView();
        if (args[1].isFirstRender) input.focus();
    }

    /** Search, filters and sort on the rendered rows: rows that do not match hide, a table without rows too. */
    #applyView() {
        const root = this.element;
        const query = this.#query.trim().toLocaleLowerCase();
        const groups = NETWORK_FILTERS.map(group => group.chips.map(chip => chip.id).filter(id => this.#chips.has(id)))
            .filter(ids => ids.length);
        const mode = NETWORK_SORT_MODES[this.#sortMode];
        let shown = 0;
        let total = 0;
        for (const table of root.querySelectorAll<HTMLElement>('.network-table')) {
            const rows = Array.from(table.querySelectorAll<HTMLElement>('.network-row:not(.empty)'));
            rows.sort((a, b) => {
                const byName = (a.dataset.name ?? '').localeCompare(b.dataset.name ?? '');
                // the rating mode: highest first, then by name
                if (mode.key === 'rank') return Number(b.dataset.rank) - Number(a.dataset.rank) || byName;
                return byName * mode.dir;
            });
            let visible = 0;
            for (const row of rows) {
                const filters = (row.dataset.filters ?? '').split(' ');
                const match = (!query || (row.dataset.name ?? '').toLocaleLowerCase().includes(query))
                    && groups.every(ids => ids.some(id => filters.includes(id)));
                row.classList.toggle('filter-hidden', !match);
                table.append(row);
                if (match) visible++;
            }
            shown += visible;
            total += rows.length;
            // a filtered-out table hides; an empty one keeps its "no grids" line while nothing filters
            const filtering = !!query || groups.length > 0;
            table.classList.toggle('filter-hidden', filtering && visible === 0);
        }
        root.querySelector<HTMLElement>('.network-no-match')!.hidden = shown > 0 || (!query && !groups.length);
        // the controls tell what is on: filter button filled with the count, sort button its mode
        const button = root.querySelector<HTMLElement>('.list-filter-button')!;
        button.classList.toggle('active', this.#chips.size > 0);
        button.setAttribute('aria-label', this.#chips.size
            ? `${game.i18n.localize('SR5.Redesign.ListFilters')}: ${game.i18n.format('SR5.Redesign.ListFiltersOn', { count: this.#chips.size })}`
            : game.i18n.localize('SR5.Redesign.ListFilters'));
        for (const option of root.querySelectorAll<HTMLElement>('.list-filter-option[data-filter]')) {
            option.setAttribute('aria-checked', String(this.#chips.has(option.dataset.filter!)));
        }
        const sort = root.querySelector<HTMLElement>('[data-action="cycleNetworkSort"]')!;
        sort.dataset.tooltip = mode.label;
        sort.setAttribute('aria-label', `${game.i18n.localize('SR5.Redesign.ListSort.Label')}: ${game.i18n.localize(mode.label)}`);
        sort.querySelector('i')!.className = `fas ${mode.icon}`;
        root.querySelector<HTMLElement>('.network-count')!.textContent =
            game.i18n.format('SR5.Redesign.ListCount', { shown, total });
    }

    static #toggleFilter(this: RedesignNetworkManager, event: PointerEvent, target: HTMLElement) {
        const id = target.dataset.filter;
        if (!id) return;
        if (this.#chips.has(id)) this.#chips.delete(id); else this.#chips.add(id);
        this.#applyView();
    }

    static #clearFilters(this: RedesignNetworkManager, event: PointerEvent, target: HTMLElement) {
        this.#chips.clear();
        this.#applyView();
        target.closest<HTMLElement>('[popover]')?.hidePopover();
    }

    static #cycleSort(this: RedesignNetworkManager, event: PointerEvent, target: HTMLElement) {
        this.#sortMode = (this.#sortMode + 1) % NETWORK_SORT_MODES.length;
        this.#applyView();
        if (game.tooltip?.element === target) game.tooltip.activate(target); // the tooltip follows the new mode
    }

    static async #disconnectNetwork(this: RedesignNetworkManager) {
        await (this.document as SR5Actor).disconnectNetwork();
        void this.document.sheet?.render();
        await this.render();
    }
}

/**
 * Whether the actor runs the Baby Monitor program, which keeps its user aware of the Overwatch Score (SR5 245). The
 * system has no marker for it: the program is found by its English name, loaded (equipped) on the actor.
 */
function runsBabyMonitor(actor: SR5Actor): boolean {
    return actor.items.some(item => item.type === 'program' && /baby\s*monitor/i.test(item.name ?? '') && item.isEquipped());
}

/** The reboot prompt: the keyboard starts on Cancel, the safe answer (the upstream dialog leaves the focus behind). */
class RebootDialog extends PromptDialog {
    protected override async _onRender(context: object, options: object) {
        await super._onRender(context, options);
        this.element.querySelector<HTMLElement>('[data-application-part="footer"] button.cancel')?.focus();
    }
}

/**
 * Asks before rebooting the actor's persona device, in the SR5 Redesign look: the device, what a reboot does to the
 * actor (the system's MatrixRebootFlow: marks cleared, with them a network entered by one, Overwatch Score reset,
 * dumpshock in VR) and, when link-locked, why it cannot. Resolves true when the user confirmed.
 */
export async function confirmPersonaReboot(actor: SR5Actor, { classes, icon }: {
    /** the sheet's look and theme */
    classes: string[];
    /** the device's icon on the sheet's device card */
    icon: string;
}): Promise<boolean> {
    const device = actor.getMatrixDevice();
    // dumpshock only in VR: 6S cold sim, 6P hot sim, resisted with Willpower + Firewall, then −2 dice for
    // (10 − Willpower) minutes (SR5 229); the system applies the damage, the card tells the rest
    const dumpshock = actor.isUsingVR ? {
        damage: MatrixDamageFlow.getDumpshockDamage(actor),
        mode: game.i18n.localize(actor.isUsingHotSim ? 'SR5.Redesign.Reboot.HotSim' : 'SR5.Redesign.Reboot.ColdSim'),
        minutes: Math.max(0, 10 - (actor.getAttribute('willpower')?.value ?? 0)),
    } : null;
    const templateData = {
        device: device ? {
            name: device.name,
            icon,
            detail: [
                device.isType('device') && device.system.category ? game.i18n.localize(SR5.deviceCategories[device.system.category]) : '',
                `${game.i18n.localize('SR5.Redesign.MatrixDevice.RatingShort')} ${device.getRating()}`,
            ].filter(Boolean).join(' · '),
        } : null,
        // the GM keeps the Overwatch Score secret; a running Baby Monitor shows it to its user (SR5 231, 245)
        overwatch: actor.getOverwatchScore(),
        overwatchShown: (game.user?.isGM ?? false) || runsBabyMonitor(actor),
        overwatchGmOnly: (game.user?.isGM ?? false) && !runsBabyMonitor(actor),
        // a network entered with a mark is left with it (SR5Actor#clearMarks)
        disconnects: actor.network && actor.marksData?.some(mark => mark.uuid === actor.network?.uuid) ? actor.network.name : '',
        marked: actor.getAllMarkedDocuments().length,
        dumpshock,
        linkLocked: actor.isLinkLocked,
    };
    // a link-locked persona cannot reboot (the flow refuses after the fact): no Reboot button then
    const buttons: Record<string, { label: string }> = {};
    if (!templateData.linkLocked) buttons.confirm = { label: game.i18n.localize('SR5.RebootConfirmationDialog.Confirm') };
    buttons.cancel = { label: game.i18n.localize('SR5.RebootConfirmationDialog.Cancel') };

    const dialog = new RebootDialog({
        title: game.i18n.localize('SR5.RebootConfirmationDialog.Title'),
        buttons,
        default: 'cancel',
        templateData,
        templatePath: sheetTemplate('apps/reboot-confirmation'),
    // window: only what changes (Foundry merges it into the defaults)
    }, { classes: ['reboot-dialog', ...classes], position: { width: 420, height: 'auto' }, window: { resizable: false } } as PromptDialogOptions);
    await dialog.select();
    return !dialog.canceled && dialog.selectedButton === 'confirm';
}
