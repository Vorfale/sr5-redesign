// The system's DOM utilities plus the two the redesign added to the fork (src/module/utils/dom.ts), used by the
// karma / nuyen / reputation managers.
export * from 'stock/module/utils/dom';

/**
 * Say `text` to screen readers through a polite live region on `element`. Give it an element that outlives
 * re-renders, such as an application's frame: a region rendered with a part is new after every render and goes unread.
 */
export function announce(element: HTMLElement, text: string) {
    let region = element.querySelector<HTMLElement>(':scope > .sr5-live-region');
    if (!region) {
        region = element.ownerDocument.createElement('div');
        region.className = 'sr5-live-region';
        region.setAttribute('role', 'status');
        region.setAttribute('aria-live', 'polite');
        // visually hidden, still read
        Object.assign(region.style, {
            position: 'absolute', width: '1px', height: '1px', margin: '-1px', padding: '0', border: '0',
            overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap',
        });
        element.append(region);
    }
    region.textContent = text;
}

/** Focus the first field matching `selector` in a freshly opened application, its value selected so typing replaces it. */
export function focusFirstField(element: HTMLElement, selector = 'input') {
    const field = element.querySelector<HTMLInputElement>(selector);
    field?.focus();
    field?.select();
}
