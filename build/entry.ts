// SR5 Redesign module entry. Runs inside the 'init' hook (build.mjs wraps the bundle), after the Shadowrun 5e system
// registered its documents, configuration and sheets.
import { SR5CharacterSheetRedesign } from '@/module/actor/sheets/SR5CharacterSheetRedesign';
import { SR5VehicleSheetRedesign } from '@/module/actor/sheets/SR5VehicleSheetRedesign';
import { ModifierFlow } from '@/module/actor/flows/ModifierFlow';
import { Helpers } from '@/module/helpers';
import { LinksHelpers } from '@/module/utils/links';
import { RedesignSettings } from '@/module/actor/sheets/RedesignSettings';

declare const MODULE_TEMPLATE_PATHS: string[];

// template helpers the redesign added to the fork (src/module/handlebars/BasicHelpers.ts there)
Handlebars.registerHelper('essenceValue', (value: number) => Helpers.formatEssence(value));
Handlebars.registerHelper('essenceIsWhole', (value: number) => Number.isInteger(Math.round(Number(value ?? 0) * 100) / 100));
Handlebars.registerHelper('forceValue', (base: string, modifier: number) => Helpers.formatForceValue(base, modifier));
Handlebars.registerHelper('sourceIcon', (value: string) => LinksHelpers.sourceIcon(value));
Handlebars.registerHelper('sourceLabel', (value: string) => LinksHelpers.sourceLabel(value));

// the sheet's settings: their own entry in Configure Settings (the module's id is their namespace in the fork too)
RedesignSettings.register();

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

// every module template is a partial somewhere (rows are included by type name), so all of them are loaded up front
void foundry.applications.handlebars.loadTemplates(MODULE_TEMPLATE_PATHS);

// the release's modifier flow gets the fork's totalsFor as soon as there is an actor (the sheets patch it too, the
// rich cards of a sheet that has not opened yet rely on this one)
Hooks.once('ready', () => {
    SR5CharacterSheetRedesign.warmUp();
    const actor = (game as any).actors?.contents?.[0];
    if (actor) ModifierFlow.patch(actor.modifiers);
});
