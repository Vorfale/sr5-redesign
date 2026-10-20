import { SR5Actor } from '@/module/actor/SR5Actor';
import { SYSTEM_NAME } from '@/module/constants';

// The header art of the redesigned sheets (EXPERIMENT): a background image tinted like the art on SR5 rulebook
// pages, kept in actor flags so every viewer of the sheet sees the same art. In edit mode it can be repositioned
// (like a Notion cover: drag it, then save or cancel) and zoomed with the wheel.

/** The sheet the art belongs to: its window and actor. */
interface SheetArtHost {
    readonly element: HTMLElement;
    readonly actor: SR5Actor;
    readonly rendered: boolean;
}

type ArtPosition = { x: number, y: number, zoom: number };
type FlagActor = {
    getFlag(scope: string, key: string): unknown;
    setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
    unsetFlag(scope: string, key: string): Promise<unknown>;
};

/** Width / height of each art image, once loaded: zoomed sizes are worked out from it. */
const artRatios = new Map<string, number>();

export class SheetArt {
    /** Actor flag holding the image path. */
    static readonly FLAG = 'sheetArt';
    /** Actor flag holding where the art is anchored, {x, y} in % (background-position), and its zoom (1 = cover). */
    static readonly POSITION_FLAG = 'sheetArtPosition';
    /** How far the art can be zoomed in: 1 is cover (the whole header filled), up to 4 times that. */
    static readonly ZOOM_MAX = 4;

    #reposition: { header: HTMLElement, position: ArtPosition, listeners: AbortController } | null = null;

    constructor(private readonly host: SheetArtHost) {}

