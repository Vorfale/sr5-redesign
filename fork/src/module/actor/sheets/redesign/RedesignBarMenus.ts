// The sidebar's dropdown fields (initiative, control mode): popover menus placed under their field, with arrow keys,
// Escape and Tab (SR5CharacterSheetRedesign; the vehicle sheet's driver picker wires its own).

function initiativeMenuItems(menu: HTMLElement): HTMLElement[] {
    return Array.from(menu.querySelectorAll<HTMLElement>('button:not(:disabled)'));
}

/**
 * The menu is a native popover (opened by the trigger's popovertarget, closed by a click outside or Escape).
 * Here it is placed under the initiative row (above it when there is no room below), gets focus on its checked
 * item, closes when the sidebar scrolls, and gets arrow-key navigation.
 */
export function wireInitiativeMenu(element: HTMLElement) {
    // a picker menu (the vehicle sheet's driver list, data-picker) has its own search and wiring
    for (const menu of element.querySelectorAll<HTMLElement>('.init-menu:not([data-picker])')) wireBarMenu(element, menu);
}

/** One bar's menu (see wireInitiativeMenu): the bar it opens under is the one in its group. */
function wireBarMenu(element: HTMLElement, menu: HTMLElement) {
    const group = menu.closest<HTMLElement>('.initiative-bar, .control-bar');
    const bar = group?.querySelector<HTMLElement>('.bar');
    if (!group || !bar || menu.dataset.wired) return;
    menu.dataset.wired = 'true';
    const close = () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
    // placed before it is shown: 'toggle' fires after the first paint, so placing it there let the menu flash at
    // the viewport's top-left corner for a frame. Its height is known up front (30px rows + 8px padding).
    menu.addEventListener('beforetoggle', event => {
        if (event.newState !== 'open') return;
        const rect = bar.getBoundingClientRect();
        const height = menu.querySelectorAll('.init-option').length * 30 + 10;
        const below = rect.bottom + 2;
        const top = below + height > window.innerHeight ? rect.top - height - 2 : below;
        Object.assign(menu.style, { left: `${Math.round(rect.left)}px`, top: `${Math.round(top)}px`, width: `${Math.round(rect.width)}px` });
    });
    menu.addEventListener('toggle', event => {
        if (event.newState !== 'open') return;
        const items = initiativeMenuItems(menu);
        (items.find(item => item.getAttribute('aria-checked') === 'true') ?? items[0])?.focus();
        element.querySelector('.sr-sidebar')?.addEventListener('scroll', close, { once: true });
    });
    menu.addEventListener('keydown', event => {
        const items = initiativeMenuItems(menu);
        const index = items.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            items[(index + step + items.length) % items.length]?.focus();
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation(); // close the menu, not the sheet
            close();
            group.querySelector<HTMLElement>('.init-trigger')?.focus();
        } else if (event.key === 'Tab') {
            close();
        }
    });
}
