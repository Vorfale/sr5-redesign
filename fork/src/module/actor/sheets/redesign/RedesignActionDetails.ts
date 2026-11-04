import { SR5 } from '@/module/config';
import { CombatRules } from '@/module/rules/CombatRules';
import { RedesignPool } from '@/module/actor/sheets/RedesignPool';
import type { SR5Actor } from '@/module/actor/SR5Actor';
import type { SR5Item } from '@/module/item/SR5Item';

// What an opened action row shows besides the system's properties (SR5RedesignActorSheet: the actions and Matrix
// tabs): the pool its test rolls, the limit, what opposes it, the active defenses of a defense test, what Full
// Defense adds; and for every action row the page of the general pack actions and whether an interrupt can be paid.

/**
 * Pages of the general actions of the system's pack, by the pack item's name: their source is empty there (the
 * Matrix and IC packs carry theirs). Defending and resisting damage SR5#173, armor SR5#168, attribute-only tests
 * SR5#152, biofeedback SR5#229, drain SR5#278, fading SR5#251, natural recovery SR5#207, drones SR5#269.
 */
const GENERAL_ACTION_SOURCES: Record<string, string> = {
    'Physical Defense': 'SR5 173', 'Physical Damage Resist': 'SR5 173', 'Armor': 'SR5 168',
    'Biofeedback Resist': 'SR5 229', 'Composure': 'SR5 152', 'Judge Intentions': 'SR5 152', 'Lift Carry': 'SR5 152',
    'Memory': 'SR5 152', 'Drain': 'SR5 278', 'Fade': 'SR5 251', 'Natural Recovery Physical': 'SR5 207',
    'Natural Recovery Stun': 'SR5 207', 'Drone Pilot Vehicle': 'SR5 269', 'Drone Perception': 'SR5 269',
    'Drone Infiltration': 'SR5 269',
};

/** A prepared test as the details read it: its class, pool, limit and opposed test (SuccessTest data). */
export interface PreparedActionTest {
    type: string;
    pool: { value: number; changes: { name: string; value: number; enabled?: boolean }[] };
    limit?: { value: number; changes?: { name: string; value: number; enabled?: boolean }[] };
    opposed?: { attribute?: string; attribute2?: string; skill?: string };
}

type ActionData = {
    type?: string; initiative_mod?: number; limit?: { value?: number; attribute?: string };
    skill?: string; attribute?: string; attribute2?: string; armor?: boolean;
    opposed?: { attribute?: string; attribute2?: string; skill?: string };
};

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const i18n = (key: string) => game.i18n.localize(key);
const attributeLabel = (id: string) => i18n((SR5.attributes as Record<string, string>)[id] ?? id);
const skillLabel = (id: string) => i18n((SR5.activeSkills as Record<string, string>)[id] ?? id);
const parts = (changes: { name: string; value: number; enabled?: boolean }[]) =>
    changes.filter(change => change.enabled !== false && change.value).map(change => `${i18n(change.name)} ${change.value}`);
/** One property of the opened row, as the system's: an icon, its text, a tooltip; `line` puts it on the second line. */
const property = (icon: string, text: string, tooltip = '', line = false, dim = false) =>
    `<label data-prop="roll" class="prop-detail${line ? ' prop-own-line' : ''}${dim ? ' prop-dim' : ''}"${tooltip ? ` data-tooltip="${escape(tooltip)}"` : ''}><i class="prop-icon fas ${icon}" aria-hidden="true"></i>${escape(text)}</label>`;

