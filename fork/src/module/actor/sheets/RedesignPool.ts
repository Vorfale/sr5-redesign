import { SR5 } from '@/module/config';
import { TestRules } from '@/module/rules/TestRules';

/** A dice pool as the redesigned sheet shows it: the number that will be rolled and how it adds up. */
export interface RolledPool {
    /** Pool the test rolls before situational choices in its dialog; null when it cannot be rolled. */
    pool: number | null;
    /** Pool before the modifiers (rating + attribute, attributes + armor...). */
    base: number | null;
    /**
     * A modifier takes dice away (wounds, a negative global...): the sheet marks the number. Also when a bonus makes
     * up for it (Jazz's Global +1 against Wounds −1): the wound still counts, the tooltip shows both.
     */
    reduced: boolean;
    /** Sum for the tooltip: 'Rating + AGI 11 · Wounds −1 = 10'. */
    tooltip: string;
}

const signed = (value: number) => value > 0 ? `+${value}` : `−${Math.abs(value)}`;

export const RedesignPool = {
    /** A modifier as the sheet prints it: '+1', '−2' (minus sign, not a hyphen). */
    signed,

    /**
     * An effect change as the sheet prints it, by its type: '+1', '× 2', '≥ 3', '≤ 3', '= 5'.
     * A value that is not a number (a formula left unresolved) is printed as it is.
     */
    change(type: string, value: unknown): string {
        const number = Number(value);
        if (value === '' || value === null || !Number.isFinite(number)) return typeof value === 'string' ? value : '';
        const plain = number < 0 ? `\u2212${Math.abs(number)}` : String(number);
        switch (type) {
            // an unrated item's formula comes out as 0: '+0', not '−0'
            case 'add': return number ? signed(number) : '+0';
            case 'subtract': return number ? signed(-number) : '+0';
            case 'multiply': return `\u00d7 ${number}`;
            case 'upgrade': return `\u2265 ${plain}`;
            case 'downgrade': return `\u2264 ${plain}`;
            default: return `= ${plain}`;
        }
    },

    /** Localized name of a modifier category ('wounds' → 'Wounds'). */
    label(name: string): string {
        return game.i18n.localize(SR5.modifierTypes[name as keyof typeof SR5.modifierTypes] ?? name);
    },

    /**
     * The pool a test will roll: its base plus the modifiers its test applies by itself (ModifierFlow.totalsFor),
     * so the sheet shows the same number as the roll dialog.
     *
     * @param base Base pool, null when the test cannot be rolled.
     * @param modifiers Modifier totals of the actor for this test; zero values are left out of the tooltip.
     * @param baseLabel What the base is made of, e.g. 'Rating + AGI'.
     */
    rolled(base: number | null, modifiers: { name: string, value: number }[], baseLabel: string): RolledPool {
        if (base === null) return { pool: null, base: null, reduced: false, tooltip: '' };
        const active = modifiers.filter(modifier => modifier.value);
        const pool = TestRules.poolTotal(base, active.map(modifier => modifier.value));
        const parts = [`${baseLabel} ${base}`, ...active.map(modifier => `${RedesignPool.label(modifier.name)} ${signed(modifier.value)}`)];
        const reduced = pool < base || active.some(modifier => modifier.value < 0);
        return { pool, base, reduced, tooltip: active.length ? `${parts.join(' · ')} = ${pool}` : parts[0] };
    },

    /**
     * The pool of a prepared test (TestCreator, then SuccessTest._prepareExecution: modifiers and the actor's test
     * effects applied, as the roll dialog opens), described like rolled(): the base as the sheet labels it, then
     * everything else the test adds (wounds, Catlike +2, Toughness +1...).
     *
     * @param testPool The prepared test's pool.
     * @param base Base pool as the sheet computes it.
     * @param baseLabel What the base is made of, e.g. 'Rating + AGI'.
     * @param baseCount How many of the test's pool parts make up the base (rating and attribute: 2).
     */
    fromTest(testPool: { value: number, changes: { name: string, value: number, enabled?: boolean }[] }, base: number, baseLabel: string, baseCount: number): RolledPool {
        const changes = testPool.changes.filter(change => change.enabled !== false && change.value);
        const baseChanges = changes.slice(0, baseCount);
        const ownBase = baseChanges.reduce((sum, change) => sum + change.value, 0) === base;
        // parts the sheet does not know as its base, in the order the test applied them
        const added = ownBase ? changes.slice(baseCount) : changes;
        const parts = [
            ...(ownBase ? [`${baseLabel} ${base}`] : []),
            ...added.map((change, index) => `${game.i18n.localize(change.name)} ${!ownBase && index < baseCount ? change.value : signed(change.value)}`),
        ];
        const pool = testPool.value;
        const reduced = pool < base || added.some(change => change.value < 0);
        return { pool, base, reduced, tooltip: added.length ? `${parts.join(' · ')} = ${pool}` : parts.join(' · ') };
    },
};
