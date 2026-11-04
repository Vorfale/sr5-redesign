// The system's IC sheet class, caught when the system registered it (the wrapper in build.mjs), as the character sheet
// (sheet-base.ts): the redesign's IC sheet takes its actions by IC type from it (SR5ICSheetRedesign._getMatrixPackActions).
// Bundling the release's own file instead would bring its whole sheet chain into the module.
declare const SYSTEM_IC_SHEET: any;

export const SR5ICActorSheet = SYSTEM_IC_SHEET;