    get #actor(): FlagActor {
        return this.host.actor as unknown as FlagActor;
    }

    /** The art's image path, '' for none. */
    get path(): string {
        const path = this.#actor.getFlag(SYSTEM_NAME, SheetArt.FLAG);
        return typeof path === 'string' ? path : '';
    }

    get position(): ArtPosition {
        const position = this.#actor.getFlag(SYSTEM_NAME, SheetArt.POSITION_FLAG) as { x?: unknown, y?: unknown, zoom?: unknown } | undefined;
        const percent = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : fallback;
        const zoom = typeof position?.zoom === 'number' && Number.isFinite(position.zoom) ? SheetArt.#clampZoom(position.zoom) : 1;
        return { x: percent(position?.x, 50), y: percent(position?.y, 25), zoom };
    }

    static #clampZoom(zoom: number) {
        return Math.min(SheetArt.ZOOM_MAX, Math.max(1, zoom));
    }

    /**
     * background-size of the zoomed art: cover (as wide as the header, or as tall as it, whichever is larger) times
     * the zoom, in CSS so it follows the header when the window is resized. Empty for no zoom (plain cover).
     */
    static #size(zoom: number, ratio: number | undefined): string {
        if (zoom <= 1 || !ratio) return '';
        return `max(calc(${zoom} * 100%), calc(${zoom} * var(--sr-header-height) * ${ratio})) auto`;
    }

    /** The art and its position on the window (CSS variables the header's background reads). */
    apply() {
        const element = this.host.element;
        const path = this.path;
        element.classList.toggle('has-sheet-art', !!path);
        // Relative paths from the FilePicker would otherwise resolve against the system stylesheet folder.
        if (path) element.style.setProperty('--sr-sheet-art', `url("${new URL(path, document.baseURI).href.replace(/"/g, '%22')}")`);
        else element.style.removeProperty('--sr-sheet-art');
        const { x, y, zoom } = this.position;
        element.style.setProperty('--sr-sheet-art-x', `${x}%`);
        element.style.setProperty('--sr-sheet-art-y', `${y}%`);
        const ratio = artRatios.get(path);
        const size = SheetArt.#size(zoom, ratio);
        if (size) element.style.setProperty('--sr-sheet-art-size', size);
        else element.style.removeProperty('--sr-sheet-art-size');
        // the zoomed size needs the picture's proportions: load it once, then apply again
        if (path && zoom > 1 && !ratio) {
            const image = new Image();
            image.addEventListener('load', () => {
                if (!image.naturalWidth || !image.naturalHeight) return;
                artRatios.set(path, image.naturalWidth / image.naturalHeight);
                if (this.host.rendered) this.apply();
            }, { once: true });
            image.src = new URL(path, document.baseURI).href;
        }
    }

    /** Reposition mode on the header: drag, wheel or pinch to zoom, keys; save or cancel ends it. */
    startReposition() {
        const header = this.host.element.querySelector<HTMLElement>('.sr-header');
        const path = this.path;
        if (!header || !path || this.#reposition) return;
        const position = { ...this.position };
        const listeners = new AbortController();
        this.#reposition = { header, position, listeners };
        header.classList.add('art-repositioning');
        const image = new Image();
        const ratio = () => image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : undefined;
        const show = () => {
            header.style.setProperty('--sr-sheet-art-x', `${position.x}%`);
            header.style.setProperty('--sr-sheet-art-y', `${position.y}%`);
            const size = SheetArt.#size(position.zoom, ratio());
            // 'cover' on the header too, so a zoom back to 1 overrides the window's saved zoom
            header.style.setProperty('--sr-sheet-art-size', size || 'cover');
        };
        image.addEventListener('load', () => {
            const value = ratio();
            if (value) artRatios.set(path, value);
            show();
        }, { once: true });
        image.src = new URL(path, document.baseURI).href;

        // The drawn picture (background-size: cover, times the zoom) and how far it can move: its size minus the box.
        const drawn = (zoom: number) => {
            const box = header.getBoundingClientRect();
            if (!image.naturalWidth || !image.naturalHeight) return { width: box.width, height: box.height, box };
            const scale = Math.max(box.width / image.naturalWidth, box.height / image.naturalHeight) * zoom;
            return { width: image.naturalWidth * scale, height: image.naturalHeight * scale, box };
        };
        const overflow = () => {
            const { width, height, box } = drawn(position.zoom);
            return { x: width - box.width, y: height - box.height };
        };
        const clamp = (value: number) => Math.min(100, Math.max(0, value));

        // dragging the picture down shows more of its top: the anchor moves toward 0%
        let drag: { pointerId: number, clientX: number, clientY: number, x: number, y: number, room: { x: number, y: number } } | null = null;
        const signal = listeners.signal;
        header.addEventListener('pointerdown', event => {
            if (event.button !== 0 || (event.target as Element).closest('.art-controls')) return;
            drag = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: position.x, y: position.y, room: overflow() };
            header.setPointerCapture(event.pointerId);
            header.classList.add('art-dragging');
            event.preventDefault();
        }, { signal });
        header.addEventListener('pointermove', event => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            if (drag.room.x > 0.5) position.x = clamp(drag.x - (event.clientX - drag.clientX) / drag.room.x * 100);
            if (drag.room.y > 0.5) position.y = clamp(drag.y - (event.clientY - drag.clientY) / drag.room.y * 100);
            show();
        }, { signal });
        const drop = (event: PointerEvent) => {
            if (!drag || event.pointerId !== drag.pointerId) return;
            drag = null;
            header.classList.remove('art-dragging');
        };
        header.addEventListener('pointerup', drop, { signal });
        header.addEventListener('pointercancel', drop, { signal });

        // wheel / pinch zooms around the pointer: the spot under it stays put
        const zoomTo = (zoom: number, pointer?: { x: number, y: number }) => {
            zoom = SheetArt.#clampZoom(zoom);
            if (zoom === position.zoom) return;
            const before = drawn(position.zoom);
            const after = drawn(zoom);
            const box = before.box;
            const at = pointer ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 };
            // background-position p% puts the picture at (box - picture) * p; keep the picture point under `at`
            const keep = (percent: number, boxSize: number, pointerOffset: number, size: number, newSize: number) => {
                const offset = (boxSize - size) * percent / 100;
                const spot = (pointerOffset - offset) / size;
                const free = boxSize - newSize;
                return free < -0.5 ? clamp((pointerOffset - spot * newSize) / free * 100) : percent;
            };
            position.x = keep(position.x, box.width, at.x - box.left, before.width, after.width);
            position.y = keep(position.y, box.height, at.y - box.top, before.height, after.height);
            position.zoom = zoom;
            show();
        };
        header.addEventListener('wheel', event => {
            event.preventDefault();
            zoomTo(position.zoom * Math.exp(-event.deltaY * 0.0015), { x: event.clientX, y: event.clientY });
        }, { signal, passive: false });
        // keyboard: arrows move the picture, + / - zoom, 0 back to cover, Enter saves, Escape cancels
        header.addEventListener('keydown', event => {
            // the header's name fields keep their keys (Escape still ends), and Enter on a button is that button's
            // (Cancel cancels)
            const target = event.target as HTMLElement;
            if (event.key !== 'Escape' && target.closest('input, textarea, select, [contenteditable="true"]')) return;
            if (event.key === 'Enter' && target.closest('button')) return;
            const step = event.shiftKey ? 10 : 2;
            const moves: Record<string, [number, number]> = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [step, 0], ArrowRight: [-step, 0] };
            if (event.key === '+' || event.key === '=') zoomTo(position.zoom * 1.1);
            else if (event.key === '-' || event.key === '_') zoomTo(position.zoom / 1.1);
            else if (event.key === '0') zoomTo(1);
            else if (event.key in moves) {
                const [dx, dy] = moves[event.key];
                position.x = clamp(position.x + dx);
                position.y = clamp(position.y + dy);
                show();
            } else if (event.key === 'Enter') {
                void this.save();
            } else if (event.key === 'Escape') {
                this.end();
            } else return;
            event.preventDefault();
            event.stopPropagation();
        }, { signal, capture: true });
        header.querySelector<HTMLElement>('[data-action="saveSheetArtPosition"]')?.focus();
        show();
    }

    /** Saves the dragged position and zoom (the update re-renders the header with them). */
    async save() {
        if (!this.#reposition) return;
        const { x, y, zoom } = this.#reposition.position;
        this.end(false);
        await this.#actor.setFlag(SYSTEM_NAME, SheetArt.POSITION_FLAG, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, zoom: Math.round(zoom * 100) / 100 });
    }

    /** Leaves reposition mode; `restore` drops the dragged position (cancel), otherwise it stays until the save re-renders. */
    end(restore = true) {
        const reposition = this.#reposition;
        if (!reposition) return;
        this.#reposition = null;
        reposition.listeners.abort();
        reposition.header.classList.remove('art-repositioning', 'art-dragging');
        if (restore) {
            reposition.header.style.removeProperty('--sr-sheet-art-x');
            reposition.header.style.removeProperty('--sr-sheet-art-y');
            reposition.header.style.removeProperty('--sr-sheet-art-size');
        }
        reposition.header.querySelector<HTMLElement>('[data-action="repositionSheetArt"]')?.focus();
    }

    /** A re-render replaced the header: a reposition in progress on the old one is dropped. */
    endIfReplaced() {
        if (this.#reposition && !this.#reposition.header.isConnected) this.end();
    }

    /** Picks the art with Foundry's file picker. */
    async pick() {
        const FilePicker = foundry.applications.apps.FilePicker.implementation;
        const picker = new FilePicker({
            type: 'image',
            current: this.path || this.host.actor.img || '',
            callback: (path: string) => { void this.#actor.setFlag(SYSTEM_NAME, SheetArt.FLAG, path); },
        });
        await picker.render({ force: true });
    }

    async clear() {
        await this.#actor.unsetFlag(SYSTEM_NAME, SheetArt.FLAG);
    }
}
