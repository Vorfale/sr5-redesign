import { SR5Actor } from '@/module/actor/SR5Actor';
import { SYSTEM_NAME } from '@/module/constants';
import { RedesignSettings } from '@/module/actor/sheets/RedesignSettings';

// The sidebar's action tracker (the Show Actions world setting): per Action Phase two Simple Actions or one Complex
// Action and one Free Action (SR5 161, 163); with Initiative 0 or less a Free Action only (SR5 160). The actions spent
// are kept in an actor flag with the phase they belong to, so a new pass gives them back without writing anything.

type FlagActor = { getFlag(scope: string, key: string): unknown; setFlag(scope: string, key: string, value: unknown): Promise<unknown> };
type Used = { free: number, simple: number, complex: boolean };
/** The flag as stored: the phase it belongs to and what was spent (any of it may be missing in old data). */
type StoredUsed = { key?: string, free?: unknown, simple?: unknown, complex?: unknown };
type TrackedCombat = { id: string | null, round: number, pass: number, combatants?: Iterable<{ actor: SR5Actor | null }> };

let combatWatched = false;

export class ActionTracker {
    /** Actor flag: the actions spent in the current Action Phase, `{ key, free, simple, complex }` (key: phaseKey). */
    static readonly FLAG = 'actionsUsed';
    /** Actor flag: Free Actions per Action Phase: 1, more with Perfect Time (RF 148), Multiprocessing (DT 150) or the GM's say. */
    static readonly FREE_FLAG = 'freeActions';
    static readonly MAX_FREE = 5;

    constructor(private readonly host: { readonly actor: SR5Actor }) {}

