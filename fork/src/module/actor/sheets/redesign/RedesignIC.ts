import type { SR5Actor } from '@/module/actor/SR5Actor';
import type { SR5Item } from '@/module/item/SR5Item';

// The IC sheet's host (SR5ICSheetRedesign, its cards in SR5RichTooltip).

/**
 * The host an IC runs on and the actor connected to it: the IC itself, or, for an unlinked token's copy, its base
 * actor. The system keeps a connection by the actor's uuid, so a token's copy is on no network of its own (b198), while
 * its host data (rating, attributes) is the base actor's copy.
 */
export function icHost(actor: SR5Actor): { host: SR5Item, connected: SR5Actor } | null {
    if (actor.hasHost() && actor.network) return { host: actor.network as SR5Item, connected: actor };
    const base = actor.isToken ? actor.token?.baseActor as SR5Actor | null | undefined : null;
    return base?.hasHost() && base.network ? { host: base.network as SR5Item, connected: base } : null;
}
