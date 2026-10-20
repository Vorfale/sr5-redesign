// The sidebar's frame on the redesigned sheets: the scroll bar's width, the scroll lane in the collapser's strip
// (wheel, thumb drag), the collapser's tooltip (SR5CharacterSheetRedesign).

/** Width the browser's scroll bars take (0 for overlay bars), measured once a page: the same for every sheet. */
let sidebarBar: number | null = null;

/**
 * The sidebar's scroll lane sits in the collapser's strip; where scroll bars take room (Windows, macOS set to always
 * show them) the lane's padding gives the bar's width back, so the card keeps its width (actor-redesign.scss). The
 * bar itself shows only while the sidebar scrolls, on every system (`sidebar-scrolling`).
 */
export function measureSidebarBar(element: HTMLElement) {
    const sidebar = element.querySelector<HTMLElement>('.sr-sidebar');
    if (!sidebar) return;
    // scrollbar-gutter: stable reserves a taking bar's room even without overflow, so this is its width or 0
    sidebarBar ??= Math.max(0, Math.min(14, sidebar.offsetWidth - sidebar.clientWidth));
    element.style.setProperty('--sr-sidebar-bar', `${sidebarBar}px`);
}

/**
 * The collapser's strip lies over the sidebar's scroll lane (the bar beside the card, on the caret's level). The
 * wheel over the strip scrolls the sidebar, and a drag that starts on the bar's thumb scrolls it instead of
 * collapsing the sidebar; a click anywhere else on the strip collapses it as before. On the window element, which
 * outlives the re-renders of both.
 */
export function wireSidebarScrollLane(element: HTMLElement, drawnAt: () => number) {
    const strip = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>('.sidebar-collapser') : null;
    const scrollable = () => {
        const sidebar = element.querySelector<HTMLElement>('.sr-sidebar');
        return sidebar && !element.classList.contains('sidebar-collapsed') && sidebar.scrollHeight > sidebar.clientHeight ? sidebar : null;
    };
    element.addEventListener('wheel', event => {
        const sidebar = strip(event.target) ? scrollable() : null;
        if (!sidebar) return;
        event.preventDefault();
        sidebar.scrollTop += event.deltaY;
    }, { passive: false });
    // a press on the thumb becomes a drag only once the pointer moves (3px): a press without moving is a click and
    // collapses the sidebar, wherever on the strip (a sidebar that scrolls a little has a thumb almost as tall as it)
    let dragged = false;
    element.addEventListener('pointerdown', event => {
        dragged = false;
        const button = event.button === 0 ? strip(event.target) : null;
        const sidebar = button ? scrollable() : null;
        if (!button || !sidebar) return;
        // the thumb as the browser draws it: the visible share of the list, at the scrolled share (a little slack)
        const box = sidebar.getBoundingClientRect();
        const ratio = sidebar.clientHeight / sidebar.scrollHeight;
        const top = box.top + sidebar.scrollTop * ratio;
        const height = Math.max(sidebar.clientHeight * ratio, 18);
        if (event.clientY < top - 4 || event.clientY > top + height + 4) return;
        const startY = event.clientY;
        const startScroll = sidebar.scrollTop;
        const move = (moved: PointerEvent) => {
            if (!dragged && Math.abs(moved.clientY - startY) < 3) return;
            if (!dragged) {
                dragged = true;
                button.setPointerCapture(moved.pointerId);
                game.tooltip?.deactivate();
            }
            sidebar.scrollTop = startScroll + (moved.clientY - startY) / ratio;
        };
        // on the window: a press that leaves the strip before it becomes a drag (no pointer capture yet) still ends
        // here, else its listeners stayed and hovering the strip scrolled
        const listening = new AbortController();
        const end = () => listening.abort();
        window.addEventListener('pointermove', move, { signal: listening.signal });
        window.addEventListener('pointerup', end, { signal: listening.signal });
        window.addEventListener('pointercancel', end, { signal: listening.signal });
    });
    // while the sidebar scrolls the bar shows in the strip: the caret steps aside until a moment after it stops
    // (scroll does not bubble: caught on the way down; the sidebar element is replaced by its re-renders)
    let scrollEnd: number | undefined;
    element.addEventListener('scroll', event => {
        if (!(event.target instanceof HTMLElement) || !event.target.matches('.sr-sidebar')) return;
        // a re-render restoring the scroll position (another player's change, a damage box) is not a scroll
        if (performance.now() - drawnAt() < 300) return;
        element.classList.add('sidebar-scrolling');
        window.clearTimeout(scrollEnd);
        scrollEnd = window.setTimeout(() => element.classList.remove('sidebar-scrolling'), 900);
    }, { capture: true, passive: true });
    // the click that ends a thumb drag does not collapse the sidebar (stopped before the action handler)
    element.addEventListener('click', event => {
        if (!dragged || !strip(event.target)) return;
        dragged = false;
        event.stopPropagation();
        event.preventDefault();
    }, { capture: true });
}

/**
 * The collapser strip spans the whole sidebar height, and a Foundry data-tooltip is placed against the element,
 * so it showed at the strip's middle or edge, far from the pointer. Show the label to the right of the strip at
 * the pointer's height instead, after the usual hover delay.
 */
export function wireCollapserTooltip(element: HTMLElement) {
    const button = element.querySelector<HTMLElement>('.sidebar-collapser');
    if (!button || button.dataset.tooltipWired) return;
    button.dataset.tooltipWired = 'true';
    const anchor = document.createElement('span');
    anchor.className = 'collapser-tooltip-anchor';
    anchor.setAttribute('aria-hidden', 'true');
    button.append(anchor);
    let timer: number | undefined;
    let pointerY = 0;
    const track = (event: PointerEvent) => { pointerY = event.clientY - button.getBoundingClientRect().top; };
    const hide = () => {
        window.clearTimeout(timer);
        if (game.tooltip?.element === anchor) game.tooltip.deactivate();
    };
    button.addEventListener('pointerenter', event => {
        track(event);
        timer = window.setTimeout(() => {
            // the collapser may have been re-rendered meanwhile: a detached anchor would never get pointerleave
            if (!anchor.isConnected) return;
            anchor.style.top = `${Math.round(pointerY)}px`;
            game.tooltip?.activate(anchor, { text: button.getAttribute('aria-label') ?? '', direction: 'RIGHT', cssClass: 'sr5-redesign-tooltip' });
        }, 500);
    });
    button.addEventListener('pointermove', track);
    button.addEventListener('pointerleave', hide);
    button.addEventListener('click', hide);
}
