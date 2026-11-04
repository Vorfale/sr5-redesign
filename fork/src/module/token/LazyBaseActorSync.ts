/**
 * Unlinked tokens nobody looks at are built again from their base actor when they are read, not at every change of it.
 *
 * Foundry rebuilds the synthetic actor of every unlinked token of an actor, on every scene, at each change of the base
 * actor (Actor#_updateDependentTokens -> TokenDocument#_onUpdateBaseActor), its items too: ~100 ms a token on a full
 * character. A damage box of a character with 36 unlinked copies over a dozen scenes froze every client for 3.8 s, a
 * shot (two updates) for 7.8 s. Here a token off the viewed scene, with no window of its actor open, is marked stale
 * and built when its actor is read (the actor getter: sheets, combat, matrix flows) or its scene is viewed; the tokens
 * that show are built once after the updates that arrive together. Linked tokens are left as they are (they cost
 * nothing). 0.3 s and 0.6 s then, the viewed scene's three copies.
 *
 * One switch, in both the fork and the module: installLazyBaseActorSync() wraps the token document class the system
 * configured, at init. It stays out (and says why in the console) when Foundry or the system changed what it relies
 * on, so a release that handles this itself is not overridden; the world setting `lazyTokenSync` turns it off at once.
 * Removing the call takes it out entirely.
 */

/** Set on the wrapped class: installed once. */
const INSTALLED = Symbol.for('sr5-redesign.lazyBaseActorSync');

let enabled = true;

/** The world setting's switch: off, every token is built at once again, as Foundry does. */
export function setLazyBaseActorSync(value: boolean) {
    enabled = value;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TokenDocumentClass = new (...args: any[]) => TokenDocument;

function withLazyBaseActorSync<T extends TokenDocumentClass>(Base: T) {
    const queued = new Set<LazyBaseActorSyncToken>();
    const flushQueued = () => {
        const tokens = [...queued];
        queued.clear();
        for (const token of tokens) token.syncStaleBaseActor();
    };

    class LazyBaseActorSyncToken extends Base {
        static readonly [INSTALLED] = true;

        /** The base actor changed since this unlinked token's synthetic actor was last built. */
        #baseActorStale = false;

        override _onUpdateBaseActor(...args: Parameters<TokenDocument['_onUpdateBaseActor']>) {
            // a token whose delta Foundry has not built yet (isLazyDelta: tokens of scenes not drawn since the
            // load) has nothing to rebuild: it is built from the base actor as it is when first read. Reading its
            // delta here (as Foundry does) built every copy at the first change after a reload, 1.4 s for 36
            if (enabled && (this as { isLazyDelta?: boolean }).isLazyDelta) return;
            if (!enabled || this.isLinked || !this.delta) {
                // built at once, as Foundry does: a mark left from while it was on would build it twice
                this.#baseActorStale = false;
                return super._onUpdateBaseActor(...args);
            }
            this.#baseActorStale = true;
            if (!this.#shown()) return;
            if (!queued.size) window.setTimeout(flushQueued, 0);
            queued.add(this);
        }

        override get actor() {
            // read while Foundry's constructor prepares the document too, before this class's fields exist
            if (#baseActorStale in this && this.#baseActorStale) this.syncStaleBaseActor();
            return super.actor;
        }

        /** The synthetic actor built again from the base actor, as Foundry does at once, when it went stale. */
        syncStaleBaseActor() {
            if (!this.#baseActorStale) return;
            this.#baseActorStale = false;
            super._onUpdateBaseActor();
        }

        /** Whether the token shows: on the viewed scene, or its synthetic actor with a window open (its sheet). */
        #shown(): boolean {
            if (this.parent && this.parent === canvas?.scene) return true;
            const actor = super.actor as { apps?: Record<string, unknown> } | null;
            return !!actor && Object.keys(actor.apps ?? {}).length > 0;
        }
    }
    return LazyBaseActorSyncToken;
}

/** Why it can not go in, or null: Foundry's or the system's token updates are not the ones this was written for. */
function blocker(Base: TokenDocumentClass): string | null {
    const generation = (game as { release?: { generation?: number } }).release?.generation;
    // the system and the module run on Foundry 14 only; a later version is left alone until it is checked
    if (generation !== 14) return `written for Foundry 14, this is ${generation}`;
    const core = foundry.documents.TokenDocument as unknown as TokenDocumentClass;
    const coreUpdate = core.prototype._onUpdateBaseActor as unknown;
    if (typeof coreUpdate !== 'function') return 'TokenDocument#_onUpdateBaseActor is gone';
    // what is deferred: the synthetic actor's rebuild; a Foundry that does something else here is left alone
    const source = Function.prototype.toString.call(coreUpdate);
    if (!source.includes('updateSyntheticActor') || !source.includes('_onRelatedUpdate')) return 'TokenDocument#_onUpdateBaseActor changed';
    if (!Object.getOwnPropertyDescriptor(core.prototype, 'actor')?.get) return 'TokenDocument#actor is no longer a getter';
    // a system class between Foundry's and the configured one that handles base actor updates itself
    for (let proto = Base.prototype; proto && proto !== core.prototype; proto = Object.getPrototypeOf(proto)) {
        if (Object.hasOwn(proto, '_onUpdateBaseActor')) return `${proto.constructor.name} handles base actor updates itself`;
    }
    return null;
}

/**
 * Wraps the configured token document class (CONFIG.Token.documentClass, the system's) at init, before any token
 * exists, and builds a viewed scene's stale tokens before it draws. Once; nothing when blocked.
 */
export function installLazyBaseActorSync() {
    const Base = CONFIG.Token.documentClass as unknown as TokenDocumentClass & { [INSTALLED]?: boolean };
    if (Base[INSTALLED]) return;
    const reason = blocker(Base);
    if (reason) {
        console.warn(`SR5 Redesign | unlinked tokens are built as Foundry does (${reason}): the faster token updates are off`);
        return;
    }
    CONFIG.Token.documentClass = withLazyBaseActorSync(Base) as unknown as typeof CONFIG.Token.documentClass;
    Hooks.on('canvasInit', (canvas: Canvas) => {
        for (const token of canvas.scene?.tokens ?? []) (token as { syncStaleBaseActor?: () => void }).syncStaleBaseActor?.();
    });
}
