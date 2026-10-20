// The system's TestRules plus the pool total the redesign added to the fork (src/module/rules/TestRules.ts).
import { TestRules as SystemTestRules } from 'stock/module/rules/TestRules';

export const TestRules = {
    ...SystemTestRules,
    /**
     * The dice pool a test rolls: its base pool plus modifiers, never below zero (SR5 tests roll at least nothing).
     *
     * @param base Base pool, e.g. skill rating + attribute.
     * @param modifiers Modifier values applied to the pool (wounds, global, ...).
     */
    poolTotal: (base: number, modifiers: number[] = []): number => {
        return Math.max(0, modifiers.reduce((total, value) => total + value, base));
    },
};
