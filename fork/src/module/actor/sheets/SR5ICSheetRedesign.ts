import { SR5RedesignActorSheet } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import type { PreparedSheetSystem, RedesignPartContext } from '@/module/actor/sheets/redesign/RedesignActorSheet';
import { SR5ICActorSheet } from '@/module/actor/sheets/SR5ICActorSheet';
import { InitiativeRules } from '@/module/rules/InitiativeRules';
import { icHost } from '@/module/actor/sheets/redesign/RedesignIC';
import { SR5Actor } from '@/module/actor/SR5Actor';
import { SR5Item } from '@/module/item/SR5Item';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { SR5 } from '@/module/config';
import HandlebarsApplicationMixin = foundry.applications.api.HandlebarsApplicationMixin;

const sheetTemplate = (path: string) => SheetFlow.templateBase(`actor/redesign/${path}`);

/** The character sheet's parts an IC shows: its plates, the sidebar, the Matrix tab as its own, effects, notes, setup. */
const IC_PART_IDS = new Set([
    'header', 'sidebar', 'abilities', 'tabs', 'matrix', 'matrixActions', 'networkIcons', 'markedIcons',
    'effects', 'description', 'misc', 'collapser', 'footer',
]);

/** The plates over the IC tab: the host's rating, then the four matrix attributes the host gives the IC (SR5#247). */
const IC_PLATES = ['rating', 'attack', 'sleaze', 'data_processing', 'firewall'] as const;

/** An IC's prepared system data. */
type ICSystem = SR5Actor<'ic'>['system'];
const icSystem = (context: { system?: unknown }) => context.system as ICSystem;
/** The system fields of the plates: the host's rating and its four attributes as the IC keeps them, for the edit boxes. */
type PlateFields = {
    host?: { fields?: { rating?: unknown, atts?: { fields?: Record<string, { fields?: { value?: unknown } } | undefined> } } };
};

interface ICPlateData {
    id: string;
    short: string;
    label: string;
    value: number;
    base: number;
    field: unknown;
    /** edit mode: changed here only while no host gives it (a host's IC takes its rating and attributes) */
    editable: boolean;
}

/**
 * EXPERIMENTAL (lab/ic-sheet): the SR5 Redesign for IC.
 *
 * The character sheet's frame, render pipeline, tables, tooltips and accessibility, with the IC's own content: its
 * type and host in the header line, plates for the host's rating and the four matrix attributes, the matrix track and
 * the initiative (Host Rating × 2 + 4D6) in the sidebar, the Matrix tab as its main tab (its host, the icons it knows
 * and marked, its own actions), effects, description and configuration. The IC logic is the upstream IC sheet's
 * (SR5ICActorSheet): its actions by IC type, a host dropped on it.
 */
export class SR5ICSheetRedesign extends SR5RedesignActorSheet {
    static override DEFAULT_OPTIONS = {
        ...SR5RedesignActorSheet.DEFAULT_OPTIONS,
        // the IC's layout: its plates over the IC tab (actor-redesign.scss)
        classes: [...SR5RedesignActorSheet.DEFAULT_OPTIONS.classes, 'sr5-redesign-ic'],
    };

    static override TABS = {
        ...SR5RedesignActorSheet.TABS,
        primary: {
            initial: 'matrix',
            tabs: [
                // the eye: what an IC does (it watches the host for intruders, as the system's IC token art shows)
                { id: 'matrix', label: 'SR5.Tabs.Actor.IC', icon: 'fas fa-eye', tooltip: 'SR5.Tabs.Actor.IC', cssClass: '' },
                { id: 'effects', label: 'SR5.Tabs.Actor.Effects', icon: 'fas fa-bolt-lightning', tooltip: 'SR5.Tabs.Actor.Effects', cssClass: '' },
                { id: 'description', label: 'SR5.Description', icon: 'fas fa-info', tooltip: 'SR5.Tooltips.Actor.Description', cssClass: '' },
                { id: 'misc', label: 'SR5.Redesign.Tabs.Misc', icon: 'fas fa-gear', tooltip: 'SR5.Redesign.Tabs.Misc', cssClass: '' },
            ],
        },
    };

    // the character's parts in the character's order (the render pipeline sorts by it), the plates with the IC's template
    static override PARTS = Object.fromEntries(Object.entries(SR5RedesignActorSheet.PARTS as Record<string, HandlebarsApplicationMixin.HandlebarsTemplatePart>)
        .filter(([id]) => IC_PART_IDS.has(id))
        .map(([id, part]) => id === 'abilities' ? [id, { template: sheetTemplate('ic-stats') }] : [id, part])) as typeof SR5RedesignActorSheet.PARTS;

    /** As the upstream IC sheet: the IC pack's actions of its type (Killer IC: Killer). */
    protected override async _getMatrixPackActions() {
        return (SR5ICActorSheet.prototype as unknown as { _getMatrixPackActions(this: SR5ICSheetRedesign): Promise<SR5Item<'action'>[]> })
            ._getMatrixPackActions.call(this);
    }

    /** The general actions' quick rolls are a character's (physical tests); an IC rolls its own action from its tab. */
    protected override _quickRolls() {
        return {};
    }

    /** A host dropped on the sheet: the IC runs on it (the upstream IC sheet's drop). */
    override async _onDropItem(event: DragEvent, item: SR5Item) {
        if (item.isType('host')) {
            await this.actor.connectNetwork(item);
            return null;
        }
        return super._onDropItem(event, item);
    }

