// The system's own action handlers, for a redesigned sheet that adds to one instead of replacing it (the vehicle
// sheet's matrix monitor boxes, which fall back to the system's monitor handling for the other tracks).

type ActionHandler = (this: unknown, event: PointerEvent, target: HTMLElement) => Promise<void>;

/**
 * The handler a class above `sheet` defines for an action. Foundry merges DEFAULT_OPTIONS up the class chain, so the
 * chain is walked from `sheet`'s parent; importing the system's base sheet to reach its private handler would make
 * the module build bundle a copy of it.
 */
export function systemAction(sheet: abstract new (...args: never[]) => unknown, name: string): ActionHandler | undefined {
    type SheetClass = { DEFAULT_OPTIONS?: { actions?: Record<string, unknown> } } | null;
    for (let cls = Object.getPrototypeOf(sheet) as SheetClass; cls; cls = Object.getPrototypeOf(cls) as SheetClass) {
        const own = Object.prototype.hasOwnProperty.call(cls, 'DEFAULT_OPTIONS') ? cls.DEFAULT_OPTIONS?.actions?.[name] : undefined;
        if (own) return own as ActionHandler;
    }
    return undefined;
}
