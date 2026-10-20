// The system's character sheet class, caught when the system registered it (see the wrapper in build.mjs): Foundry
// keeps sheet registrations made during 'init' pending until just before 'ready', so CONFIG.Actor.sheetClasses is
// still empty when modules set up, and the system does not expose the class otherwise.
//
// On top of it, the changes lab/sheet-redesign made to the system's base sheet (SR5BaseActorSheet), which the module
// cannot patch in the running system: drops anywhere on the favorites row (reorder, or add an item by dropping its
// row or any item there) with a mark where it lands, and an overflow box that clears when its own value is clicked.
import { SR5Item } from '@/module/item/SR5Item';
import { SheetFlow } from '@/module/flows/SheetFlow';
import { ModifierFlow } from '@/module/actor/flows/ModifierFlow';

declare const SYSTEM_CHARACTER_SHEET: any;
const SystemCharacterSheet = SYSTEM_CHARACTER_SHEET;

/** The system's own handler of an action, found up the sheet's class chain (DEFAULT_OPTIONS are per class). */
function systemAction(name: string): ((this: any, event: Event, target: HTMLElement) => unknown) | undefined {
    for (let cls = SystemCharacterSheet; cls; cls = Object.getPrototypeOf(cls)) {
        const handler = Object.prototype.hasOwnProperty.call(cls, 'DEFAULT_OPTIONS') ? cls.DEFAULT_OPTIONS?.actions?.[name] : undefined;
        if (handler) return handler;
    }
    return undefined;
}

export class SR5CharacterSheet extends SystemCharacterSheet {
    static override DEFAULT_OPTIONS = {
        actions: {
            modifyConditionMonitor: SR5CharacterSheet.#modifyConditionMonitor,
        },
    };

    constructor(...args: any[]) {
        super(...args);
        // the release's ModifierFlow lacks totalsFor, which the sheet's pools use
        ModifierFlow.patch(this.actor?.modifiers);
    }

    override async _onRender(context: any, options: any) {
        await super._onRender(context, options);
        // the release drops only on a favorite: this one takes the whole row and marks where the drop lands
        new foundry.applications.ux.DragDrop({
            dragSelector: null,
            dropSelector: '[data-favorites]',
            permissions: { drop: this._canDragDropFavorite.bind(this) },
            callbacks: {
                dragover: this._onDragOverFavorite.bind(this),
                dragleave: this._onDragLeaveFavorite.bind(this),
                drop: this._onDragDropFavorite.bind(this),
            },
        }).bind(this.element);
    }

    /** The overflow track clears like the others: a click on its current value sets it to 0. */
    static async #modifyConditionMonitor(this: any, event: Event, target: HTMLElement) {
        const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action="modifyConditionMonitor"]') ?? target;
        if (cell?.dataset.id === 'overflow' && this.actor.getPhysicalTrack()?.overflow?.value === Number(cell.dataset.value)) {
            event.preventDefault();
            await this.actor.update({ 'system.track.physical.overflow.value': 0 });
            await this.document.applyDefeatedStatus();
            return;
        }
        return systemAction('modifyConditionMonitor')?.call(this, event, target);
    }

    override _onDragStartFavorite(event: DragEvent) {
        const target = event.currentTarget as HTMLElement;
        const uuid = SheetFlow.closestUuid(target);
        const itemId = SheetFlow.closestItemId(target);
        const item = this.actor.items.get(itemId);
        // an owned favorite drags as its item, so it can go to the hotbar or another sheet as well
        const dragData = { ...item?.toDragData(), uuid, itemId };
        event.dataTransfer?.setData('text/plain', JSON.stringify(dragData));
    }

    /** The favorites row a drop event belongs to: the release listens on each favorite, this class on the row. */
    _favoritesContainer(event: DragEvent): HTMLElement {
        const current = event.currentTarget as HTMLElement;
        return current.closest<HTMLElement>('[data-favorites]') ?? current;
    }

    /**
     * Where a drop on the favorites lands: the index of the favorite it goes before (the list's length at its end)
     * and that favorite's element, read from the pointer. Works for a column of rows and for a (wrapping) row of icons.
     */
    _favoriteDropPosition(event: DragEvent): { index: number, before: HTMLElement | null } {
        const container = this._favoritesContainer(event);
        const favorites = [...container.querySelectorAll<HTMLElement>('.favorite')];
        const rects = favorites.map(favorite => favorite.getBoundingClientRect());
        const inRow = rects.length > 1 && Math.abs(rects[0].top - rects[1].top) < 2;
        const index = rects.findIndex(rect => inRow
            ? event.clientY < rect.top || (event.clientY <= rect.bottom && event.clientX < rect.left + rect.width / 2)
            : event.clientY < rect.top + rect.height / 2);
        return index < 0 ? { index: favorites.length, before: null } : { index, before: favorites[index] };
    }

    /** Marks where the dragged entry will land: a line before a favorite, or after the last one. */
    _onDragOverFavorite(event: DragEvent) {
        const container = this._favoritesContainer(event);
        const { before } = this._favoriteDropPosition(event);
        container.classList.add('favorite-drop-target');
        container.classList.toggle('favorite-drop-end', !before);
        for (const favorite of container.querySelectorAll('.favorite')) {
            favorite.classList.toggle('favorite-drop-before', favorite === before);
        }
    }

    _onDragLeaveFavorite(event: DragEvent) {
        const container = this._favoritesContainer(event);
        if (event.relatedTarget instanceof Node && container.contains(event.relatedTarget)) return;
        this._clearFavoriteDropMarks(container);
    }

    _clearFavoriteDropMarks(container: HTMLElement) {
        container.classList.remove('favorite-drop-target', 'favorite-drop-end');
        for (const favorite of container.querySelectorAll('.favorite-drop-before')) favorite.classList.remove('favorite-drop-before');
    }

    /**
     * A favorite moves to where it was dropped; an item of this actor (a row of the sheet) becomes a favorite there.
     * An item from elsewhere (sidebar, compendium, another actor) is added to the actor as any drop would, then made
     * a favorite. Anything else falls through to the sheet's own drop handling.
     */
    override async _onDragDropFavorite(event: DragEvent) {
        const container = this._favoritesContainer(event);
        const { index } = this._favoriteDropPosition(event);
        this._clearFavoriteDropMarks(container);

        const data = TextEditor.getDragEventData(event) as { type?: string, uuid?: string, itemId?: string, id?: string };
        const favorites: string[] = this.actor.system.favorites;
        // a favorite kept by uuid (not an item of this actor) moves by its uuid
        let favoriteId = [data.uuid, data.itemId, data.id].find(id => id && favorites.includes(id));
        if (!favoriteId && data.type === 'Item' && data.uuid) {
            const item = fromUuidSync(data.uuid);
            if (item instanceof SR5Item && item.parent === this.actor) favoriteId = item.id!;
        }
        // not a favorite or an owned item: an item from elsewhere is created first, everything else is the sheet's drop
        if (!favoriteId && data.type !== 'Item') return;
        event.stopPropagation();
        if (!favoriteId) {
            if (Hooks.call('dropActorSheetData', this.actor, this, data) === false) return;
            const item = await SR5Item.fromDropData(data);
            const created = item ? await this._onDropItem(event, item) : null;
            if (!(created instanceof SR5Item) || created.parent !== this.actor) return;
            favoriteId = created.id!;
        }

        const reordered = SheetFlow.placeInList(this.actor.system.favorites, favoriteId, index);
        if (!foundry.utils.objectsEqual(reordered, this.actor.system.favorites)) {
            await this.actor.update({ system: { favorites: reordered } });
        }
    }
}
