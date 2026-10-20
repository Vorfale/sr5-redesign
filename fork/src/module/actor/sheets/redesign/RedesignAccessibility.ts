// Keyboard use of the redesigned sheets' patched markup (SR5RedesignActorSheet#_onRender). Screen reader names and
// table roles are left out: they cost some 5 ms on every render of a full character, for a use the sheet does not aim
// at (2026-10-20); keyboard and the visual basics stay.

/** Elements that are focusable and keyboard-operable on their own. */
export const NATIVE_CONTROLS = 'button, a[href], input, select, textarea, summary';

/**
 * Tabs other than Details and Inventory reuse the regular SR5 templates, which use clickable divs and anchors
 * without href. Patch the rendered DOM so they take the keyboard focus and Enter / Space (WCAG 2.1.1), without
 * forking those templates.
 */
export function enhanceAccessibility(element: HTMLElement, roots: HTMLElement[]) {
    for (const root of roots) {
        for (const el of root.querySelectorAll<HTMLElement>(`[data-action]:not(${NATIVE_CONTROLS})`)) {
            if (!el.hasAttribute('tabindex')) el.tabIndex = 0;
            if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
        }
        // skill specializations (system helper links): say what a click does
        for (const el of root.querySelectorAll<HTMLElement>('.skill-specialization')) {
            el.dataset.tooltip = game.i18n.localize('SR5.Redesign.RollSpecialization');
        }
    }
    // Tooltips in the sheet's own style (see .sr5-redesign-tooltip), in the sheet's theme (RichTooltip#applyTheme). The
    // system's modifier tooltips add `sr5v2`, which brings the system's own tooltip look (bundle-v2.scss): dropped,
    // .sr5-redesign-tooltip styles them. The whole window: the parent's render sets them again on every part.
    for (const el of element.querySelectorAll<HTMLElement>('[data-tooltip], [data-tooltip-html]')) {
        const classes = new Set((el.dataset.tooltipClass ?? '').split(' ').filter(Boolean));
        classes.delete('sr5v2');
        classes.add('sr5-redesign-tooltip');
        el.dataset.tooltipClass = [...classes].join(' ');
    }
}
