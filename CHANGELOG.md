# Changelog

All notable changes to SR5 Redesign. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
newest first.

## Versioning

- Below 1.0: MINOR when a release brings a noticeable new area or a large feature, PATCH for everything else,
  small features anywhere included.
- 1.0: the whole interface redesigned (character, vehicles and drones, matrix actors, spirits, critters and NPCs,
  items, roll dialogs, chat cards) and stable in live play.
- After 1.0: [Semantic Versioning](https://semver.org/). MAJOR means breaking for users: the format of flags or
  settings, or dropped support for a Foundry or system version.
- The system dependency lives in `module.json` (relationships), not in the version number.
- Currently built for the Shadowrun 5e system 0.37.x (verified 0.37.8), Foundry v14.

Versions up to 0.3.47 were numbered before this scheme was written down: under it, 0.3.41 (the vehicle and drone
sheet) would have been a minor release.

## [Unreleased]

## [0.3.67] - 2026-10-30

### Changed
- Character attribute plates follow the rulebooks' stat blocks: Edge, Essence, then Magic or Resonance (Essence was
  last).
- Vehicle sheet: the On Road / Off Road switch under Conditions shows only for vehicles whose off-road Handling, Speed
  or Acceleration differ from the on-road ones (cars, bikes, trucks, some boats and ground drones). Aircraft,
  submarines and most drones have one value, so the switch changed nothing for them. The chase environment (Speed /
  Handling) stays for every vehicle, in the air too.

## [0.3.66] - 2026-10-29

### Fixed
- The page froze when a skill row was opened or a skill card shown after the compendium holding the imported rulebook
  text had been deleted. Rows and cards now open without the text, the page links stay, and the console says what is
  missing; import the books again to bring the text back.

## [0.3.65] - 2026-10-28

### Fixed
- An IC without a host: its rating and matrix attributes typed on the plates in edit mode now stick (they were
  replaced with 0).
- The IC sheet opened slowly the first time after a reload when the grids hold many tokens: it now opens at once and
  draws its IC tab under the field of 0s and 1s, as the character sheet's Matrix tab does. A character sheet that
  opens on its Matrix tab does the same.
- An error in the console when a token was created.

## [0.3.64] - 2026-10-28

