// The filter menu of a list search (redesign/list-controls.hbs and the network manager), shared by the sheet and the
// apps it opens.

/**
 * A filter menu of the sheet's list search, or of an app it opens (the network manager): a popover placed under its
 * button (flipped above near the window bottom). Options toggle without closing it, like checkboxes; arrows / Home /
 * End move between options, Escape closes it.
 */
export function wireListFilterMenu(menu: HTMLElement, button: HTMLElement) {
    if (menu.dataset.wired) return;
    menu.dataset.wired = 'true';
    const items = () => Array.from(menu.querySelectorAll<HTMLElement>('.list-filter-option:not(:disabled)'));
    const close = () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
    menu.addEventListener('beforetoggle', event => {
        button.setAttribute('aria-expanded', String((event as ToggleEvent).newState === 'open'));
        if ((event as ToggleEvent).newState !== 'open') return;
        game.tooltip?.deactivate(); // the button's "Filters" tooltip would cover the menu's first row
        // below the button, scrolling inside when taller than the room left; flipped above once open if it
        // still does not fit and there is more room there
        const rect = button.getBoundingClientRect();
        const top = rect.bottom + 2;
        Object.assign(menu.style, { left: `${Math.round(rect.left)}px`, top: `${Math.round(top)}px`,
            maxHeight: `${Math.round(window.innerHeight - top - 8)}px` });
    });
    menu.addEventListener('toggle', event => {
        if ((event as ToggleEvent).newState !== 'open') return;
        const rect = button.getBoundingClientRect();
        const below = window.innerHeight - rect.bottom - 10;
        const above = rect.top - 10;
        if (menu.scrollHeight > below && above > below) {
            const height = Math.min(menu.scrollHeight, above);
            Object.assign(menu.style, { top: `${Math.round(rect.top - 2 - height)}px`, maxHeight: `${Math.round(above)}px` });
        }
        menu.style.overflowY = menu.scrollHeight > menu.clientHeight + 2 ? 'auto' : '';
        // keep it inside the window on the right
        const width = menu.offsetWidth;
        if (rect.left + width > window.innerWidth - 8) menu.style.left = `${Math.max(8, Math.round(window.innerWidth - 8 - width))}px`;
        items()[0]?.focus();
        button.closest('section.tab, .window-content')?.addEventListener('scroll', close, { once: true });
    });
    menu.addEventListener('keydown', event => {
        const list = items();
        const index = list.indexOf(document.activeElement as HTMLElement);
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            const step = event.key === 'ArrowDown' ? 1 : -1;
            list[(index + step + list.length) % list.length]?.focus();
        } else if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            (event.key === 'Home' ? list[0] : list[list.length - 1])?.focus();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation(); // close the menu, not the sheet
            close();
            button.focus();
        } else if (event.key === 'Tab') {
            close();
        }
    });
}
