// The modifier helpers the redesign added to the fork's ModifierFlow (src/module/actor/flows/ModifierFlow.ts), for the
// pools the sheet shows as they will be rolled. The sheet only uses these statics; an actor's own modifier flow is the
// running system's, which `patch` gives the fork's totalsFor.

/** An actor's modifier flow of the running system (actor.modifiers), with totalsFor once patched. */
interface ActorModifiers {
    totalFor(name: string, options?: { applicable?: string[] }): number;
    totalsFor?(modifiers: Record<string, string[]>): { name: string, value: number }[];
}

export class ModifierFlow {
    /**
     * Group an action's modifier list by category: 'category' or 'category.applicable' entries, the latter
     * collecting their applicable selections.
     *
     * @param modifiers Modifier list of an action, e.g. ['global', 'wounds', 'environmental.light'].
     */
    static groupModifiers(modifiers: string[]): Record<string, string[]> {
        const grouped: Record<string, string[]> = {};
        for (const modifier of modifiers) {
            if (modifier.includes('.')) {
                const segments = modifier.split('.');
                if (segments.length > 2) console.error('Shadowrun 5e | Action contained a partial modifier with more than two segments', modifier);
                const [category, applicable] = segments;
                grouped[category] = grouped[category] ?? [];
                grouped[category].push(applicable);
            } else {
                grouped[modifier] = grouped[modifier] ?? [];
            }
        }
        return grouped;
    }

    /**
     * Modifier categories a test of this action applies by itself: the action's own list, else the defaults of its
     * test implementation.
     *
     * @param action The action's test name and modifier list.
     */
    static actionModifierTypes(action: { test?: string, modifiers?: string[] }): Record<string, string[]> {
        if (action.modifiers?.length) return ModifierFlow.groupModifiers(action.modifiers);
        const tests = (game as any).shadowrun5e.tests as Record<string, any>;
        const testClass = (action.test ? tests[action.test] : undefined) ?? tests.SuccessTest;
        return ModifierFlow.groupModifiers(ModifierFlow.#defaultModifiers(testClass));
    }

    /**
     * The modifiers a test type applies by default. The fork reads a static (SuccessTest.defaultTestModifiers); the
     * release has only the instance getter, read here on a bare prototype object. A getter that needs the test's
     * documents fails on it: those tests get the base defaults.
     */
    static #defaultModifiers(testClass: any): string[] {
        if (Array.isArray(testClass?.defaultTestModifiers)) return testClass.defaultTestModifiers;
        for (let proto = testClass?.prototype; proto; proto = Object.getPrototypeOf(proto)) {
            const getter = Object.getOwnPropertyDescriptor(proto, 'testModifiers')?.get;
            if (!getter) continue;
            try {
                const value = getter.call(Object.create(testClass.prototype));
                if (Array.isArray(value)) return value;
            } catch {
                // needs a test instance
            }
            break;
        }
        return ['global', 'wounds'];
    }

    /** Gives the running system's ModifierFlow (the class behind actor.modifiers) the fork's totalsFor. */
    static patch(flow: ActorModifiers | undefined) {
        const proto = flow ? Object.getPrototypeOf(flow) : null;
        if (!proto || proto.totalsFor) return;
        /** Current totals of modifier categories, as a test adds them to its pool before any situational choice. */
        proto.totalsFor = function (this: ActorModifiers, modifiers: Record<string, string[]>) {
            return Object.entries(modifiers).map(([name, applicable]) => ({ name, value: this.totalFor(name, { applicable }) }));
        };
    }
}
