# SR5 Redesign

An unofficial redesign of the **Shadowrun 5e** system's sheets for Foundry VTT v14. It adds new sheets and leaves the
system and its data alone; the system's own sheets stay available. Turn the module off and characters go back to the
system's sheet.

Today it covers the **character sheet** and the **vehicle and drone sheet**, with the windows they open (karma, nuyen and
reputation managers, the network manager). The goal for 1.0 is the whole interface: matrix actors, spirits, critters and
NPCs, items, roll dialogs and chat cards.

## What it is for

**A sheet that looks like the books.** The colours were measured from the SR5 rulebooks: dark pages with gold accents,
and a light theme as well. Headings, plates and tables take their cues from the books, set in free fonts picked to stand
in for the books' typefaces (Orbitron, Barlow Condensed, Marcellus). Cyrillic text keeps the look through free
look-alike fonts.

**Less clicking at the table.**
- Combat in one sidebar: initiative and Blitz, condition monitors with wound modifiers and overflow damage, armor,
  movement and quick rolls (Defense, Soak, Composure, Judge Intentions, Memory, Lift/Carry, Drain or Fading), each with
  its dice pool shown.
- Skills show their pools. Play mode lists trained skills; search and filters (attribute, skill group, trained or
  untrained) find the rest.
- Inventory, augmentations, actions and magic have search, filters and sorting; every table header sorts its column,
  remembered per user.
- Hover cards for items, skills, attributes, limits, armor and movement, with the modifier breakdown where a value has
  modifiers and a link to the rulebook page.
- Favorites: drop an item on the favorites, drag to reorder.
- A ⋮ menu in every row; sheets open at the size you last gave one.

**Something to look at.** The character's art as a banner in the sheet header, moved and zoomed to frame it. The
vehicle and drone sheet shares the look, with a portrait or the token picture.

**Quick to use.** An update redraws only what changed: a damage box, Edge, karma or an item toggle costs about a third
of a full render. Hidden tabs are drawn when the browser is idle or when you open them, and the first sheet after a page
load opens faster.

**Easier to read.** A per-user **Readable text** setting makes the condensed type a weight heavier and slightly wider. On
smaller screens the sheet keeps its margins and the attribute plates stay readable down to Foundry's minimum window
size.

## In detail

- Header: name, metatype and archetype, limits, sheet art.
- Attribute plates with modifier cards; Edge and Essence (whole numbers without decimals).
- Sidebar: initiative modes and Blitz, condition monitors with wound modifiers, armor and movement, quick rolls
  (Defense, Soak, Composure, Judge Intentions, Memory, Lift/Carry, Drain or Fading) with their pools, favorites,
  running silent and the PAN; collapsible.
- Skills with pools; search and a filter menu (trained / untrained, attribute, skill group). Play mode lists trained
  skills, edit mode all of them.
- Inventory, augmentations, actions and magic: search, filter menus (magic: by damage element too) and a sort button
  (sheet order, name A–Z, Z–A); every table header sorts its column, remembered per user. Rich hover cards for items,
  skills, attributes, limits, armor and movement, with a link to the rulebook page.
- Expanded rows: an item's properties in one line with icons, its rulebook source at the top right, the Matrix
  condition monitor on a line of its own. A ⋮ menu button in every row.
- Favorites: drop an item row (or any item) on the favorites to add it; drag to reorder.
- Overflow damage as a third condition monitor under the physical track.
- Matrix: device card with swappable attributes, actions grouped by limit, network / marked / owned icons.
- Footer: karma, nuyen, street cred, notoriety, public awareness.
- Dark and light themes (the sheet's own theme in Configure Sheet, or Foundry's).
- Latin and Cyrillic text: the sheet fonts have no Cyrillic, so free look-alikes fill in for Cyrillic letters only.

## Install

Foundry modules live on the server, so install it on the machine that **hosts** the game. Players who connect get it
automatically.

1. Unzip `sr5-redesign-<version>.zip` into `{Foundry user data}/Data/modules/`, so that you get
   `Data/modules/sr5-redesign/module.json`.
2. Start Foundry, open the world, **Game Settings → Manage Modules**, enable **SR5 Redesign**, save (the world reloads).
3. Characters open in **SR5 Redesign (experimental)** from then on. A character that was set to a particular sheet
   keeps it: header menu **Sheet** (Configure Sheet) → choose SR5 Redesign.

To remove: disable the module; characters go back to the system's sheet.

UI skins such as Carolingian UI restyle every heading, tooltip, window header and context menu from their own
stylesheet; the sheet, its tooltips and the windows it opens keep their own type and layout against that (0.3.1).

Updating: unzip the new version over the old folder (or delete `Data/modules/sr5-redesign` first), then reload the
browser with the cache bypassed (Ctrl+F5 / Cmd+Shift+R) so the new stylesheet and fonts are fetched.

Built for Shadowrun 5e **0.37.8** (Foundry v14). Other 0.37.x releases should work; a newer system version prints a
warning in the console and may need a rebuild of the module.

Russian: the separate `sr5-ru-locale` archive holds a draft Russian translation of the system and this sheet.

## Credits and licenses

- Sheet logic builds on the Shadowrun 5e system for Foundry VTT, GPL-3.0 — https://github.com/SR5-FoundryVTT/SR5-FoundryVTT,
  and the script contains parts of it. This module is GPL-3.0 as well (see LICENSE).
- Fonts, all under the SIL Open Font License 1.1: Orbitron, Barlow Condensed, Marcellus, and the Cyrillic look-alikes
  Days One, Sofia Sans Condensed, Forum. The files are the original releases from the Google Fonts repository, packed
  into WOFF2 without any change; `fonts/README.md` lists authors, sources and checksums, and each font's `OFL.txt` is
  next to it.
- Colours were measured from the SR5 rulebooks. No Catalyst Game Labs or Topps art or logos are included.
  Shadowrun is a trademark of The Topps Company, Inc.; this is an unofficial fan work.
