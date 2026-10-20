// The system's Helpers plus the two formatters the redesign added to the fork (src/module/helpers.ts there).
import { Helpers as SystemHelpers } from 'stock/module/helpers';

export class Helpers extends SystemHelpers {
    /** Essence with two decimals, so costs line up in a column (0.30, 1.25); whole numbers without them (1, 6). */
    static formatEssence(value: number | undefined): string {
        const rounded = Math.round(Number(value ?? 0) * 100) / 100;
        const decimals = Number.isInteger(rounded) ? 0 : 2;
        return rounded.toLocaleString(game.i18n.lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }

    /** Drain or fade value the way the rulebooks print it: 'F', 'F − 3', 'L + 1'. */
    static formatForceValue(base: string, modifier: number | undefined): string {
        const value = Number(modifier) || 0;
        if (!value) return base;
        return `${base} ${value > 0 ? '+' : '−'} ${Math.abs(value)}`;
    }
}
