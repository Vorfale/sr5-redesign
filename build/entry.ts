// SR5 Redesign module entry. Runs inside the 'init' hook (build.mjs wraps the bundle), after the Shadowrun 5e system
// registered its documents, configuration and sheets.
import { SR5CharacterSheetRedesign } from '@/module/actor/sheets/SR5CharacterSheetRedesign';
import { SR5VehicleSheetRedesign } from '@/module/actor/sheets/SR5VehicleSheetRedesign';
import { SR5ICSheetRedesign } from '@/module/actor/sheets/SR5ICSheetRedesign';
import { ModifierFlow } from '@/module/actor/flows/ModifierFlow';
import { Helpers } from '@/module/helpers';
import { LinksHelpers } from '@/module/utils/links';
import { RedesignSettings } from '@/module/actor/sheets/RedesignSettings';
import { installLazyBaseActorSync } from '@/module/token/LazyBaseActorSync';

declare const MODULE_TEMPLATE_PATHS: string[];
declare const SYSTEM_IC_SHEET: unknown;

// template helpers the redesign added to the fork (src/module/handlebars/BasicHelpers.ts there)
Handlebars.registerHelper('essenceValue', (value: number) => Helpers.formatEssence(value));
// every modification of the item's kind it holds, installed first (the expanded rows show the others dimmed): the
// release keeps them inside the item (item.items), the fork on the actor below it (childItems)
Handlebars.registerHelper('itemMods', (item: any) => {
    const type = item?.modificationType?.();
    if (!type) return [];
    return Array.from((item.childItems ?? item.items ?? []) as Iterable<any>)
        .filter(child => child.type === 'modification' && child.system.type === type)
        .sort((a, b) => Number(b.isEquipped()) - Number(a.isEquipped()));
});
Handlebars.registerHelper('essenceIsWhole', (value: number) => Number.isInteger(Math.round(Number(value ?? 0) * 100) / 100));
Handlebars.registerHelper('forceValue', (base: string, modifier: number) => Helpers.formatForceValue(base, modifier));
Handlebars.registerHelper('sourceIcon', (value: string) => LinksHelpers.sourceIcon(value));
Handlebars.registerHelper('sourceLabel', (value: string) => LinksHelpers.sourceLabel(value));

// the sheet's settings: their own entry in Configure Settings (the module's id is their namespace in the fork too)
RedesignSettings.register();

// token copies off the viewed scene rebuilt when read, as in the fork (src/module/token/LazyBaseActorSync.ts): it wraps
// the system's token class here, before any token exists, and stays out on its own when Foundry or the system changed
// what it relies on; the world setting "Faster updates of token copies" turns it off. Remove this line to take it out.
installLazyBaseActorSync();

foundry.documents.collections.Actors.registerSheet('sr5-redesign', SR5CharacterSheetRedesign as any, {
    label: 'SR5.SheetActorRedesign',
    makeDefault: true,
    types: ['character'],
});
// vehicles and drones in the same look (the system's vehicle sheet stays one choice away in Configure Sheet)
foundry.documents.collections.Actors.registerSheet('sr5-redesign', SR5VehicleSheetRedesign as any, {
    label: 'SR5.SheetActorRedesign',
    makeDefault: true,
    types: ['vehicle'],
});
// IC in the same look; it takes its actions by IC type from the system's IC sheet (shims/ic-sheet.ts), so it is offered
// only when that sheet was caught
if (SYSTEM_IC_SHEET) foundry.documents.collections.Actors.registerSheet('sr5-redesign', SR5ICSheetRedesign as any, {
    label: 'SR5.SheetActorRedesign',
    makeDefault: true,
    types: ['ic'],
});

// every module template is a partial somewhere (rows are included by type name), so all of them are loaded up front
void foundry.applications.handlebars.loadTemplates(MODULE_TEMPLATE_PATHS);

// the release's modifier flow gets the fork's totalsFor as soon as there is an actor (the sheets patch it too, the
// rich cards of a sheet that has not opened yet rely on this one)
Hooks.once('ready', () => {
    SR5CharacterSheetRedesign.warmUp();
    const actor = (game as any).actors?.contents?.[0];
    if (actor) ModifierFlow.patch(actor.modifiers);
});
