/**
 * The context menus of the SR5 Redesign sheet without a mouse: a ⋮ button in every row that has a menu and an icon
 * column, Shift+F10 / the Menu key on anything focused inside such a row, and keyboard use of the open menu (Foundry's
 * ContextMenu draws plain list items: no roles, not focusable). The menu itself stays Foundry's: the button and the
 * keys send the same contextmenu event a right click does.
 *
 * Usage: `RowMenu.install()` once; `RowMenu.addButtons(root)` after each render; `RowMenu.onKeydown(event)` from the
 * sheet's keydown listener.
 */

/** The element the menu was opened from with the keyboard or the ⋮ button: the focus goes back there when it closes. */
let opener: HTMLElement | null = null;
/** The next menu takes the focus (opened with the keyboard or the ⋮ button). */
let focusNext = false;
let installed = false;

const ROWS = '[data-context-menu]';
const ITEMS = '.context-item';

export const RowMenu = {
    install() {
        if (installed) return;
        installed = true;
        // Foundry appends the menu to the body, entries already in it, and removes it when it closes
        new MutationObserver(records => {
            for (const record of records) {
                for (const node of record.addedNodes) {
                    if (node instanceof HTMLElement && node.id === 'context-menu') enhance(node);
                }
                for (const node of record.removedNodes) {
                    if (node instanceof HTMLElement && node.id === 'context-menu') closed(node);
                }
            }
        }).observe(document.body, { childList: true });
    },

    /**
     * A ⋮ button at the end of the icon column of every row with a menu. Skill rows (no icon column in play mode) and
     * pills keep the keyboard way only.
     */
    addButtons(root: HTMLElement) {
        for (const row of root.querySelectorAll<HTMLElement>(`.list-item${ROWS}`)) {
            const icons = row.querySelector<HTMLElement>(':scope > .list-item-icons');
            if (!icons || row.closest('.skill-table') || icons.querySelector(':scope > .row-menu')) continue;
            const name = row.querySelector('.item-name-link, .list-item-start a, .list-item-start label')?.textContent?.trim() ?? '';
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'unbutton row-menu';
            button.setAttribute('aria-haspopup', 'menu');
            button.setAttribute('aria-label', name ? game.i18n.format('SR5.Redesign.RowMenuFor', { name }) : game.i18n.localize('SR5.Redesign.RowMenu'));
            button.dataset.tooltip = 'SR5.Redesign.RowMenu';
            button.innerHTML = '<i class="fas fa-ellipsis-vertical" aria-hidden="true"></i>';
            button.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                RowMenu.open(button);
            });
            icons.append(button);
        }
    },

    /** Shift+F10 or the Menu key inside a row with a menu opens it, as on a desktop. */
    onKeydown(event: KeyboardEvent) {
        if (event.key !== 'ContextMenu' && !(event.shiftKey && event.key === 'F10')) return;
        const target = event.target instanceof HTMLElement ? event.target : null;
        if (!target?.closest(ROWS)) return;
        event.preventDefault();
        RowMenu.open(target);
    },

    /** Opens the menu of the row `anchor` is in, below it, and moves the focus into the menu. */
    open(anchor: HTMLElement) {
        opener = anchor;
        focusNext = true;
        const rect = anchor.getBoundingClientRect();
        anchor.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, button: 2, clientX: Math.max(1, rect.left), clientY: Math.max(1, rect.bottom),
        }));
    },
};

/** Roles and keyboard use for a menu opened on the sheet; the focus moves in when the keyboard opened it. */
function enhance(nav: HTMLElement) {
    const fromSheet = focusNext || !!document.querySelector('.sr5v2.sr5-redesign .context');
    if (!fromSheet) return;
    nav.classList.add('sr5-redesign-menu'); // the sheet's stylesheet keeps the system's look on it (UI skins restyle #context-menu)
    nav.querySelector('menu.context-items')?.setAttribute('role', 'menu');
    for (const group of nav.querySelectorAll('.context-group')) {
        group.setAttribute('role', 'none');
        group.querySelector('ol')?.setAttribute('role', 'group');
    }
    const items = [...nav.querySelectorAll<HTMLElement>(ITEMS)];
    for (const item of items) {
        item.setAttribute('role', 'menuitem');
        item.tabIndex = -1;
    }
    nav.addEventListener('keydown', event => onMenuKey(event, nav));
    fitExpandAnimation(nav);
    if (focusNext) items[0]?.focus();
    focusNext = false;
}

/**
 * Foundry measures the menu for its unfolding animation before the sheet's style applies (rows of another height),
 * and the finished animation keeps that height: a gap under the last entry, or entries cut off. The animation is
 * aimed at the styled height instead, and dropped once done so the menu keeps its own height.
 */
function fitExpandAnimation(nav: HTMLElement) {
    for (const animation of nav.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        const frames = effect?.getKeyframes() ?? [];
        if (!effect || frames.length < 2 || !frames.every(frame => 'height' in frame)) continue;
        const borders = nav.offsetHeight - nav.clientHeight;
        const height = Math.min(nav.scrollHeight + borders, parseFloat(nav.style.maxHeight) || Infinity);
        effect.setKeyframes([frames[0], { ...frames[frames.length - 1], height: `${height}px` }]);
        animation.finished.then(() => animation.cancel()).catch(() => undefined);
    }
}

/** Arrows / Home / End move between the entries, Enter or Space picks one, Escape and Tab close the menu. */
function onMenuKey(event: KeyboardEvent, nav: HTMLElement) {
    const items = [...nav.querySelectorAll<HTMLElement>(ITEMS)];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (to: number) => items[(to + items.length) % items.length]?.focus();
    switch (event.key) {
        case 'ArrowDown': move(index + 1); break;
        case 'ArrowUp': move(index < 0 ? items.length - 1 : index - 1); break;
        case 'Home': move(0); break;
        case 'End': move(items.length - 1); break;
        case 'Enter':
        case ' ':
            if (index < 0) return;
            items[index].click();
            break;
        // closed at once: the keyboard does not wait for the fold-up animation
        case 'Escape':
        case 'Tab':
            void (ui.context as { close(options: { animate: boolean }): Promise<void> } | undefined)?.close({ animate: false });
            break;
        default: return;
    }
    event.preventDefault();
    event.stopPropagation();
}

/** The menu closed: the focus goes back to where it was opened from, unless it moved on (or the row is gone). */
function closed(nav: HTMLElement) {
    const back = opener;
    opener = null;
    if (!back?.isConnected) return;
    const active = document.activeElement;
    if (!active || active === document.body || nav.contains(active)) back.focus({ preventScroll: true });
}