### Added
- An IC sheet in the same look, the default for IC (the system's IC sheet stays one choice away in Configure Sheet).
  The header line shows its type and the host it runs on. Plates show the host's rating and the four matrix
  attributes, coloured by role, and a click rolls one. The sidebar holds its initiative (Host Rating × 2 + 4D6) and
  its matrix condition monitor. The IC tab lists its host, the icons it knows and has marked, and its actions by IC
  type. Its rich cards cover the plates, the initiative and the monitor.
- The IC sheet's footer: the host (its button opens it) with its rating, the IC's place in the host's order beside
  how many IC the host may run at once, and the marks the host holds, which its IC share.
- A token's copy of an IC reads the host of its base actor.
- Text from your own rulebooks: Configure Settings > SR5 Redesign > Import from PDF reads the PDFs you choose in
  your browser (nothing is uploaded) and adds their passages to the hover cards and opened rows of attributes,
  skills, actions, spells and rituals, qualities, adept powers, complex forms, metamagics and echoes. The text is kept
  in a compendium of the world.

## [0.3.63] - 2026-10-26

### Added
- Groups of your own on the Inventory, Augmentations, Magic (spells) and Vehicles & Drones tabs, as on the Actions
  tab. In edit mode the + by the tab title makes one; a group renames, removes and adds a new item (or vehicle)
  into itself. Drag a row onto a group, or use "Move to group" in its menu, to put it there; drag it back onto its
  own card to take it out. An item or vehicle dropped from elsewhere on a group is added and put there.
- Inventory and Augmentations groups may hold different types: each type gets its own section with its columns.
- Removing a group deletes nothing: what was in it goes back to its own cards.

### Changed
- Inventory and Augmentations: one + by the title, with a menu for a new group or a new inventory.
- Creating and renaming an inventory asks in the sheet's own dialog; the new or renamed inventory is selected.
- "Move to group" in row menus has a folder icon, so it no longer looks like "Move Item".

## [0.3.62] - 2026-10-23

### Added
- Stat cards on the sidebar's condition monitors (damage, wound modifier, recovery pool, where the boxes come from)
  and on the initiative (mode, formula, score, where the attribute and the dice come from).
- Actions move to another group of the Actions tab: drag a row onto a group card, or use "Move to group" in the
  row menu in edit mode. General actions move too.
- Armor and implant modifications show as chips in their expanded rows, the ones not installed dimmed. An implant
  shows its capacity, red when its modifications take more than it has. A weapon shows its loaded ammunition by
  name. A modification dropped on a weapon, armor or implant row goes into it installed.
- Implant grade in the expanded row (rating, grade and Essence), and grade filters on the Augmentations tab.
- Interrupt actions show their initiative cost in the Type column. Opened action rows show the pool, limit, opposed
  test, active defenses and book pages of their tests; costs you cannot pay in combat are muted.
- General actions from the system's packs show their book page in their card's footer.
- A Performance setting, on by default: copies of unlinked tokens on scenes nobody is viewing are rebuilt when they
  are read, not at every change of their actor.

### Changed
- Social tab: contacts on the left, SIN and lifestyles on the right. On a narrow sheet SIN and lifestyles go on top
  of the contacts instead of under them.
- Opened rows are spaced by what belongs together (10px to the description, 6px between paragraphs) on one left edge.
- The sheet opens without a blink, and it reads the action and skill group packs once.

### Fixed
- The illusion sense of a spell shows as Single-Sense or Multi-Sense, not as the raw key.

## [0.3.61] - 2026-10-21

### Changed
- Screenshots show the characters only: the vehicle screenshot gives way to the street samurai's augmentations.

## [0.3.60] - 2026-10-21

### Changed
- Screenshots: no "fresh import" marks on the characters' items, the street samurai's header art framed on him, the
  van with a short name.

## [0.3.59] - 2026-10-21

### Changed
- Screenshots: a street samurai and a rigger made for them, with concept art by David Revoy / Blender Foundation
  (Tears of Steel, CC BY 3.0) as portraits and header art; the credit is in the captions and the README.

## [0.3.58] - 2026-10-21

### Added
- Screenshots: a cover and three screenshots in the repository's `media/`, listed in `module.json`.
- `THIRD-PARTY-NOTICES.md`: the copyright and license of Fuse.js, which the script bundles.

### Changed
- Install by the manifest URL; README sections on compatibility and the license. The script's header carries the
  copyright, the GPL notice and the note that the system's code in it was changed.
- The README no longer mentions the separate Russian archive.

## [0.3.57] - 2026-10-21

### Changed
- The module description no longer says "Private test build".
- The README opens with what the module covers and what it is for.

## [0.3.56] - 2026-10-20

### Fixed
- The edit mode switch in the window header: the button's cut corners no longer clip its rounded ends, it sits in the
  middle of the button (the hover fill was off-centre), and its wrench shows in the light theme too.

## [0.3.55] - 2026-10-20

### Changed
- The edit mode switch is the system's own again (the larger toggle).
- The module description no longer claims keyboard and screen reader support.

## [0.3.54] - 2026-10-20

### Changed
- Icons: the sheet uses only Font Awesome Free icons (Pro icons need a license of their own). New icons for the
  Augmentations, Magic and Critter Powers tabs, clearing the sheet art, the vehicle driver, the wireless states (running
  silent: dimmed, off: struck through), the edit mode switch, list expand toggles, lifestyle guests and neighborhood, and
  the source entry of the row menu.

## [0.3.53] - 2026-10-20

### Changed
- Fonts: the original font files, packed into WOFF2 without any change, replace the trimmed copies; each font's
  license, author and source are listed in `fonts/README.md`. The sheet looks the same. The fonts take about 390 KB
  (before: 270 KB); a player with an English interface downloads about 165 KB of them (before: 200 KB).
- Roboto Condensed is gone: headings take the few characters Orbitron lacks (« » · ¥ ≥ ≤) from Barlow Condensed.

### Fixed
- Readable text (setting): bold labels and Cyrillic labels no longer fall back to another font.

## [0.3.52] - 2026-10-20

### Fixed
- Closing a sheet no longer makes its header (the edit mode switch) jump.

### Changed
- Network manager: its row icons light up like the sheet's (gold, no red fill); the connected network's plug is in
  the icons' colour instead of green.
- Lighter redraws: the sheet no longer adds screen reader names to icons and fields or table roles to its lists
  (some 5 ms on every redraw of a full character). Keyboard use stays.

## [0.3.51] - 2026-10-20

### Fixed
- Vehicles & Drones tab: a vehicle you have no permission on no longer expands its description.
- Modification rows show the mount point again (a weapon mod's top, under, barrel...).
- Vehicle sheet: Token mode shows an unlinked token's own image, and the portrait for a wildcard token image; a
  selected token whose actor was deleted no longer breaks the driver menu.
- Sidebar scrollbar: a press that slides off the strip no longer leaves the sidebar scrolling on hover.
- Moving the header art: the name fields keep their arrow, Enter and +/- keys; Enter on Cancel cancels.
- The skill filter chosen in play mode no longer hides new and untrained skills in edit mode.
- Favorites of contacts, programs, SINs and the like update when they change and go away when deleted.
- The window title follows a rename.
- Switching the matrix device on a technomancer with a Living Persona item now takes effect.
- Field labels of the skill search and the inventory picker no longer point at another open sheet.
- A minimized or closing sheet keeps its top-left bevel, with the title clear of it.
- A new implant list no longer shows up for a moment as a plain inventory on the other players' screens.
- Russian: the last English strings of the sheet are translated (settings, action groups and tracker, network
  manager, reboot, sheet portrait).
- Small controls (the monitor's clear and roll, Blitz, full reload, skill set removal) take a 24 × 24 click area.
- Everything clickable now reacts to the pointer: row icons and item names light up (gold on the dark theme; icons
  on a faint grey fill on the light one, no red), quality pills get a gold frame, edit fields, selects and search
  fields a brighter frame.

### Changed
- The Physical limit card has its own icon (the gauge is now the vehicles' Speed only).
- Network manager: one way to disconnect, the button in the banner (the current network's row shows a connected
  mark); the search and filters stay at the top while long lists scroll.
- Fewer redraws: the action tracker ignores turn changes, a vehicle change redraws only the sheets that show it,
  and the per-redraw touch-ups look only at what was redrawn.

## [0.3.50] - 2026-10-20

### Fixed
- Sheets of compendium actors: an item source that points inside the compendium no longer breaks the redraw, so a
  read-only compendium sheet keeps its rolls off and its controls working after an update.

## [0.3.49] - 2026-10-20

### Fixed
- Equipping a weapon or armor mod that carries an effect, or toggling that effect, updates the skill pools and the
  attribute plates at once (they kept the old values until the sheet was reopened).
- The Effects tab shows when a character's only effects sit on a weapon or armor mod.
- A sheet the user can only view (Observer, a locked compendium) switches tabs again; folding the sidebar, search,
  filters and sorting work there too. Rolls and fields stay off.
- Enter in a search or a field no longer switches between play and edit mode; Enter in a field still saves it.
- A sheet with limited permission no longer shows "Part … is not a supported template part" warnings on every change.
- Naming or renaming an implant list with a name in use warns instead of merging it into that inventory.
- Social, Bio, Magic and the other tabs show with their first item and go with their last, without reopening.
- The Matrix tab's own matrix actions refresh when one is added, renamed or deleted.
- Sorting by name treats names with numbers ("HK-227") as text; numbers sort with the language's separators
  ("0,75", "1 500").
- The list search stays quick after many updates (it no longer runs once per earlier redraw).
- Vehicles under a driver: every skill shows the driver's pool, pools are no longer marked red for nothing, and the
  skill card uses the attribute the roll uses.
- Vehicle sheet: the matrix monitor on the Matrix tab, the mod slots and the autosofts refresh at once; a change to the
  driver (name, wounds, deletion) shows on the vehicle.
- The action tracker no longer fails when an actor has several combatants.
- A compendium actor can no longer be dropped on a vehicle as its driver.

## [0.3.48] - 2026-10-20

### Added
- Vehicle sheet: the chase environment and the road get a Conditions section of their own at the bottom of the
  sidebar, as pairs of tiles; the option in use is filled red.
- Vehicle sheet: a Portrait | Token switch in edit mode for the sidebar picture; the token is fitted whole into the
  frame.
- Vehicle sheet: the driver field is a dropdown with a search. The controlled token's character comes first, then
  the player characters and the other characters A–Z; arrow keys, Enter and Escape work. Dropping a character on the
  sheet still sets the driver.
- Vehicle sheet: a rich card on each modification slot row (taken / slots and the installed modifications).

### Changed
- Vehicle sheet: initiative follows the control mode: the vehicle's own Pilot × 2 + 4D6 on autopilot, the rigger's
  VR initiative when jumped in, the driver's initiative in manual and remote control. The tooltip explains it and
  notes that Foundry's combat tracker still rolls the vehicle's own formula.
- Vehicle sheet: the sidebar's matrix section is called Matrix Icon (a vehicle is a device, not a persona).
- Vehicle sheet: Acceleration and Armor plates get the gold hover frame of the plates that roll.
- Icons in fields (initiative, control mode) are muted grey at rest, like every other field icon.
- Driver, control mode and initiative text start on one line; modification slot counts line up digit under digit.
- Matrix loader: only plain 0s and 1s (no slashed zero, no digits drawn over each other mid-fade).

## [0.3.47] - 2026-10-20

### Changed
- The Matrix tab's loading field of 0s and 1s is drawn in the sheet's red instead of gold.

## [0.3.46] - 2026-10-20

### Fixed
- The first opening of the Matrix tab no longer freezes the page on worlds with many tokens on a grid (a second and
  more before). A quiet field of 0s and 1s shows in its place while it loads; later openings are instant. Reduced
  motion shows still digits.

## [0.3.45] - 2026-10-20

### Fixed
- Sorted skill tables (by rating, pool, attribute) no longer flash back to A–Z for a moment after a redraw.

## [0.3.44] - 2026-10-20

### Changed
- The sidebar's scroll bar works as on macOS on every system: in the collapser's strip, shown only while scrolling.

## [0.3.43] - 2026-10-20

### Fixed
- Where scroll bars take room (Windows, or macOS set to always show them), the sidebar's bar no longer lies under the
  collapse caret, and the caret no longer fades after a redraw.

## [0.3.42] - 2026-10-19

### Changed
- The sidebar's scroll bar sits beside the card, in the collapser's strip; the wheel over the strip scrolls the
  sidebar, and the caret steps aside while it scrolls.

### Fixed
- Nothing in the sidebar shifts sideways when it starts to scroll.
- A press on the scroll thumb in the collapser's strip still collapses the sidebar unless the pointer moves.
- Clicking a damage box no longer redraws (and blinks) the skills tab unless the wound modifier changes.
- The Matrix tab is no longer prepared in the background while it is hidden (over a second of freeze on worlds with
  many tokens on a grid).

## [0.3.41] - 2026-10-19

### Added
- Vehicle and drone sheet in the same look: stat plates with base values and vehicle test limits, a sidebar with
  driver, control mode, initiative, damage and matrix tracks, chase environment and road switches; a Vehicle tab with
  skills and pools, modification slots (or a drone's mod points) and autosofts; inventory, matrix, actions, effects,
  description and configuration as on the character. Rich cards for the vehicle stats, limits, armor and movement.
- Vehicles & Drones tab on the character sheet: the vehicles the character drives, in Vehicles and Drones cards with
  the stat line, a rich card per row, search, filters (type, control mode, damaged), column sort and three views (by
  type, by category, one list). Rows expand with the vehicle's own condition and matrix monitors; drop a vehicle on
  the sheet to make the character its driver; edit mode adds, unlinks and deletes vehicles.
- Magic tab views: spells by category or all in one table with a Category column; the filter offers spell categories.
- Setting (per user): show qualities on the Details tab.
- Empty tables show an empty row; a tab with nothing in it shows one empty state in play mode.
- NPCs and critters: the footer says what the actor is (Critter, NPC, Grunt). Prime runners keep karma, nuyen and
  reputation, grunts nuyen only, critters none. A grunt's single track is captioned Condition Monitor.
- The actor's source (book page or link) moves to the right corner of the footer.

### Changed
- One view button on every tab with views (Actions, Magic, Vehicles & Drones).
- Sprinting bonus: edited on the Configuration card and shown in the Run card, no longer on the Details tab.
- Play mode draws only the tables that have rows; edit mode draws all of them, the spell category cards included.
- All dropdown carets share one size and turn up while their list is open.

### Fixed
- Add on a spell category card creates a spell of that category.
- Tab title rows with controls are no longer 2px taller than plain ones.
- Filter menu icons sit on the middle of their labels.

## [0.3.40] - 2026-10-19

### Changed
- Show Empty Categories is off by default and, when ticked, also shows the empty tables in play mode.
- The Configuration card's selects share one width.

### Fixed
- Icons in gold captions sit centred on the capitals.

## [0.3.39] - 2026-10-19

### Fixed
- Weapon and armor modifications show what they fit in their expanded row (not only the source link).

## [0.3.38] - 2026-10-19

### Fixed
- Expanded rows keep the table's values (rating, essence, level, marks) when the source link would otherwise stand
  alone.

## [0.3.37] - 2026-10-19

### Fixed
- Deleting from the sheet asks through the sheet's own confirmation instead of the system's dialog.

## [0.3.36] - 2026-10-19

### Added
- Adept powers: Level and PP columns beside Type.

### Changed
- Move-to-inventory and delete confirmations in the sheet's look.
- The sheet opens 940px wide; the Social tab shows two columns of cards while they fit, one on narrow sheets.
- Columns line up across stacked cards on every tab.
- Scroll bars in the sidebar's grey on every scroller of the sheet, its windows, menus and tooltips.
- Faster opening and redraws: hidden tabs are drawn when the browser is idle or when they open.

### Fixed
- Sheet menus no longer show scroll bars or a gap under the last entry.
- The source link keeps the top right corner of an expanded row; no line starts with a divider.
- Nested rows in matrix icon lists highlight edge to edge.

## [0.3.35] - 2026-10-17

### Fixed
- Edit buttons on a tab's title row have the inventory controls' look.

## [0.3.34] - 2026-10-17

### Added
- Actions tab: own action groups in edit mode (add, rename, remove); each group's Add puts a new action in it.

### Fixed
- Header Add links show the word and the + side by side.

## [0.3.33] - 2026-10-17

### Added
- Actions tab: a button by the search groups actions by kind (Attacks, Defense, Interrupts, Resistance, Magic,
  Matrix, Social and more), each a collapsible, sortable card.

## [0.3.32] - 2026-10-17

### Fixed
- The » « around the header subtitle sit level with its capitals.

## [0.3.31] - 2026-10-17

### Changed
- The action pools of 0.3.28 to 0.3.30 are taken out again until they are redesigned.

## [0.3.30] - 2026-10-17

### Fixed
- Opening a sheet no longer pops up "can't be defaulted" warnings while it prepares the action pools.

## [0.3.29] - 2026-10-17

### Changed
- Matrix action tables get their Marks and Type columns back; the pool moves into every action's expanded row.

## [0.3.28] - 2026-10-17

### Added
- Actions and Matrix actions: a Pool [Limit] column with the dice each action rolls ("14 [5]"), with a tooltip that
  adds it up; rich cards show the pool an item rolls.

## [0.3.27] - 2026-10-17

### Changed
- The initiative caption gets an icon like the other sidebar titles.

## [0.3.26] - 2026-10-17

### Added
- Readable text (per-user accessibility setting): the sheet's condensed type a weight heavier and slightly wider.

## [0.3.25] - 2026-10-17

### Fixed
- With the action tracker off, the sheet no longer watches the combat and redraws on every turn.

## [0.3.24] - 2026-10-17

### Added
- The module's settings get their own entry in Configure Settings. First setting: show actions in the sidebar, off
  by default.

## [0.3.23] - 2026-10-17

### Changed
- The action tracker is drawn as three lozenges like armor / walk / run; right click or Shift + click gives an action
  back.

## [0.3.22] - 2026-10-17

### Added
- Action tracker in the sidebar: one Free Action and two Simple or one Complex Action per pass, spent with a click.
  In combat it resets every initiative pass; edit mode sets the Free Actions per phase.

## [0.3.21] - 2026-10-17

### Fixed
- Dialog buttons keep their own colour when focused (Cancel no longer opens red).

## [0.3.20] - 2026-10-17

### Added
- Network manager and reboot prompt in the sheet's look. The network manager gets search, filters and sort, Grids
  and Hosts tables and rich cards for hosts; the reboot prompt says what a reboot does.

## [0.3.19] - 2026-10-17

### Changed
- Matrix device card: one spacing scale; the attribute plates span the card's width.

## [0.3.18] - 2026-10-17

### Changed
- Matrix device card: the device fields sit on the card itself; a cyberdeck shows a keyboard icon.

## [0.3.17] - 2026-10-17

### Fixed
- The device field lines up with the attribute plates and the monitor below it.

## [0.3.16] - 2026-10-17

### Fixed
- The device field shows no focus ring after a choice with the pointer; even spacing around the fields.

## [0.3.15] - 2026-10-17

### Added
- Matrix device card: choose the device from a dropdown (equips it and unequips the others); the card keeps its
  height when switching between a cyberdeck and a commlink.

## [0.3.14] - 2026-10-17

### Fixed
- The ammo column has room for the partial reload button; a row's icons share one colour.
- A middle click that locks a tooltip no longer starts the browser's autoscroll (Windows).

## [0.3.13] - 2026-10-17

### Fixed
- A pool is marked as reduced whenever a wound takes dice away, even when a bonus makes up for it.

## [0.3.12] - 2026-10-17

### Changed
- Condition monitors fill flat, without gradients.

## [0.3.11] - 2026-10-17

### Changed
- Stun damage fills blue, as on the system's sheet.

## [0.3.10] - 2026-10-17

### Changed
- Matrix damage fills green, so it no longer looks like stun.

## [0.3.9] - 2026-10-17

### Added
- Skills: a sort button by the search (name A–Z, Z–A, pool, rating), remembered per user.
- Sheet portrait: choose an image for the sheet only, or go back to the actor's portrait (edit mode).

## [0.3.8] - 2026-10-17

### Changed
- Shooting, reloading and stack counts redraw only the inventory and sidebar, and updates arriving together render
  once.

### Fixed
- Partial redraws now update everything they touch: recoil on the Configuration tab, Edge uses, quality pills, the
  Matrix tab appearing for a newly equipped device.

## [0.3.7] - 2026-10-17

### Changed
- Cheaper redraws and tab switches.

### Fixed
- The Matrix tab no longer comes back with empty action and icon lists after a partial redraw.
- Rows no longer get a second source link after a partial redraw.

## [0.3.6] - 2026-10-17

### Changed
- The first sheet opens faster after a page load: its pictures, the quick roll actions and the templates are loaded
  ahead while the browser is idle.

## [0.3.5] - 2026-10-17

### Fixed
- The sheet's fonts load when the world is ready, so the first sheet no longer draws invisible text for a moment.

## [0.3.4] - 2026-10-17

### Changed
- Smoother scrolling, hovering and sidebar collapse: the window shadow is drawn once instead of on every repaint.

## [0.3.3] - 2026-10-17

### Fixed
- Column and group headings keep their type against UI skins such as Carolingian UI.

## [0.3.2] - 2026-10-17

### Changed
- An update redraws only the parts of the sheet that show what changed: a damage box, Edge, karma or an item toggle
  costs a third of a full render.
- The sidebar collapse animates more smoothly.
- The sheet's context menus in the sheet's look, cut like the filter menu.

## [0.3.1] - 2026-10-16

### Changed
- The sidebar slides with transforms instead of laying out every row on each frame.

### Fixed
- The sheet, its tooltips and the windows it opens keep their own type and layout against UI skins such as
  Carolingian UI.

## [0.3.0] - 2026-10-16

### Added
- Pools show what will be rolled: wound and global modifiers and effects, marked in colour when dice are lost, with a
  tooltip that adds them up.
- Favorites: drop an item row (or any item) where it should go, drag to reorder, Alt + Up / Down in edit mode.
- Rich cards for contacts, lifestyles, effects and quality pills; cards open beside their table, by keyboard focus
  too, and the pointer can enter them. Attribute, limit, armor and movement cards link their rulebook page.
- Karma, nuyen and reputation managers in the sheet's look.
- A ⋮ menu button in every row; context menus work from the keyboard (Shift + F10 or the Menu key).
- Sorting: every table header sorts its column (again reverses, a third time resets), remembered per user; a sort
  button on inventory, augmentations and magic.
- Actions tab: search and the action type filter.
- Magic filter: damage element, offering only the elements the actor's spells deal.
- Source links look the same everywhere and sit in the expanded row; skills, spells and complex forms get theirs.
- Overflow damage as a third condition monitor under the physical track.
- Configuration modifiers explain their value; lifestyle cost shows its period.
- Sheets open at the size the user last dragged one to; the header art can be zoomed as well as moved.

### Changed
- Expanded rows: an item's properties in one line with an icon each, leaving out what the columns already show; a
  device's Matrix monitor on a line of its own.
- Matrix monitor built like the sidebar's monitors; item monitors with larger boxes.
- Controls are at least 24 × 24 px; row icons evenly spaced.
- Row names 15px on every tab; skill ratings in the same type as their pool; the roll icon is a six die.
- Light theme: warmer near-black text; the Blitz switch readable in both themes, also without Edge.
- The sidebar collapses at once, also on a remote host.

### Fixed
- No flicker or fade-in after each change on the sheet.
- Summoning and compiling rows show the spirit or sprite type localized.
- Drain and Fade in expanded rows written like their columns ("Drain F − 1").

## [0.2.0] - 2026-10-14

First release as SR5 Redesign (module id `sr5-redesign`). Install it as a new module: it does not replace
`sr5-dnd-sheet`.

### Added
- Card layout on every tab, with section plaques and one table grid; a separate Augmentations tab.
- Matrix tab: device card with swappable attributes, actions grouped by limit, network card.
- Sidebar: initiative modes and Blitz, the PAN, running silent, favorites; collapsible.
- Header: metatype, archetype and Awakened / Emerged; the header art can be moved in edit mode.
- Rich hover cards for items, skills, favorites, attributes, limits, armor and movement.
- Search and filter menus on inventory, augmentations and magic (spell type, range, duration); a skill filter menu
  (trained / untrained, attribute, skill group).
- Cyrillic look-alike fonts, so Russian text keeps the sheet's look; a separate `sr5-ru-locale` archive with a draft
  Russian translation.

### Changed
- Essence shows whole numbers without decimals (6, 1) and fractions with two (0.30, 1.25); an item rating of 0
  shows a dash.
- Drain and Fade read as in the rulebooks (F, F − 3, L + 1).
- Light theme: tooltips follow the sheet's theme; dark row icons, red checkboxes.
- Smaller screens: the sheet keeps its margins and the attribute plates stay readable down to Foundry's minimum.

### Fixed
- Rich cards no longer open over a context menu.
- Item cards read essence, availability and cost from system 0.37 items.

## Prehistory

### [0.1.0] - 2026-10-12

Released as **SR5 Runner Sheet (dnd5e-style)**, module id `sr5-dnd-sheet`: the same sheet before it was renamed to
SR5 Redesign in 0.2.0.

- First private test build: limits in the header; a sidebar with armor, Edge, initiative, condition monitors with
  wound modifiers, quick rolls with their pools and favorites; skills, languages and knowledge with their dice pools
  (play mode lists trained skills only); karma, nuyen and reputation in a footer.
- SR5 colours and free stand-in fonts; dark and light themes; keyboard and screen-reader support.
