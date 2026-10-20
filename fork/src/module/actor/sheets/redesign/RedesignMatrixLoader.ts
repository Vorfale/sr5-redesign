import { SR5Actor } from '@/module/actor/SR5Actor';
import { SYSTEM_NAME } from '@/module/constants';

// The Matrix tab's first draw without a frozen page (SR5CharacterSheetRedesign#drawMatrixGently): the grids' devices
// resolved a slice at a time, and the field of 0s and 1s shown meanwhile.

/** Grid devices already resolved this page (a token actor, once built, is kept by Foundry). */
const warmedSlaves = new Set<string>();

/**
 * Resolves the devices on the grids and on the actor's network the way the network icons will (fromUuidSync),
 * a slice of about 8 ms at a time: Foundry builds a token actor for each token among them (13-17 ms each), which
 * in one go was a second and more of a frozen page. Read from the system's network storage, nothing written.
 */
export async function warmMatrixNetworks(actor: SR5Actor, alive: () => boolean) {
    let networks: Record<string, string[]> = {};
    try {
        const storage = (game.settings as unknown as { get(scope: string, key: string): unknown }).get(SYSTEM_NAME, 'GlobalDataStorage') as { matrix?: { networks?: Record<string, string[]> } } | undefined;
        networks = storage?.matrix?.networks ?? {};
    } catch { return; }
    const masters = new Set<string>(game.items?.filter(item => item.type === 'grid').map(item => item.uuid) ?? []);
    const network = (actor as unknown as { network?: { uuid?: string } | null }).network;
    if (network?.uuid) masters.add(network.uuid);
    const pending: string[] = [];
    for (const master of masters) {
        for (const stored of networks[master.replaceAll('.', '_')] ?? []) {
            const uuid = stored.replaceAll('_', '.');
            // world actors and items are already built; tokens on scenes are what costs
            if (uuid.startsWith('Scene.') && !warmedSlaves.has(uuid)) pending.push(uuid);
        }
    }
    let slice = performance.now();
    for (const uuid of pending) {
        try { fromUuidSync(uuid); } catch { /* a stale entry: the system skips it too */ }
        warmedSlaves.add(uuid);
        if (performance.now() - slice > 8) {
            await new Promise(resolve => { window.setTimeout(resolve, 0); });
            if (!alive()) return;
            slice = performance.now();
        }
    }
}

/**
 * The field of 0s and 1s: columns of random digits in two layers that cross-fade at their own pace, so digits seem
 * to blink in and out. A cell never holds a different digit in each layer (mid-fade the two would overlap into a
 * glyph that is neither): it keeps one digit in both, or has it in one layer and a blank in the other. Only opacity
 * animates (the compositor runs it, so it keeps moving while a script works), and it fades in after a moment, so a
 * quick load never shows it. Removed with the placeholder when the tab is drawn.
 */
export function showMatrixLoader(placeholder: HTMLElement) {
    if (placeholder.querySelector('.sr-matrix-loader')) return;
    placeholder.classList.add('sr-matrix-loading');
    const loader = document.createElement('div');
    loader.className = 'sr-matrix-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-label', game.i18n.localize('SR5.Redesign.MatrixLoading'));
    const width = placeholder.clientWidth || 600;
    const height = placeholder.clientHeight || 600;
    const columns = Math.max(12, Math.min(64, Math.floor(width / 22)));
    const rows = Math.ceil(height / 18) + 2;
    for (let i = 0; i < columns; i++) {
        const column = document.createElement('span');
        column.className = 'col';
        column.style.setProperty('--dur', `${(3.5 + Math.random() * 4).toFixed(2)}s`);
        column.style.setProperty('--delay', `${(-Math.random() * 7).toFixed(2)}s`);
        const layers: [string[], string[]] = [[], []];
        for (let row = 0; row < rows; row++) {
            const digit = Math.random() < 0.5 ? '0' : '1';
            const roll = Math.random();
            // half the cells steady (the digit in both layers), a quarter only in one layer, a quarter in the other
            layers[0].push(roll < 0.75 ? digit : ' ');
            layers[1].push(roll < 0.5 || roll >= 0.75 ? digit : ' ');
        }
        layers.forEach((cells, index) => {
            const text = document.createElement('span');
            text.className = index ? 'b' : 'a';
            text.textContent = cells.join('\n');
            column.append(text);
        });
        loader.append(column);
    }
    placeholder.append(loader);
}