export const RedesignActionDetails = {
    /** The row's book page: the action's own source, else the page of a general pack action. */
    source(item: SR5Item): string {
        const own = (item.system as { description?: { source?: string } }).description?.source;
        return own || GENERAL_ACTION_SOURCES[item.name] || '';
    },

    /**
     * The actor's Initiative Score in the running combat, null outside of one: an interrupt is taken only with the
     * Initiative Score left to pay for it (SR5#167).
     */
    initiativeScore(actor: SR5Actor): number | null {
        return game.combat?.getActorCombatant?.(actor) ? actor.combatInitiativeScore : null;
    },

    /** Whether an initiative cost can not be paid now (CombatRules, as the defense dialog greys out its choices). */
    short(score: number | null, cost: number | undefined): boolean {
        return score !== null && !!cost && CombatRules.canUseActiveDefense(score, cost);
    },

    /** The extra properties of an opened action row, as markup for its property line. */
    html(actor: SR5Actor, item: SR5Item, test: PreparedActionTest | null): string {
        const action = (item.system as { action?: ActionData }).action ?? {};
        const score = RedesignActionDetails.initiativeScore(actor);
        const out: string[] = [];
        // what the pool is made of when the action names nothing itself: the test sets it up (Biofeedback Resist:
        // Willpower + Firewall, Drain: the tradition's attributes, Fading: Willpower + Resonance), its parts
        // before the modifiers (SR5.ModifierTypes.*), named as the roll label names an action's own
        if (test && !action.skill && !action.attribute && !action.attribute2 && !action.armor) {
            const named = test.pool.changes.filter(change => change.enabled !== false && !change.name.startsWith('SR5.ModifierTypes.')).map(change => i18n(change.name));
            if (named.length) out.push(property('fa-dice-six', named.join(' + ')));
        }
        // the pool its test opens the dialog with, the sum on its tooltip; none for a test without dice of its own
        if (test && test.pool.value > 0) {
            const sum = parts(test.pool.changes);
            out.push(property('fa-dice', `${i18n('SR5.DicePool')} ${test.pool.value}`, sum.length ? `${sum.join(' · ')} = ${test.pool.value}` : ''));
        }
        // the limit its test applies, unless the action's own roll label shows it already ([Physical])
        if (test?.limit && test.limit.value > 0 && !action.limit?.attribute && !action.limit?.value) {
            const sum = parts(test.limit.changes ?? []);
            out.push(property('fa-arrows-up-to-line', `${i18n('SR5.Limit')} ${test.limit.value}`, sum.join(' · ')));
        }
        // what the other side rolls: the prepared test's, else the action's own (attacks build theirs with a weapon)
        const opposed = test?.opposed?.attribute || test?.opposed?.skill ? test.opposed : action.opposed;
        const against = [opposed?.skill ? skillLabel(opposed.skill) : '', opposed?.attribute ? attributeLabel(opposed.attribute) : '',
            opposed?.attribute2 ? attributeLabel(opposed.attribute2) : ''].filter(Boolean);
        if (against.length) out.push(property('fa-shield-halved', `${i18n('SR5.Redesign.ActionRow.Versus')} ${against.join(' + ')}`));

        // a defense test: the active defenses its dialog offers (ActiveDefenseRules, MatrixRules), with the dice they
        // add and their cost; Dodge, Block and Parry only against melee attacks (SR5#168, SR5#190)
        const cost = (initMod: number) => String(initMod).replace('-', '−');
        // dice a defense adds: +3, +0 for a skill not learned
        const adds = (value: number | undefined) => value ? RedesignPool.signed(value) : '+0';
        if (test?.type === 'PhysicalDefenseTest') {
            const full = actor.getFullDefenseAttribute()?.value;
            const skill = (id: string) => actor.findActiveSkill(id)?.value;
            const melee = i18n('SR5.Redesign.ActionRow.MeleeOnly');
            out.push(property('fa-shield', `${i18n('SR5.FullDefense')} ${adds(full)} · ${cost(-10)}`, '', true, RedesignActionDetails.short(score, -10)));
            out.push(property('fa-person-running', `${i18n('SR5.Dodge')} ${adds(skill('gymnastics'))} · ${cost(-5)}`, melee, true, RedesignActionDetails.short(score, -5)));
            out.push(property('fa-hand', `${i18n('SR5.Block')} ${adds(skill('unarmed_combat'))} · ${cost(-5)}`, melee, true, RedesignActionDetails.short(score, -5)));
            out.push(property('fa-khanda', `${i18n('SR5.Parry')} · ${cost(-5)}`, melee, true, RedesignActionDetails.short(score, -5)));
        } else if (test?.type === 'MatrixDefenseTest') {
            const full = actor.getMatrixFullDefenseAttribute()?.value;
            out.push(property('fa-shield', `${i18n('SR5.FullMatrixDefense')} ${adds(full)} · ${cost(-10)}`, '', true, RedesignActionDetails.short(score, -10)));
        }

        // the interrupts of the defense dialog as actions of their own (Chummer's): what each adds to the defense test
        // (SR5#168): Full Defense the character's chosen attribute for the whole Combat Turn (full_defense_attribute),
        // Dodge Gymnastics, Block Unarmed Combat, each once
        const name = (item.system as { importFlags?: { name?: string } }).importFlags?.name || item.name;
        const named = (attribute: { label?: string; value?: number } | undefined) => attribute ? `${i18n(attribute.label ?? '')} ${attribute.value ?? 0}` : '';
        const skillAdd = (id: string) => `${skillLabel(id)} ${actor.findActiveSkill(id)?.value ?? 0}`;
        const defenseAdds: Record<string, [string, string]> = {
            'Full Defense': ['SR5.Defense', named(actor.getFullDefenseAttribute() as { label?: string; value?: number } | undefined)],
            'Full Matrix Defense': ['SR5.MatrixDefense', named(actor.getMatrixFullDefenseAttribute() as { label?: string; value?: number } | undefined)],
            'Dodge': ['SR5.Defense', skillAdd('gymnastics')],
            'Block': ['SR5.Defense', skillAdd('unarmed_combat')],
        };
        const defense = defenseAdds[name];
        if (defense?.[1]) out.push(property('fa-shield', `${i18n(defense[0])} + ${defense[1]}`.replace(/\s+/g, ' ')));
        return out.join('');
    },

};
