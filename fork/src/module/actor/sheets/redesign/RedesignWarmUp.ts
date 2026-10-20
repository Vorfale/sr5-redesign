import { SR5Actor } from '@/module/actor/SR5Actor';
import { SYSTEM_NAME } from '@/module/constants';
import { onIdle } from '@/module/actor/sheets/redesign/RedesignRenderMap';

// What the redesigned sheets fetch ahead of a first opening: fonts, the pictures of likely sheets, compiled
// templates (SR5CharacterSheetRedesign.warmUp, called once the world is ready).

/** Sheet fonts; loaded before the first render so labels do not change size when the web fonts swap in. */
export const SHEET_FONTS = ['700 12px "SR5 Label"', '600 12px "SR5 Label"', '400 12px "SR5 Label"', '700 12px "SR5 Head"'];
/** Faces only some text draws with (the bio's serif): fetched ahead (warmUp), not waited for. */
export const LATER_FONTS = ['400 12px "SR5 Prose"'];

/** Pictures fetched ahead of a first opening, held so the browser keeps them in memory for the session. */
const warmImages = new Map<string, HTMLImageElement>();
const warmedActors = new WeakSet<SR5Actor>();

/**
 * Fetch the sheet's fonts and the pictures of the characters this user is likely to open, before they are
 * opened. Foundry serves its files with `Cache-Control: no-cache`, so after a page load the browser asks the
 * server again for every font and picture a sheet shows (a hundred and more), one round trip each: on a remote
 * host the first sheet waited for its fonts (_prepareContext, up to 300 ms), then came up with its icons arriving
 * a few at a time. The fonts load once
 * the world is ready; the quick roll actions of the system pack and the pictures of the user's own characters
 * (a GM's: the players' characters) when the browser is idle, any other character's when the pointer rests on
 * it in the actors directory or on its token, and every picture a sheet showed in this browser before (pack
 * actions, default icons). Idle time also compiles the templates, which Handlebars otherwise
 * does on their first use, during the first sheet's render.
 */
export function warmUp(packActions: () => Promise<{ name: string; img: string | null }[]>, quickRolls: Record<string, string>) {
    for (const font of [...SHEET_FONTS, ...LATER_FONTS]) void document.fonts.load(font).catch(() => undefined);
    const actors = game.user?.isGM ? game.users.map(user => user.character) : game.actors.filter(actor => actor.isOwner);
    onIdle(() => {
        for (const actor of actors) warmActor(actor);
        for (const url of seenImages()) warmImage(url);
        void packActions().then(actions => {
            for (const action of actions) if (action.name in quickRolls) warmImage(action.img);
        }).catch(() => undefined);
        // a compiled template's _setup compiles it without running it; a few per idle slice (each takes < 5 ms)
        const templates = Object.entries(Handlebars.partials as Record<string, { _setup?: (options: object) => void }>)
            .filter(([path]) => /^(systems\/shadowrun5e|modules\/sr5-redesign)\//.test(path)).map(([, template]) => template);
        const compile = (deadline?: IdleDeadline) => {
            const end = performance.now() + Math.min(deadline?.timeRemaining() ?? 8, 8);
            while (templates.length && performance.now() < end) {
                try { templates.pop()?._setup?.({}); } catch { /* compiled on first use as before */ }
            }
            if (templates.length) onIdle(compile);
        };
        onIdle(compile);
    });
    Hooks.on('hoverToken', (token: { actor?: SR5Actor | null }, hovered: boolean) => {
        if (hovered) warmActor(token.actor);
    });
    document.addEventListener('pointerover', event => {
        const entry = event.target instanceof Element ? event.target.closest<HTMLElement>('.directory-item.actor[data-entry-id]') : null;
        if (entry) warmActor(game.actors.get(entry.dataset.entryId ?? ''));
    });
}

/** Fetch the pictures a character's sheet shows: its own, its items', the skill icons and the sheet art. */
function warmActor(actor: SR5Actor | null | undefined) {
    if (actor?.type !== 'character' || warmedActors.has(actor)) return;
    warmedActors.add(actor);
    const urls = new Set<string>([actor.img ?? '']);
    for (const item of actor.items) urls.add(item.img ?? '');
    // skill icons live in the actor's data, the sheet art in its flags
    const collect = (value: unknown, depth: number) => {
        if (typeof value === 'string') {
            if (/\.(webp|svg|png|jpe?g|avif|gif)$/i.test(value)) urls.add(value);
        } else if (value && typeof value === 'object' && depth < 6) {
            for (const child of Object.values(value)) collect(child, depth + 1);
        }
    };
    collect(actor.system, 0);
    collect(actor.flags?.[SYSTEM_NAME], 0);
    for (const url of urls) warmImage(url);
}

/** Browser storage key: the pictures sheets showed here, fetched ahead after the next page load. */
export const SEEN_IMAGES_KEY = 'shadowrun5e.redesignSheetImages';

function seenImages(): string[] {
    try {
        const seen: unknown = JSON.parse(localStorage.getItem(SEEN_IMAGES_KEY) ?? '[]');
        return Array.isArray(seen) ? seen.filter((url): url is string => typeof url === 'string') : [];
    } catch {
        return [];
    }
}

/** Add the pictures an opened sheet shows to the stored ones (the newest 500), once the browser is idle. */
export function rememberImages(element: HTMLElement) {
    onIdle(() => {
        const seen = new Set(seenImages());
        for (const image of element.querySelectorAll('img[src]')) seen.add(image.getAttribute('src') ?? '');
        seen.delete('');
        try {
            localStorage.setItem(SEEN_IMAGES_KEY, JSON.stringify([...seen].slice(-500)));
        } catch {
            // no storage: the pictures load when a sheet first shows them, as before
        }
    });
}

function warmImage(url: string | null | undefined) {
    if (!url || warmImages.has(url)) return;
    const image = new Image();
    image.decoding = 'async';
    image.fetchPriority = 'low';
    image.src = url;
    warmImages.set(url, image);
}