    /** No contacts or drivers for IC: an actor dropped on it does nothing. */
    override async _onDropActor() {
        return null;
    }

    override async _prepareContext(options: Parameters<SR5RedesignActorSheet['_prepareContext']>[0]) {
        const data = await super._prepareContext(options) as RedesignPartContext;
        const system = icSystem(data);
        data.isIC = true;
        data.isCharacter = false;
        // the header line: its type and the host it runs on; no archetype or karma / nuyen / reputation of a character's
        // an unlinked token's copy: its base actor's host (icHost)
        const running = icHost(this.actor);
        const host = running?.host ?? null;
        data.icKind = {
            type: game.i18n.localize((SR5.icTypes as Record<string, string>)[system.icType] ?? ''),
            host: host?.name ?? '',
        };
        data.archetype = '';
        data.footerLedgers = { karma: false, nuyen: false, reputation: false };
        data.attributeGroups = [];
        data.icPlates = this.#plates(data, !!host);
        data.attributeLimits = [];
        // the footer: the host (its rating) and where the IC stands in the host's IC (the order it is launched in)
        const ic = host ? host.getIC() : [];
        const position = ic.findIndex(entry => entry.uuid === running?.connected.uuid) + 1;
        // and the icons the host holds marks on: its IC share them with it (SR5#247)
        data.icFooter = host ? {
            // the host's own rating (the IC keeps a copy of it, which the system updates when the host changes)
            name: host.name, uuid: host.uuid, rating: (host.system as { rating?: number }).rating ?? 0,
            position, count: ic.length, marks: host.getAllMarkedDocuments().length,
        } : null;
        // no action to roll (the system leaves out attacks while Attack is 0, an IC on no host): play mode drops the
        // actions column (edit mode keeps it, to add one)
        data.icNoActions = this.isPlayMode && !(await this._prepareMatrixActions()).length;
        return data;
    }

    override async _preparePartContext(...[partId, context, options]: Parameters<SR5RedesignActorSheet['_preparePartContext']>) {
        const partContext = await super._preparePartContext(partId, context, options) as RedesignPartContext;
        // one initiative, no menu (setInitiativeMode is for characters and spirits): Host Rating × 2 + 4D6 (SR5#247)
        if (partId === 'sidebar') {
            const formula = InitiativeRules.vehicleFormula('own', icSystem(partContext).initiative as { current?: object }, undefined);
            partContext.initiativeModes = [{ value: 'matrix', label: 'SR5.Host.Rating', icon: 'fa-server', formula, active: true }];
            partContext.initiativeMode = partContext.initiativeModes[0];
        }
        // the Matrix tab's device plaque: an IC is a program of its host, its plaque says which one (no device to switch)
        if (partId === 'matrix') partContext.matrixDeviceSwitch = {
            label: icSystem(partContext).icType ? (partContext.icKind as { type: string }).type : this.actor.name,
            icon: 'fa-eye',
            choices: [],
            hasDeck: false,
        };
        // the configuration tab: the full defense attribute is a character's
        if (partId === 'misc') partContext.hasFullDefense = false;
        return partContext;
    }

    /** The matrix track only: an IC has no physical or stun track (SR5#247), and no recovery roll. */
    override _prepareMonitors(context: RedesignPartContext) {
        const matrix = (context.system as PreparedSheetSystem).track?.matrix;
        if (!matrix || matrix.disabled || !(matrix.max > 0)) return [];
        return [{
            id: 'matrix', label: game.i18n.localize('SR5.Redesign.MatrixMonitor'), icon: 'fa-microchip', rollable: false,
            value: matrix.value, max: matrix.max, columns: SR5RedesignActorSheet._monitorColumns(matrix.max), cells: this._cells(matrix.value, matrix.max),
        }];
    }

    /** The plates: the host's rating, then attack, sleaze, data processing and firewall (the host's when it has one). */
    #plates(data: RedesignPartContext, hasHost: boolean): ICPlateData[] {
        const system = icSystem(data);
        const fields = data.systemFields as PlateFields | undefined;
        const source = this.actor._source.system as { host?: { rating?: number, atts?: Record<string, { att?: string, value?: number } | undefined> } };
        const matrix = system.matrix as unknown as Record<string, { value?: number; base?: number } | undefined>;
        return IC_PLATES.map(id => {
            const label = game.i18n.localize(id === 'rating' ? 'SR5.Host.Rating' : SR5.matrixAttributes[id]);
            const short = game.i18n.localize(`SR5.Redesign.IC.Short.${id}`);
            // under the plate the base: the host's (copied onto the IC) or, without a host, the one entered here. The
            // system builds the IC's matrix attributes from its copy of the host's (system.host.atts, ICPrep) even
            // without a host, so that copy is what the edit boxes change
            if (id === 'rating') return {
                id, short, label, value: system.host.rating, base: hasHost ? system.host.rating : source.host?.rating ?? 0,
                field: fields?.host?.fields?.rating, editable: !hasHost,
            };
            const slot = Object.entries(source.host?.atts ?? {}).find(([, att]) => att?.att === id)?.[0];
            return {
                id, short, label, value: matrix[id]?.value ?? 0, base: hasHost || !slot ? matrix[id]?.base ?? 0 : source.host?.atts?.[slot]?.value ?? 0,
                field: slot ? fields?.host?.fields?.atts?.fields?.[slot]?.fields?.value : undefined, editable: !hasHost && !!slot,
            };
        });
    }
}