    get #flags(): FlagActor {
        return this.host.actor as unknown as FlagActor;
    }

    /**
     * What the actions spent belong to: in combat the combat, its round and initiative pass (a character has one
     * Action Phase per pass); outside of combat nothing, so the marks stay until reset by hand.
     */
    phaseKey(): { key: string, combatant: Combatant.Implementation | null } {
        const combat = game.combat;
        // not combat.getActorCombatant: with several combatants of one actor (unlinked tokens of a base actor, two
        // tokens of a character) and none of them selected, it warns and throws, and the sidebar failed to draw. Any
        // of them gives the phase (combat, round, pass); a selected one gives its own initiative.
        const combatants: Combatant.Implementation[] = combat?.getCombatantsByActor(this.host.actor as Actor.Stored) ?? [];
        const combatant = combatants.find(entry => entry.token?.object?.controlled) ?? combatants[0] ?? null;
        return { key: combat && combatant ? `${combat.id}:${combat.round}:${combat.pass}` : '', combatant };
    }

    /** The actions spent in the current Action Phase (none when the stored ones belong to an earlier one). */
    used(): Used {
        const stored = this.#flags.getFlag(SYSTEM_NAME, ActionTracker.FLAG) as StoredUsed | undefined;
        const { key } = this.phaseKey();
        if (!stored || stored.key !== key) return { free: 0, simple: 0, complex: false };
        return { free: Number(stored.free) || 0, simple: Number(stored.simple) || 0, complex: !!stored.complex };
    }

    freeActions(): number {
        const value = Number(this.#flags.getFlag(SYSTEM_NAME, ActionTracker.FREE_FLAG) ?? 1);
        return Math.min(ActionTracker.MAX_FREE, Math.max(1, Math.round(value) || 1));
    }

    /** The tracker as the sidebar draws it: one lozenge per kind with what is left. */
    context() {
        const used = this.used();
        const { combatant } = this.phaseKey();
        const free = this.freeActions();
        const initiative = combatant?.initiative;
        const noPhase = !!combatant && initiative !== null && initiative !== undefined && initiative <= 0;
        const i18n = (key: string, data?: Record<string, string | number>) => data ? game.i18n.format(key, data) : game.i18n.localize(key);
        const freeLeft = Math.max(0, free - used.free);
        const simpleLeft = used.complex ? 0 : Math.max(0, 2 - used.simple);
        const complexLeft = !used.complex && used.simple === 0 ? 1 : 0;
        const howTo = i18n('SR5.Redesign.Actions.HowTo');
        return {
            inCombat: !!combatant,
            pass: combatant ? game.combat?.pass ?? null : null,
            noPhase,
            spent: used.free > 0 || used.simple > 0 || used.complex,
            slots: [
                { kind: 'free', label: 'SR5.ActionType.Free', left: freeLeft, max: free, locked: false, disabled: false,
                    tooltip: `${i18n('SR5.Redesign.Actions.FreeLeft', { left: freeLeft, max: free })} ${howTo}` },
                { kind: 'simple', label: 'SR5.ActionType.Simple', left: simpleLeft, max: 2, locked: used.complex, disabled: used.complex || noPhase,
                    tooltip: noPhase ? i18n('SR5.Redesign.Actions.NoPhase') : `${i18n('SR5.Redesign.Actions.SimpleLeft', { left: simpleLeft })} ${howTo}` },
                { kind: 'complex', label: 'SR5.ActionType.Complex', left: complexLeft, max: 1, locked: used.simple > 0, disabled: used.simple > 0 || noPhase,
                    tooltip: noPhase ? i18n('SR5.Redesign.Actions.NoPhase') : `${i18n('SR5.Redesign.Actions.ComplexHint')} ${howTo}` },
            ],
        };
    }

    async #setUsed(used: Used) {
        const { key } = this.phaseKey();
        await this.#flags.setFlag(SYSTEM_NAME, ActionTracker.FLAG, { key, ...used });
    }

    /** One action of a lozenge's kind spent (+1) or back (-1); nothing where it is locked or out of this pass. */
    async change(target: HTMLElement, step: 1 | -1) {
        if (target.getAttribute('aria-disabled') === 'true') return;
        const used = this.used();
        const kind = target.dataset.kind;
        if (kind === 'free') used.free = Math.min(this.freeActions(), Math.max(0, used.free + step));
        else if (kind === 'simple') used.simple = Math.min(2, Math.max(0, used.simple + step));
        else if (kind === 'complex') used.complex = step > 0;
        else return;
        await this.#setUsed(used);
    }

    /** Every action back (a new Action Phase out of combat, or a slip in combat). */
    async reset() {
        await this.#setUsed({ free: 0, simple: 0, complex: false });
    }

    /** One Free Action more or less per Action Phase (edit mode). */
    async changeFree(delta: number) {
        const next = this.freeActions() + delta;
        if (next < 1 || next > ActionTracker.MAX_FREE) return;
        await this.#flags.setFlag(SYSTEM_NAME, ActionTracker.FREE_FLAG, next);
    }

    /**
     * Combat changes the tracker without touching the actor (a new pass gives the actions back, Initiative 0 takes
     * the Simple and Complex ones): `redraw` gets the actors involved (null: all). Set up once per page.
     */
    static watchCombat(redraw: (actors: Set<SR5Actor | null | undefined> | null) => void) {
        if (combatWatched) return;
        combatWatched = true;
        // turned off since they were set up: they stay registered and redraw nothing
        const ifOn = (actors: Set<SR5Actor | null | undefined> | null) => { if (RedesignSettings.get('showActions')) redraw(actors); };
        const combatActors = (combat: TrackedCombat | undefined) => new Set<SR5Actor | null | undefined>([...combat?.combatants ?? []].map(c => c.actor));
        const on = Hooks.on.bind(Hooks) as (hook: string, fn: (document: never, change: object) => void) => number;
        // a new round or pass (the phase key); a turn changes nothing the tracker reads
        on('updateCombat', (combat: TrackedCombat, change: object) => {
            if ('round' in change || foundry.utils.hasProperty(change, 'system.pass')) ifOn(combatActors(combat));
        });
        on('updateCombatant', (combatant: { actor: SR5Actor | null }, change: object) => { if ('initiative' in change) ifOn(new Set([combatant.actor])); });
        for (const hook of ['createCombatant', 'deleteCombatant']) on(hook, (combatant: { actor: SR5Actor | null }) => ifOn(new Set([combatant.actor])));
        for (const hook of ['createCombat', 'deleteCombat']) on(hook, (combat: TrackedCombat) => ifOn(combatActors(combat)));
    }
}
