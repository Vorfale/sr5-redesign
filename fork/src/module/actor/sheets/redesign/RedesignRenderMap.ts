// What a document update redraws on the redesigned sheets (partial renders), and which parts are drawn when
// (SR5CharacterSheetRedesign#updateParts, #shownParts, #refreshStaleWhenIdle).

/** Run a callback when the browser has nothing else to do (Safari has no requestIdleCallback: a second later). */
export const onIdle = (callback: (deadline?: IdleDeadline) => void) => {
    if (window.requestIdleCallback) window.requestIdleCallback(callback);
    else window.setTimeout(callback, 1000);
};

/** Render option: the parts are already the ones that show (#shownParts), or stale ones drawn when idle. */
export const SHOWN_PARTS = Symbol('shownParts');
/**
 * Parts drawn inside another part's markup (its empty `data-application-part` slots): the matrix tab's icon lists,
 * programs and action tables. They are drawn with their parent, never without it.
 */
export const NESTED_PARTS: Record<string, string[]> = {
    matrix: ['networkIcons', 'markedIcons', 'ownedIcons', 'programs', 'matrixActions', 'complexForms', 'compilations', 'spritePowers'],
};
export const PARENT_PART: Record<string, string> = Object.fromEntries(Object.entries(NESTED_PARTS).flatMap(([parent, children]) => children.map(child => [child, parent])));
/**
 * Parts drawn only when their tab shows, never in the idle redraw of hidden tabs (#refreshStaleWhenIdle): the matrix
 * tab and the parts placed in it. Its network icons resolve every device on the character's grids, and the system
 * builds a token actor for each token among them on first use (70 tokens of another scene on a grid: 1.2 s in one
 * task on every client, b152). Few players open the Matrix tab, so the cost waits for the one who does.
 */
export const SHOWN_ONLY_PARTS = new Set(['matrix']);

/**
 * Parts to redraw for a document update, by what changed (the update's renderData keys). An update redraws every
 * part by default: 26 parts and some 5000 nodes on a full character, 150 ms and more on a slower machine for one
 * damage box. Each rule lists every part that shows the data it matches; an update with a key no rule covers redraws
 * the whole sheet, as before.
 */
export const UPDATE_PARTS: [RegExp, string[]][] = [
    [/^(_id|_stats\.)/, []], // bookkeeping of every update
    // monitors; the skill pools only when the wound modifier changes (#updateParts: a box below the next wound
    // threshold redrew the whole skills tab, the list blinked on every click)
    [/^system\.track\.matrix\./, ['sidebar', 'matrix']], // a vehicle's matrix monitor, on its Matrix tab too
    [/^system\.track\./, ['sidebar']],
    [/^system\.attributes\.edge\.uses$/, ['sidebar', 'abilities']], // the Edge plate shows what is left
    [/^system\.initiative\./, ['sidebar']],
    [/^system\.matrix\.running_silent$/, ['sidebar', 'matrix']],
    // every shot: ranged attack pools take it, the configuration tab lists it among the situational modifiers
    [/^system\.values\.recoil\./, ['inventory', 'actions', 'sidebar', 'misc']],
    [/^system\.(karma|nuyen|street_cred|notoriety|public_awareness)(\.|$)/, ['footer']],
    [/^flags\.shadowrun5e\.(sheetArt|sheetArtPosition|archetype)$/, ['header']],
    // the vehicle sheet: its control group and the stat plates / limits follow the road and chase environment
    [/^system\.(controlMode|environment|isOffRoad|driver)$/, ['sidebar', 'abilities', 'skills']],
    [/^system\.(availability|cost)$/, ['footer']],
    [/^flags\.shadowrun5e\.(-=)?(sheetPortrait|sheetPortraitMode)$/, ['sidebar']],
    [/^flags\.shadowrun5e\.(actionsUsed|freeActions)(\.|$)/, ['sidebar']], // the action tracker
    [/^flags\.shadowrun5e\.(-=)?(actionGroups|actionGroupOf)(\.|$)/, ['actions']], // the Actions tab's own groups
];
/** Item data that only counts (a weapon's rounds and spare clips, a stack's quantity). */
export const COUNT_KEYS = /^system\.(ammo\.|technology\.quantity$)/;
/**
 * Parts that list an item of a type, plus the sidebar (favorites, armor, quick rolls read items). Types not here,
 * items carrying active effects (they may change anything on the actor) redraw the whole sheet.
 */
export const ITEM_PARTS: Record<string, string[]> = {
    // the tab rail too: the Matrix tab shows while a device is equipped, which any of these can be
    weapon: ['inventory', 'matrix', 'sidebar', 'tabs'],
    armor: ['inventory', 'matrix', 'sidebar', 'tabs'],
    equipment: ['inventory', 'matrix', 'sidebar', 'tabs'],
    ammo: ['inventory', 'matrix', 'sidebar', 'tabs'],
    modification: ['inventory', 'matrix', 'sidebar', 'tabs'],
    device: ['inventory', 'matrix', 'sidebar', 'tabs'],
    program: ['matrix'],
    // the tab rail with the types a tab shows for (empty tabs are hidden in play mode): the first spell shows Magic
    spell: ['magic', 'sidebar', 'tabs'],
    ritual: ['magic', 'sidebar', 'tabs'],
    adept_power: ['magic', 'sidebar', 'tabs'],
    call_in_action: ['magic', 'matrix', 'sidebar', 'tabs'],
    complex_form: ['matrix', 'sidebar'],
    sprite_power: ['matrix', 'sidebar'],
    action: ['actions', 'matrix', 'sidebar'], // the Matrix tab lists the actor's own matrix actions
    quality: ['bio', 'sidebar', 'skills', 'tabs'], // the skills tab shows them as pills
    metamagic: ['bio', 'tabs'],
    echo: ['bio', 'tabs'],
    contact: ['social', 'tabs'],
    sin: ['social', 'tabs'],
    lifestyle: ['social', 'tabs'],
    critter_power: ['critterPowers', 'sidebar', 'tabs'],
};
