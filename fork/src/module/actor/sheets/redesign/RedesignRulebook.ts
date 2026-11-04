import { RedesignActionDetails } from '@/module/actor/sheets/redesign/RedesignActionDetails';
import type { SR5Item } from '@/module/item/SR5Item';

/**
 * Text from the user's own rulebooks on the hover cards and opened rows. The sheet ships no rulebook text: only where
 * each topic is explained (book, printed page, section heading). The GM picks what to import and their PDF of each book
 * it is in, in the settings; the PDFs are read in the browser with Foundry's own pdf.js, never uploaded, and the
 * sections found are kept in a world setting per category, so a card only looks the text up (no PDF work after the
 * import). Each category can be hidden or removed on its own. More topics: add a category (or sections to one) below,
 * a book to BOOKS when they are in one more, and call `RedesignRulebook.excerpt(category, key)` where the card is built.
 */

/** The books the sections are in, by their source code (an item's "SR5 132"), and their titles. */
const BOOKS = {
    SR5: { title: 'Shadowrun 5e Core Rulebook' },
    RG: { title: 'Run & Gun' },
    SG: { title: 'Street Grimoire' },
    SGE: { title: 'Street Grimoire Errata' },
    KC: { title: 'Kill Code' },
    R5: { title: 'Rigger 5.0' },
    DT: { title: 'Data Trails' },
    FA: { title: 'Forbidden Arcana' },
    SSP: { title: 'Shadow Spells' },
    SS: { title: 'Stolen Souls' },
    HT: { title: 'Hard Targets' },
    CA: { title: 'Cutting Aces' },
    BB: { title: 'Bullets & Bandages' },
    BTB: { title: 'Better Than Bad' },
    RF: { title: 'Run Faster' },
    CF: { title: 'Chrome Flesh' },
    DTR: { title: 'Dark Terrors' },
    SL: { title: 'Street Lethal' },
    TCT: { title: 'The Complete Trog' },
    HS: { title: 'Howling Shadows' },
    AP: { title: 'Assassin’s Primer' },
    NF: { title: 'No Future' },
    SAG: { title: 'State of the Art ADL' },
    SASS: { title: 'Sail Away, Sweet Sister' },
} satisfies Record<string, { title: string }>;
type BookCode = keyof typeof BOOKS;
/** How far a PDF's pages may sit from the printed ones (covers, front matter; State of the Art ADL has 9). */
const MAX_OFFSET = 10;

/** Where a book explains a topic: printed page and the section's heading, as printed. */
interface RulebookSection {
    book: BookCode;
    page: number;
    heading: string;
}

const core = (sections: Record<string, { page: number; heading: string }>): Record<string, RulebookSection> =>
    Object.fromEntries(Object.entries(sections).map(([key, section]) => [key, { book: 'SR5' as const, ...section }]));

/** The attribute cards (StatInfo keys): the attribute descriptions, SR5 51-52. */
const ATTRIBUTE_SECTIONS = core({
    body: { page: 51, heading: 'BODY (BOD)' },
    agility: { page: 51, heading: 'AGILITY (AGI)' },
    reaction: { page: 51, heading: 'REACTION (REA)' },
    strength: { page: 51, heading: 'STRENGTH (STR)' },
    willpower: { page: 51, heading: 'WILLPOWER (WIL)' },
    logic: { page: 51, heading: 'LOGIC (LOG)' },
    intuition: { page: 51, heading: 'INTUITION (INT)' },
    charisma: { page: 51, heading: 'CHARISMA (CHA)' },
    essence: { page: 52, heading: 'ESSENCE (ESS)' },
    edge: { page: 52, heading: 'EDGE (EDG)' },
    magic: { page: 52, heading: 'MAGIC (MAG)' },
    resonance: { page: 52, heading: 'RESONANCE (RES)' },
});

/**
 * The skill cards, by the system's skill name: the page of each skill's entry in the skill chapter (SR5 130-147),
 * headed by the name in capitals (some add the linked attribute: "DISGUISE (INTUITION)"). Not in the Core book: Exotic
 * Melee Weapon (only in the list of combat skills) and Flight.
 */
const SKILL_PAGES: Record<string, number> = {
    'Aeronautics Mechanic': 143, 'Alchemy': 142, 'Animal Handling': 143, 'Arcana': 142, 'Archery': 130, 'Armorer': 143,
    'Artificing': 142, 'Artisan': 143, 'Assensing': 142, 'Astral Combat': 142, 'Automatics': 130,
    'Automotive Mechanic': 143, 'Banishing': 142, 'Binding': 142, 'Biotechnology': 144, 'Blades': 130, 'Chemistry': 144,
    'Clubs': 131, 'Compiling': 143, 'Computer': 144, 'Con': 138, 'Counterspelling': 142, 'Cybercombat': 144,
    'Cybertechnology': 144, 'Decompiling': 143, 'Demolitions': 144, 'Disenchanting': 142, 'Disguise': 133, 'Diving': 133,
    'Electronic Warfare': 144, 'Escape Artist': 133, 'Etiquette': 138, 'Exotic Ranged Weapon': 131, 'First Aid': 144,
    'Forgery': 144, 'Free-Fall': 133, 'Gunnery': 146, 'Gymnastics': 133, 'Hacking': 145, 'Hardware': 145,
    'Heavy Weapons': 132, 'Impersonation': 138, 'Industrial Mechanic': 145, 'Instruction': 138, 'Intimidation': 139,
    'Leadership': 139, 'Locksmith': 145, 'Longarms': 132, 'Medicine': 145, 'Nautical Mechanic': 145, 'Navigation': 145,
    'Negotiation': 139, 'Palming': 133, 'Perception': 133, 'Performance': 139, 'Pilot Aerospace': 146,
    'Pilot Aircraft': 147, 'Pilot Exotic Vehicle': 147, 'Pilot Ground Craft': 147, 'Pilot Walker': 147,
    'Pilot Watercraft': 147, 'Pistols': 132, 'Registering': 143, 'Ritual Spellcasting': 142, 'Running': 133,
    'Sneaking': 133, 'Software': 145, 'Spellcasting': 143, 'Summoning': 143, 'Survival': 133, 'Swimming': 134,
    'Throwing Weapons': 132, 'Tracking': 134, 'Unarmed Combat': 132,
};

/**
 * The actions' entries: page and heading of each, by book (the lists of Free, Simple and Complex Actions SR5 163-168,
 * combat SR5 168-207, the Matrix actions SR5 237-243, IC SR5 248, Resonance actions SR5 250, the new actions of Run & Gun
 * 119-127, Kill Code 37-40, Rigger 5.0 30, Data Trails 178-179...). An action finds its entry by the book of its source
 * and its name (actionKey), or in ACTION_ALIASES where the heading is not its name. Chummer's spell defenses
 * (Detection Spell Defense...) have their spell category's text, which says how they are resisted; its other defenses
 * and resistances of their own (Melee Defense, LOG Firewall Defense...) have no entry.
 */
const ACTION_HEADINGS: Partial<Record<BookCode, [number, string][]>> = {
    SR5: [
        [152, 'COMPOSURE (CHA + WIL)'], [152, 'JUDGE INTENTIONS (CHA + INT)'], [152, 'LIFTING/CARRYING (BOD + STR)'],
        [152, 'MEMORY (LOG + WIL)'], [163, 'CHANGE LINKED DEVICE MODE'], [163, 'DROP OBJECT'], [164, 'ACTIVATE FOCUS'],
        [164, 'CALL SPIRIT'], [164, 'CHANGE DEVICE MODE'], [164, 'DROP PRONE'], [164, 'EJECT SMARTGUN CLIP'],
        [164, 'GESTURE'], [164, 'MULTIPLE ATTACKS'], [164, 'RUN'], [164, 'SPEAK/TEXT/TRANSMIT PHRASE'],
        [165, 'CHANGE GUN MODE'], [165, 'COMMAND SPIRIT'], [165, 'DISMISS SPIRIT'], [165, 'FIRE BOW'],
        [165, 'FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO'], [165, 'INSERT CLIP'], [165, 'OBSERVE IN DETAIL'],
        [165, 'PICK UP/PUT DOWN OBJECT'], [165, 'QUICK DRAW'], [165, 'READY WEAPON'], [165, 'RECKLESS SPELLCASTING'],
        [166, 'REMOVE CLIP'], [166, 'SHIFT PERCEPTION'], [166, 'STAND UP'], [166, 'TAKE AIM'], [166, 'TAKE COVER'],
        [166, 'THROW WEAPON'], [166, 'USE SIMPLE DEVICE'], [167, 'ASTRAL PROJECTION'], [167, 'BANISH SPIRIT'],
        [167, 'CAST SPELL'], [167, 'FIRE FULL-AUTO WEAPON'], [167, 'FIRE LONG BURST OR SEMI-AUTO BURST'],
        [167, 'FIRE MOUNTED OR VEHICLE WEAPON'], [167, 'LOAD AND FIRE BOW'], [167, 'MELEE ATTACK'],
        [167, 'RELOAD FIREARM'], [167, 'RIGGER JUMP IN'], [167, 'SPRINT'], [167, 'SUMMONING'], [167, 'USE SKILL'],
        [168, 'ARMOR'], [168, 'BLOCK'], [168, 'DODGE'], [168, 'FULL DEFENSE'], [168, 'HIT THE DIRT'],
        [168, 'INTERCEPT'], [168, 'PARRY'], [173, 'STEP 3: DEFEND'], [173, 'STEP 4: APPLY EFFECT'],
        [179, 'SUPPRESSIVE FIRE'], [184, 'SENSOR TARGETING'], [192, 'SURPRISE TESTS'], [195, 'SUBDUING'],
        [199, 'VEHICLE TESTS'], [203, 'CONTROL VEHICLE'], [203, 'MAKE VEHICLE TEST'], [203, 'RAMMING'],
        [207, 'PHYSICAL DAMAGE'], [207, 'STUN DAMAGE'], [228, 'MATRIX DAMAGE'], [228, 'RECONFIGURING YOUR DECK'],
        [229, 'BIOFEEDBACK DAMAGE'], [238, 'BRUTE FORCE'],
        [238, 'CHANGE ICON'], [238, 'CHECK OVERWATCH SCORE'], [238, 'CONTROL DEVICE'], [238, 'CRACK FILE'],
        [238, 'CRASH PROGRAM'], [239, 'DATA SPIKE'], [239, 'DISARM DATA BOMB'], [239, 'EDIT FILE'],
        [239, 'ENTER/EXIT HOST'], [239, 'ERASE MARK'], [239, 'ERASE MATRIX SIGNATURE'], [239, 'FORMAT DEVICE'],
        [240, 'FULL MATRIX DEFENSE'], [240, 'GRID HOP'], [240, 'HACK ON THE FLY'], [240, 'HIDE'], [240, 'INVITE MARK'],
        [240, 'JACK OUT'], [240, 'JAM SIGNALS'], [241, 'JUMP INTO RIGGED DEVICE'], [241, 'MATRIX PERCEPTION'],
        [241, 'MATRIX SEARCH'], [242, 'REBOOT DEVICE'], [242, 'SEND MESSAGE'], [242, 'SET DATA BOMB'], [242, 'SNOOP'],
        [242, 'SPOOF COMMAND'], [243, 'SWITCH INTERFACE MODE'], [243, 'TRACE ICON'], [248, 'ACID'], [248, 'BINDER'],
        [248, 'BLACK IC'], [248, 'BLASTER'], [248, 'CRASH'], [248, 'JAMMER'], [248, 'KILLER'], [248, 'MARKER'],
        [248, 'PATROL'], [248, 'PROBE'], [248, 'SCRAMBLE'], [248, 'SPARKY'], [249, 'TAR BABY'], [249, 'TRACK'],
        [250, 'CALL/DISMISS SPRITE'], [250, 'COMMAND SPRITE'], [250, 'COMPILE SPRITE'], [250, 'DECOMPILE SPRITE'],
        [250, 'KILL COMPLEX FORM'], [250, 'REGISTER SPRITE'], [250, 'THREAD COMPLEX FORM'], [251, 'FADING'],
        [256, 'COOKIE'], [257, 'DIAGNOSTICS'], [257, 'ELECTRON STORM'], [257, 'GREMLINS'],
        [270, 'DRONE INFILTRATION'], [270, 'DRONE PERCEPTION'], [278, 'DRAIN'],
        // the spell categories' own texts: how their spells are resisted (Chummer's spell defenses)
        [283, 'COMBAT SPELLS'], [285, 'DETECTION SPELLS'], [288, 'HEALTH SPELLS'], [290, 'ILLUSION SPELLS'],
        [292, 'MANIPULATION SPELLS'], [295, 'DISPELLING'], [312, 'ASTRAL PERCEPTION'], [312, 'MANA BARRIERS'],
        [419, 'ACTIVELY HIDING GEAR'],
    ],
    RG: [
        [119, 'AIMED BURST'], [119, 'BALLESTRA (CLUBS/BLADES ONLY)'], [119, 'BRAIN BLASTER'], [119, 'CLINCH'],
        [120, 'DOUBLE-TAP'], [120, 'ENHANCED SUPPRESSION'], [120, 'ESCAPE (P. 195, SR5)'], [120, 'FINISHING MOVE'],
        [120, 'FLECHETTE SUPPRESSIVE FIRE'], [121, 'FLYING KICK'], [121, 'FULL OFFENSE'],
        [121, 'HALF SWORD (BLADE ONLY)'], [121, 'HAYMAKER (CLOSE COMBAT ONLY)'], [121, 'HERDING'], [122, 'IAIJUTSU'],
        [122, 'KIP-UP (CLOSE COMBAT ONLY)'], [122, 'PLAYING POSSUM'], [122, 'POUNCING DRAGON'],
        [122, 'PRE-EMPTIVE BLOCK'], [122, 'PRE-EMPTIVE DODGE'], [122, 'PRE-EMPTIVE PARRY'],
        [123, 'PUSH/SHOVE/SACRIFICE MOVE'], [123, 'READING THE DEFENSE'], [123, 'THROW PERSON'], [124, 'COUNTERSTRIKE'],
        [124, 'DIVE FOR COVER'], [124, 'REVERSAL (UNARMED COMBAT ONLY)'], [124, 'RIGHT BACK AT YA!'],
        [125, 'PROTECTING THE PRINCIPLE'], [125, 'RIPOSTE'], [125, 'RUN FOR YOUR LIFE/ DIVE ON THE GRENADE'],
        [125, 'SACRIFICE THROW'], [125, 'SHADOW BLOCK'], [127, 'ACROBATIC DEFENDER'], [127, 'AGILE DEFENDER'],
        [127, 'PERCEPTIVE DEFENDER'], [127, 'TOO PRETTY TO HIT'],
    ],
    KC: [
        [37, 'CALIBRATION'], [37, 'DENIAL OF SERVICE'], [38, 'HAYWIRE'], [38, 'I AM THE FIREWALL'], [39, 'INTERVENE'],
        [39, 'MASQUERADE'], [39, 'POPUP'], [39, 'SQUELCH'], [39, 'SUBVERT INFRASTRUCTURE'], [40, 'TAG'],
        [40, 'WATCHDOG'], [67, 'FLICKER'], [68, 'BLUE GOO'],
    ],
    R5: [
        [30, 'BREAK TARGET LOCK'], [30, 'CONFUSE PILOT'], [30, 'DETECT TARGET LOCK'], [30, 'SUPPRESS NOISE'],
        [30, 'TARGET DEVICE'],
    ],
    DT: [
        [76, 'CATAPULT'], [76, 'SHOCKER'], [178, 'GARBAGE IN/GARBAGE OUT'], [179, 'TRACKBACK (SPECIAL ACTION)'],
    ],
};
/** Actions whose heading is not their name (Chummer's names; the system's general actions): the entry's key. */
const ACTION_ALIASES: Record<string, string> = {
    'Double Tap': 'RG:DOUBLE-TAP', 'Push (Simple)': 'RG:PUSH/SHOVE/SACRIFICE MOVE',
    'Push (Intercept)': 'RG:PUSH/SHOVE/SACRIFICE MOVE', 'Shove': 'RG:PUSH/SHOVE/SACRIFICE MOVE',
    'Sacrifice Move': 'RG:PUSH/SHOVE/SACRIFICE MOVE', 'Hide Gear (No Pat-Down)': 'SR5:ACTIVELY HIDING GEAR',
    'Hide Gear (Pat-Down)': 'SR5:ACTIVELY HIDING GEAR', 'Assense': 'SR5:ASTRAL PERCEPTION',
    'Biofeedback Resist': 'SR5:BIOFEEDBACK DAMAGE', 'Eject Clip (Smartgun)': 'SR5:EJECT SMARTGUN CLIP',
    'Fade': 'SR5:FADING', 'Fire Full-Auto Complex': 'SR5:FIRE FULL-AUTO WEAPON',
    'Fire Semi-Auto Burst': 'SR5:FIRE LONG BURST OR SEMI-AUTO BURST',
    'Fire Long Burst': 'SR5:FIRE LONG BURST OR SEMI-AUTO BURST',
    'Fire Single-Shot': 'SR5:FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO',
    'Fire Semi-Auto': 'SR5:FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO',
    'Fire Burst Fire': 'SR5:FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO',
    'Fire Full-Auto Simple': 'SR5:FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO',
    'Lift Carry': 'SR5:LIFTING/CARRYING', 'Natural Recovery Physical': 'SR5:PHYSICAL DAMAGE',
    'Pick Up / Put Down': 'SR5:PICK UP/PUT DOWN OBJECT', 'Change Configuration': 'SR5:RECONFIGURING YOUR DECK',
    'Use Sensors (Detect or Active Targeting) v. Living Beings': 'SR5:SENSOR TARGETING',
    'Use Sensors (Detect or Active Targeting) v. Vehicles': 'SR5:SENSOR TARGETING',
    'Physical Defense': 'SR5:STEP 3: DEFEND', 'Physical Damage Resist': 'SR5:STEP 4: APPLY EFFECT',
    'Natural Recovery Stun': 'SR5:STUN DAMAGE', 'Escape (Subduing)': 'SR5:SUBDUING',
    'Suppressive Fire Defense': 'SR5:SUPPRESSIVE FIRE', 'Resist Surprise': 'SR5:SURPRISE TESTS',
    'Drone Pilot Vehicle': 'SR5:VEHICLE TESTS', 'Matrix Damage Resist': 'SR5:MATRIX DAMAGE',
    'Press through Mana Barrier': 'SR5:MANA BARRIERS',
};

/**
 * The entries of Chummer's actions by their Chummer id (actions.xml), which its import keeps on the item
 * (importFlags.sourceid): the same on every language and after a rename. Built from Chummer's names with the lookup by
 * name below, the spell defenses by their category; its other defenses and resistances (no entry) are not in it.
 */
const ACTION_CHUMMER_IDS: Record<string, string[]> = {
    'SR5:COMBAT SPELLS': ['0ca7d61c-88e6-4e5c-841a-9cfbbb4ab491', '7d1f1509-8c4e-43c2-b902-02c6bb82b297'],
    'SR5:DETECTION SPELLS': ['a27f4680-62ab-446d-b614-fd2f315a56cb'],
    'SR5:HEALTH SPELLS': ['251e9a4a-2995-4139-868d-960002e381bd', 'a9c4beec-3f7e-4538-b341-d54c20b7db43',
        '251a7f01-96c5-4237-b624-3956c7139733', 'fa90b483-4045-4f79-990b-906b8dead55f', '98f35570-a884-44fd-92f0-4fa8ad7558f5',
        '5714adc1-cebc-498d-97c9-7fcc2ee3eb42', '394b2920-9ac6-4630-95dc-c31e4c077c33', '4011301d-d051-43f5-bbac-38b446c16df3'],
    'SR5:ILLUSION SPELLS': ['1dbbb54b-2cc3-40f4-a94a-4da5e7c70be7', '80ae61c5-c3b7-48a0-8ef2-9aaa1aa2cc05'],
    'SR5:MANIPULATION SPELLS': ['bf7d3491-c4f1-4ee4-9ab0-ce3dd6ec2e31', '804e5aed-af93-4aeb-b87a-1de291bbe261'],
    'SR5:MANA BARRIERS': ['f98b6892-84a4-4afe-9c29-0ae0142f3ba4'],
    'RG:AGILE DEFENDER': ['812d4414-6fd3-40c5-b992-2c9f889f68af'],
    'RG:TOO PRETTY TO HIT': ['4d5cd769-86ff-41d2-b750-b1f615ba1b73'],
    'DT:GARBAGE IN/GARBAGE OUT': ['2cc49ba8-e586-49f3-937d-b1359c623dd0'],
    'DT:TRACKBACK': ['802381dd-7a15-49eb-bfbe-18fb20c26b64'],
    'KC:CALIBRATION': ['0e1c5d65-051a-4b35-a077-11c6f9679829'],
    'KC:DENIAL OF SERVICE': ['e699453d-441f-4c3b-b05e-bb209fe4241c'],
    'KC:HAYWIRE': ['a56dd463-6f2c-485c-97c0-cefb3b65e073'],
    'KC:I AM THE FIREWALL': ['9dcccbd6-c4fe-4d81-b2b7-591f39247949', '0c3a992f-98bd-4f3f-bd14-1898225cfd4e'],
    'KC:INTERVENE': ['95e8fe05-c341-4985-9f42-0ff02a8c3b20'],
    'KC:MASQUERADE': ['7822f0d5-8634-4536-a1a2-98ff2cb5aaa2'],
    'KC:POPUP': ['643e1151-cb58-49f4-97cc-61919038f733'],
    'KC:SQUELCH': ['21aa0a33-9fd6-47fe-a5df-3e51427eef6d'],
    'KC:SUBVERT INFRASTRUCTURE': ['6b337872-6789-4e13-ad5c-1779d14adcf4'],
    'KC:TAG': ['7ab03865-944f-45a9-adee-6e7aa8381f5e'],
    'KC:WATCHDOG': ['f73c5747-0494-497b-9109-8bca6217b2b1'],
    'R5:BREAK TARGET LOCK': ['820c536b-8461-44e2-9a12-c267d88b2b76'],
    'R5:CONFUSE PILOT': ['ecb1d3eb-4a3d-412f-b374-3bb7eb9c59df'],
    'R5:DETECT TARGET LOCK': ['8949e342-56af-49d6-a659-9e0fb39d43bd'],
    'R5:SUPPRESS NOISE': ['0d5318e9-ed3d-4f11-99ba-6ff9c35bd79e'],
    'R5:TARGET DEVICE': ['f8d43ba8-e5ca-4a13-97cd-68c1980cd7bf'],
    'RG:ACROBATIC DEFENDER': ['5342ece8-8719-499f-bbef-b7aea95b0a28'],
    'RG:AIMED BURST': ['7b920367-e488-444d-a7bf-758797170b6f'],
    'RG:BALLESTRA': ['24c0a1f7-97db-4c8f-9262-457df8a8df17'],
    'RG:BRAIN BLASTER': ['55c705d9-968c-481a-8e2c-31700d73e23f'],
    'RG:CLINCH': ['de9cdc04-1d90-41e0-a21d-911500761e3d'],
    'RG:COUNTERSTRIKE': ['d1941c39-fbca-46c5-82fe-ef9161dfc223'],
    'RG:DIVE FOR COVER': ['3030d83b-6773-4659-b286-fac186aa1d3d'],
    'RG:DOUBLE-TAP': ['6da9ee3d-4068-45af-81e3-64d5d70ca4b3'],
    'RG:ENHANCED SUPPRESSION': ['2b725942-799c-4855-bcfb-a943df21314e'],
    'RG:ESCAPE': ['cc244439-4e28-41f3-96c0-8c84442c3bd0'],
    'RG:FINISHING MOVE': ['aab82478-8e9d-4b4f-9081-b22e8a2afd09'],
    'RG:FLECHETTE SUPPRESSIVE FIRE': ['51e20ac4-d580-4a11-9531-8e19f3a2ff31'],
    'RG:FLYING KICK': ['cb9235d4-d9a0-4c15-bae8-dbfd9ef83ba8'],
    'RG:FULL OFFENSE': ['33896e90-0615-412f-9969-d54e36dbb647'],
    'RG:HALF SWORD': ['14456cce-14ff-4319-81c5-5b90a8d54533'],
    'RG:HAYMAKER': ['f94b7a79-db0c-4581-941e-cf6610ba6741'],
    'RG:HERDING': ['f877d70a-1a46-4b30-8572-48a7385cf26f'],
    'RG:IAIJUTSU': ['42c3084c-e8b8-4a8f-b2f4-090036454d45'],
    'RG:KIP-UP': ['04296569-39b0-481d-a468-fc22f13be152'],
    'RG:PERCEPTIVE DEFENDER': ['16067c34-3e74-4d2a-a0cf-82cfcf468606'],
    'RG:PLAYING POSSUM': ['96a73d16-c9c9-4e19-8458-726f322089b8', 'b43fbef5-e157-4f1a-a247-738a4c4f6425'],
    'RG:POUNCING DRAGON': ['d16efc4e-a54e-48a4-b705-5c7a47cc9c86'],
    'RG:PRE-EMPTIVE BLOCK': ['6d3a655e-c680-4f49-ad9a-be1f4f9b5e1c'],
    'RG:PRE-EMPTIVE DODGE': ['9bfa4e44-08c6-49e0-b4b6-c48925814e7d'],
    'RG:PRE-EMPTIVE PARRY': ['7f04c323-1f8b-4ed0-9b62-c87f125c6c28'],
    'RG:PROTECTING THE PRINCIPLE': ['91cf6b11-95cf-4cdc-8f94-ef797d316cba'],
    'RG:PUSH/SHOVE/SACRIFICE MOVE': [
        '83f73100-0928-4b29-8973-81e1ed899d56', 'e9b8b4b4-72b4-4d01-88b0-121ea6c5670b',
        '2e6dd5f7-bb15-48fa-9098-145222579bac', 'dc3d5d08-e0a9-4456-ab9f-be2a582e37ca',
    ],
    'RG:READING THE DEFENSE': ['37a75f68-6c68-4229-812f-a7f013edc811'],
    'RG:REVERSAL': ['dc6b2c18-2565-420a-9e6e-9481d9092662', '1d6933e9-90f9-40ab-b0e5-06f49e2f4d1e'],
    'RG:RIGHT BACK AT YA!': ['933c74a5-54b2-4e9d-8636-1e777f0c2ef2'],
    'RG:RIPOSTE': ['c583e3e4-2252-4ead-8a2a-8b51981afc26'],
    'RG:RUN FOR YOUR LIFE/DIVE ON THE GRENADE': ['0a3da24d-5e20-442b-ab54-2c6fd389d272'],
    'RG:SACRIFICE THROW': ['d8c906a3-d274-4efa-abd0-2e7f44700b87'],
    'RG:SHADOW BLOCK': ['b7b8c408-0700-4a35-b2d8-e5c9b359d63d', '9c96dde8-157f-445a-a618-377306906814'],
    'RG:THROW PERSON': ['8a11fcb1-6f5c-4792-9111-875d2631b25a', '73ca02ed-6c84-4351-85dc-c6edfeb3646b'],
    'SR5:ACID': ['78d5dd63-0cfe-42d8-a20c-f021dde99b62'],
    'SR5:ACTIVATE FOCUS': ['d0efe44f-45f7-405d-8415-69eb159e93b3'],
    'SR5:ACTIVELY HIDING GEAR': ['175c83f2-7c87-41b4-98e7-6207c273573c', '5eaf0544-fb3b-469c-be22-b1cfdb0058c2'],
    'SR5:ASTRAL PERCEPTION': ['40d06d20-e124-4a80-aee3-16352d02d3ba'],
    'SR5:ASTRAL PROJECTION': ['c95f3fc2-b212-4944-871e-1badaf1aaa0b'],
    'SR5:BANISH SPIRIT': ['4c6a71ab-b58a-41c3-b5a2-c6972d1cb8a8'],
    'SR5:BINDER': ['b89451d1-3d47-4df5-b64a-cbe18f8d76f3'],
    'SR5:BLACK IC': ['57564e6f-be28-41eb-ae9c-e4b6e0eee590'],
    'SR5:BLASTER': ['f32a0bc0-f573-4ec6-be09-802f85a6fcca'],
    'SR5:BLOCK': ['072fb7bd-0e7b-4f81-a2d6-5356f398dd5a'],
    'SR5:BRUTE FORCE': [
        '73cd3043-94ac-4406-85ce-59b951d0d945', '8d023ffc-1683-4885-81ef-ca22253a3d87',
        '61e231da-0ae3-42b1-ba2f-18c3fba41fab',
    ],
    'SR5:CALL SPIRIT': ['9991c31b-52b3-47a8-8ea8-48bae349fcdf'],
    'SR5:CALL/DISMISS SPRITE': ['e8fc7f26-6a65-43b2-9f60-0a453a0424c2'],
    'SR5:CAST SPELL': [
        '1c9b5a36-fb1e-4e25-97ce-adb701bb48ef', '3a377563-fe2c-4b7e-a2ea-0e0f09edae69',
        '248972ed-9e85-4090-8311-b7fa3255380d', '7c6435c9-dc13-46ab-894d-ff618779568d',
        'd3955718-54aa-4617-a3d5-1dbd6b9168a8', '8c89c60c-bfe3-4302-b3a4-c68b10846fc5',
        '0c3cda81-a983-45a8-b6f6-d7d439a36c53', 'e6e08c81-7076-41c3-bb3a-2aa33fbe68c7',
        'd13cabf3-a963-413e-b2a0-f65434423f9f', 'ed6241fd-d214-4e73-90a3-99a4fc88a5b5',
        '648652dc-be24-4133-947f-3dd14544ffd8', '95ce6fae-8fe9-4cc0-9741-bbfc34aa55be',
        '69f52882-8833-4a64-82e9-2c5a5fe7af2d', '809545ed-f341-4f63-9ebe-e53a38d92526',
        '6cd27ee7-2d2b-42f0-9581-d3d02195c91b', '5a7b4036-b17c-42b9-8fa3-026b3d89bcc8',
        'c49f3f9a-9363-4270-ad47-246af74247ec',
    ],
    'SR5:CHANGE DEVICE MODE': ['fcd4abdf-dfb4-46d8-9ff4-d5de466b949e'],
    'SR5:CHANGE GUN MODE': ['cf22cdfd-05d7-44b8-8b50-3b7d951dddfd', '9a864f35-1469-4bc2-bda4-78879edd1311'],
    'SR5:CHANGE ICON': ['c33b205b-1249-45b8-8ee5-da74e4311362'],
    'SR5:CHANGE LINKED DEVICE MODE': ['cc314714-81b0-447f-b7b6-f1ac272421ee'],
    'SR5:CHECK OVERWATCH SCORE': ['d6defa46-1c97-4bfd-b9f1-b1c1b2753a90'],
    'SR5:COMMAND SPIRIT': ['dc0fe0d6-e841-4916-9001-dc9e66e9c177'],
    'SR5:COMMAND SPRITE': ['505d98b2-b42c-4019-a421-af02543f348d'],
    'SR5:COMPILE SPRITE': ['25c7dd2e-5e32-4adf-913e-9468763e0afb'],
    'SR5:CONTROL DEVICE': [
        '21eda7c5-3ca5-4aba-b5e5-b05be4afe6c9', 'f3ddb8ab-01ca-4048-9570-42e00670eef8',
        'fa59f7ea-347c-4a25-8932-f801fa79d601',
    ],
    'SR5:CONTROL VEHICLE': ['9058d2a6-c7b7-4376-b298-9d7377bb6cb0'],
    'SR5:COOKIE': ['fe3e19fa-59c3-441e-b5a4-ad9a638902ad'],
    'SR5:CRACK FILE': ['87600eea-0c78-4474-9e6c-c36e625133ba'],
    'SR5:CRASH': ['6cd17750-b97f-493f-b322-a3fdbbb9e78e'],
    'SR5:CRASH PROGRAM': ['7d865af9-1073-49e6-98b2-f67f6a9cb9d3'],
    'SR5:DATA SPIKE': ['dc5156e3-b289-438e-b4d1-c24047357637'],
    'SR5:DECOMPILE SPRITE': ['9152220d-84cc-4911-b6df-db5a870090be'],
    'SR5:DIAGNOSTICS': ['2eb8da0c-65f7-4b31-ba31-b3fe6034cae8'],
    'SR5:DISARM DATA BOMB': ['570a3ce1-a8ea-4623-985e-b4bdcc79d2eb'],
    'SR5:DISMISS SPIRIT': ['22e80495-2c0d-4230-9818-e99bf4eabd12'],
    'SR5:DISPELLING': ['42dcd464-2919-4cd4-b5a1-d91192ab2a41'],
    'SR5:DODGE': ['ae815225-2e93-45ba-8423-3110e32696c1'],
    'SR5:DROP OBJECT': ['afab4f41-fe12-4d5e-a736-de9a47113fb6'],
    'SR5:DROP PRONE': ['69029e9c-c146-4a48-b8fe-d3991645c832'],
    'SR5:EDIT FILE': ['8b879c36-e355-4cf4-99cb-6afcd132d573'],
    'SR5:EJECT SMARTGUN CLIP': ['4b7a9284-2ac4-4a37-b4ca-b0313e29b9ef'],
    'SR5:ELECTRON STORM': ['0006274a-c3d3-418f-950e-5181f24ab071'],
    'SR5:ENTER/EXIT HOST': ['ed359afd-db47-47d1-9e4b-8d13e0396005'],
    'SR5:ERASE MARK': [
        '1dae5310-0d39-4464-b3a4-1b3483d0c4eb', 'ea4bcda5-b8ea-4659-92f0-b369beab4bf1',
        'c544e946-3dd9-44bb-9546-cc44e24b9616',
    ],
    'SR5:ERASE MATRIX SIGNATURE': ['27c29e97-7708-42c7-a98c-be52e41fa5ed'],
    'SR5:FIRE BOW': ['5790e39b-2600-4b98-9a04-dcdf1643188e'],
    'SR5:FIRE FULL-AUTO WEAPON': ['0bf73dca-0851-4bdf-a524-ec91c1c0aec2'],
    'SR5:FIRE LONG BURST OR SEMI-AUTO BURST': [
        '15a4c0c9-cbc3-4687-afe7-f033858f33c7', '45387cbe-fa43-4f87-ba1d-07a867335c46',
    ],
    'SR5:FIRE MOUNTED OR VEHICLE WEAPON': ['f4a61086-d8b6-467e-807f-a1995aa9cca5'],
    'SR5:FIRE SEMI-AUTO, SINGLE-SHOT, BURST FIRE OR FULL-AUTO': [
        'fcc4f4c5-9113-480e-9dda-8cb3af133dd8', 'a84ed567-e106-40b6-b7db-355f82b34c89',
        '23ed8daf-5af3-4b2f-a681-55053cd4e6ad', '0cad7455-41a3-4211-8f33-5e73d0cd7909',
    ],
    'SR5:FORMAT DEVICE': ['d8bfadcb-ea9b-4ae2-a1ae-2c84f33f9e3a'],
    'SR5:FULL DEFENSE': ['3f40af85-650f-4398-8224-a0cb29415c1d'],
    'SR5:FULL MATRIX DEFENSE': ['6657bd85-e651-448f-8936-2d9dc17883a3'],
    'SR5:GESTURE': ['ac554ad7-5ed8-422b-a1da-995c484c42af'],
    'SR5:GREMLINS': ['14853b2e-9249-418d-882f-3d88ff2aa05e'],
    'SR5:GRID HOP': ['24c3dfb5-ce2b-4a48-8563-be0b26005795'],
    'SR5:HACK ON THE FLY': [
        '119aa0ed-314c-45cb-917e-17cf0644c7df', '4c3a4635-c1a6-43e0-99f1-0caa6f3a11fa',
        '0c174aa0-7413-4984-b829-a28b06c6fab4',
    ],
    'SR5:HIDE': ['90a409d1-00d9-4285-8827-c8bea66d6f87'],
    'SR5:HIT THE DIRT': ['7bb2cf75-bdd3-4773-a890-d542bd5a4512'],
    'SR5:INSERT CLIP': ['11540296-1d7b-4a0b-b610-87e8ca6d49f8'],
    'SR5:INTERCEPT': ['af671982-9e48-4c79-a1c3-f4e4e930b59f'],
    'SR5:INVITE MARK': ['4cd14397-ae0f-48db-8339-f2abb90e9ded'],
    'SR5:JACK OUT': ['1aa9df40-ade8-4e07-8877-e4147ea33fea'],
    'SR5:JAM SIGNALS': ['0af091d7-006d-4532-9980-a8a4b4fd9087'],
    'SR5:JAMMER': ['56293915-1238-42e8-8b91-21c557a976ff'],
    'SR5:JUMP INTO RIGGED DEVICE': ['a9a4a59a-babf-4dc3-b570-d52582091a8f'],
    'SR5:KILL COMPLEX FORM': ['bed2a61d-26d9-474e-93e2-c8e0086dec3f'],
    'SR5:KILLER': ['8af0f71d-a1b1-47d1-95e2-8a1872aea3f4'],
    'SR5:LOAD AND FIRE BOW': ['ab83c36f-1583-42f3-86e0-b32c16e3e3bd'],
    'SR5:MAKE VEHICLE TEST': ['ea2311da-ebe1-4ffc-8eb3-09282852f577'],
    'SR5:MARKER': ['236cad06-d6f1-4107-bf6f-c1abc85e139a'],
    'SR5:MATRIX PERCEPTION': ['ff5a636f-041d-4b9c-ba1c-4d9902cb21e5'],
    'SR5:MATRIX SEARCH': ['3015d73c-e98c-480b-a561-0bed57a3da7e'],
    'SR5:MELEE ATTACK': ['d1d2a10b-36f0-456c-88d0-840221a41c9e'],
    'SR5:MULTIPLE ATTACKS': ['aa57b540-43cb-48bd-ba5c-76d8c1e8cba0'],
    'SR5:OBSERVE IN DETAIL': ['1489fd0e-0095-42b4-9ab0-1e46878d26f0'],
    'SR5:PARRY': ['04b1143e-eb33-4333-9539-c38f953cca9e'],
    'SR5:PATROL': ['47b191ca-7e7f-4a62-81e3-787c7a70367a'],
    'SR5:PICK UP/PUT DOWN OBJECT': ['42bc2749-850b-4706-8de7-bf257a7ec351'],
    'SR5:PROBE': ['a633ea22-93ac-42fa-b81b-51bce550f78e'],
    'SR5:QUICK DRAW': ['eeadf4b2-91c5-4677-8072-aa276c22de5b'],
    'SR5:RAMMING': ['fd333958-c114-4831-a5fe-20f4ca1915d3'],
    'SR5:READY WEAPON': ['c9ce97c5-8396-4b9c-b630-4e95d4df7337'],
    'SR5:REBOOT DEVICE': ['1989269b-df4c-446f-9087-9145a06e9ef6'],
    'SR5:RECKLESS SPELLCASTING': [
        'ec637fd9-5220-42f5-852f-fab684589292', 'a34e989f-3f2c-4799-a411-06acd0302da9',
        '36e2b033-6cbb-41ea-b08a-94b3c9cf2874', '4d88eea9-ef93-4927-ad15-9644bd149bc1',
        '38ffd621-5dc8-4b85-86db-6da5b9930176', '18d1538a-c256-4d9d-8bf0-cfe359edea5a',
        '3d137e4d-883c-4cd2-8058-693dd521fb11', '27b2df59-ff24-42ba-a4fa-659d4654d34a',
        '2a896b9d-26e6-4cab-b588-3a9de9658c8b', 'bccd8bcb-95e5-489b-9821-ce0aebfdbfb2',
        '68a9596e-ae77-4f54-86a8-423c70e96fa8', 'b901faf1-7abb-49a3-8ed7-bd06153c0359',
        '1af27cd2-c141-4707-a3ba-47e995380185', 'ffc9e219-91c6-4b5a-82ae-5951c4225dc6',
        '2504b41b-c0de-4bdf-979c-8b9a3127ff77', 'aeeafb3e-757e-47bb-9d43-3763baa9d361',
        '67cad023-7d98-4449-9c08-4839c02c25ff',
    ],
    'SR5:REGISTER SPRITE': ['0eb78e4b-a3b1-4894-b84d-d2c1dbb3040f'],
    'SR5:RELOAD FIREARM': ['71d561df-5997-45e8-8b33-f6dbb6f00872'],
    'SR5:REMOVE CLIP': ['962f5105-31e4-4f72-a51c-f3b87bed834e'],
    'SR5:RIGGER JUMP IN': ['de8159d2-c178-4e65-93a8-94509c275876'],
    'SR5:RUN': ['b8e322c3-c79b-4c97-8cbe-de3f6ce71907'],
    'SR5:SCRAMBLE': ['932f77eb-bcea-4215-a26c-a3c348a47701'],
    'SR5:SEND MESSAGE': ['db185ca6-7e1b-49f5-bb76-1c57c3c91572'],
    'SR5:SENSOR TARGETING': ['b56ee60e-5454-47ba-9e8b-c6f623c26988', 'f1bb09ac-dc7b-4731-842c-fb466013c402'],
    'SR5:SET DATA BOMB': ['c930626c-cb53-43d4-af60-0992c5744caa'],
    'SR5:SHIFT PERCEPTION': ['ed1abe03-c2ca-49c8-b420-94d315a06403'],
    'SR5:SNOOP': ['d50f95c8-c6b3-4312-991c-5f9b52818f77'],
    'SR5:SPARKY': ['50725e27-a14e-4732-ad92-96df30bed382'],
    'SR5:SPEAK/TEXT/TRANSMIT PHRASE': ['1f569333-34c6-4f28-ba50-7c6bcd88be9a'],
    'SR5:SPOOF COMMAND': ['e11c1e7b-a6a4-4d8d-a11c-4ca9720a701d'],
    'SR5:SPRINT': ['da1276d9-995e-4408-b58c-0e5b1762a2fe'],
    'SR5:STAND UP': ['e43b1215-c760-446a-9f7a-3132d5bb50c0'],
    'SR5:SUBDUING': ['476dab78-f8b6-4258-8c9f-08d355d33725', 'ff8478ef-cac4-4f7c-aa39-9c11dd08e1ea'],
    'SR5:SUMMONING': ['c7f5ec4d-5cba-4392-a65f-819b1e3df4f6'],
    'SR5:SUPPRESSIVE FIRE': ['85f6b9af-45a9-45b5-90e0-5421ae2278e8', '259c030b-ba8e-4f18-a02e-6f89f6cc932a'],
    'SR5:SURPRISE TESTS': ['d5bd6550-e4ef-40f7-b95c-47ea79c682d0'],
    'SR5:SWITCH INTERFACE MODE': ['f3915443-a98d-4ca0-8e94-1063fc2ba4ca'],
    'SR5:TAKE AIM': ['79bebc25-3190-4731-8282-b90786f14c16'],
    'SR5:TAKE COVER': ['31c81043-6ace-4c64-ac85-b5afd87d7a97'],
    'SR5:TAR BABY': ['651efc72-80dc-48c4-882b-5a2a1f78fb3d'],
    'SR5:THREAD COMPLEX FORM': [
        '44e9fbdf-b298-40de-804f-6ac4bc28319a', 'b2fb8599-d12b-4250-b9c4-184de78ccb6e',
        '0e88dc79-4fa5-4c4f-9b3f-f2c630f96852', '08c9a6f5-b3f5-4890-8545-532c10ffa65c',
    ],
    'SR5:THROW WEAPON': ['92b563eb-e452-431f-bb09-d423a5fb8bef', '8dd836d6-c57b-492c-b2df-a0bb6798cf1b'],
    'SR5:TRACE ICON': ['6b4fb263-b355-46dc-a106-088f0c7e5f3c'],
    'SR5:TRACK': ['b0262d4b-5c55-4fb9-8819-842ccfe20648'],
    'SR5:USE SIMPLE DEVICE': ['e494762f-0065-4970-9aac-b0daa1a5ab78'],
    'SR5:USE SKILL': ['c6f2f038-8cca-4437-835a-7e24fe83cf77'],
};
const ACTION_BY_CHUMMER_ID: Record<string, string> = Object.fromEntries(Object.entries(ACTION_CHUMMER_IDS).flatMap(([key, ids]) => ids.map(id => [id, key])));

/** A heading as the key of its section: capitals, a bracket at its end (a linked attribute, a page, a spell's kind) left out. */
const headingKey = (text: string) => text.replace(/’/g, "'").replace(/:\s*$/, '').replace(/\s*\([^)]*\)$/, '').replace(/\s+/g, ' ')
    .replace(/\s*\/\s*/g, '/').trim().toUpperCase();
const ACTION_SECTIONS: Record<string, RulebookSection> = Object.fromEntries((Object.entries(ACTION_HEADINGS) as [BookCode, [number, string][]][])
    .flatMap(([book, entries]) => entries.map(([page, heading]): [string, RulebookSection] => [`${book}:${headingKey(heading)}`, { book, page, heading }])));

/**
 * The keys an action's name may have its entry under: the name, without what Chummer adds to it (a bracket, "v. ...",
 * "Simple"/"Complex", "Sprite Power: ") and with "IC" on or off.
 */
function actionNameKeys(name: string): string[] {
    const bare = name.replace(/\s*\([^)]*\)$/, '');
    const plain = bare.replace(/\s+v\.\s.*$/, '');
    return [...new Set([name, bare, plain, plain.replace(/\s+IC$/, ''), `${plain} IC`, plain.replace(/^Sprite Power:\s*/, ''),
        plain.replace(/\s+(Simple|Complex)$/, '')].map(headingKey))];
}

/**
 * The spells' and rituals' entries, by book: page, heading and the Chummer id (spells.xml) of the spell it describes
 * (the spells of the Core rulebook SR5 283-295, Street Grimoire 102-127 and its rituals, Shadow Spells, Forbidden Arcana
 * ...). A spell's heading is its name in capitals; Chummer's names of a kind ("Detect [Life Form]") keep their bracket.
 */
const SPELL_HEADINGS: Partial<Record<BookCode, [number, string, string][]>> = {
    SR5: [
        [283, 'ACID STREAM', 'c78d91cc-fa02-48c3-a243-28823a2038ef'],
        [283, 'TOXIC WAVE', '87cb3685-22e8-46fa-890f-f3cfef10a71f'],
        [284, 'BALL LIGHTNING', '9b5c1538-d66b-4b71-9953-78817aaef6e4'],
        [284, 'BLAST', '187b1ffe-470c-4672-ba9d-376ee1856a1c'],
        [284, 'CLOUT', '241b9811-e7d8-41d5-b4cc-444e599599fc'],
        // Punch: its stat block is followed by an example, the group's text (with Clout's) is Punch's too
        [284, 'CLOUT', '10dd2924-36c6-42a3-8715-694c29c1fd48'],
        [284, 'DEATH TOUCH', '9baed162-5e84-4f19-9b94-d543a560c067'],
        [284, 'FIREBALL', '9ce1e699-3c30-4184-858b-d5539935ef96'],
        [284, 'FLAMETHROWER', '02de7f2a-3c8e-48a5-b7d1-0bf9854271aa'],
        [284, 'KNOCKOUT', '6cbe13c4-ef28-43b7-9715-bccb7c153999'],
        [284, 'LIGHTNING BOLT', 'b39ec682-8409-4546-be00-7615583e6541'],
        [284, 'MANABALL', 'd866f612-7160-41d2-8ce9-b64262327559'],
        [284, 'MANABOLT', '85c12bae-3954-483c-a211-d8ee43a1c65e'],
        [284, 'POWERBALL', '1e25e684-9eec-4d1a-acac-488c8c00c24f'],
        [284, 'POWERBOLT', 'a7f17805-3e3e-4a12-8580-b9de0d7499ef'],
        [284, 'SHATTER', '92467147-ce2c-480e-b4e0-f4a269c2ad86'],
        [284, 'STUNBOLT', '47423962-6b73-4cc3-ad4e-e8d037cf9507'],
        [285, 'ANALYZE DEVICE', 'e81dda32-1c97-482b-a6a5-ddd12eded03a'],
        [285, 'ANALYZE MAGIC', '4828522d-848c-4ebe-850e-fa3f3babf241'],
        [285, 'STUNBALL', 'e9f1e14b-1f59-46d6-9e9f-e808d7316d76'],
        [286, 'ANALYZE TRUTH', '933a534c-ad50-4c87-be65-2230d56f5fcd'],
        [286, 'CLAIRAUDIENCE', 'fb44d690-17c0-4d22-819e-8b7b463b2599'],
        [286, 'CLAIRVOYANCE', 'd82c56f8-9231-48a9-9dea-dea6c513caad'],
        [286, 'COMBAT SENSE', 'a6bd05ed-b72f-4886-bb8b-6aba947e8cf5'],
        [286, 'DETECT ENEMIES', 'e343f716-a5b6-46a7-8bff-60b6c175db60'],
        [286, 'DETECT ENEMIES, EXTENDED', 'fff36d4c-1462-4795-80ec-fe58132e027e'],
        [286, 'DETECT INDIVIDUAL', '410dd014-d849-42d7-834b-76912579ee72'],
        [286, 'DETECT LIFE', '7231e696-8839-4ec8-b12e-213b79bb643d'],
        [286, 'DETECT LIFE, EXTENDED', '9bcd193f-b149-4c04-bb0e-8b2d66dae241'],
        [287, 'DETECT MAGIC', '9d2a045b-11b6-4385-a851-30b8ba9c2e7f'],
        [287, 'DETECT MAGIC, EXTENDED', '96fdf1da-d4e7-460c-a172-3f7a7b56ac67'],
        [287, 'DETECT [LIFE FORM]', 'f43c484c-a98a-4831-8ead-adb4216a7c30'],
        [287, 'DETECT [LIFE FORM], EXTENDED', '88c5059f-8f53-4910-9873-b5a5f87850e3'],
        [287, 'DETECT [OBJECT]', '5574e0a7-d089-4c6d-a033-a157fbe681c0'],
        [287, 'MIND PROBE', 'fc5bf8bd-1c7e-4093-bd86-4d9943aafbd4'],
        [287, 'MINDLINK', '7c4a2ba3-3ee3-4f34-bb16-17645ef90932'],
        [288, 'ANTIDOTE', '92fe97e1-2f16-4398-b12b-b29bfa23c75d'],
        [288, 'CURE DISEASE', '13999091-25c8-4b72-add4-bff3b97eb0a6'],
        [288, 'DECREASE [ATTRIBUTE]', '31e68920-f354-4d38-b008-87f843957bba'],
        [288, 'DETOX', '3d019dea-b5ae-4f9c-ab14-eb8a329ed9ba'],
        [288, 'HEAL', 'c09e8bb5-4bed-44f9-a41c-bed6a4deb871'],
        [288, 'INCREASE REFLEXES', '37b3d6ac-624a-42d4-bd6e-a12142dc5725'],
        [288, 'INCREASE [ATTRIBUTE]', 'c72c3fe1-61b1-4a5d-8c15-2bca2c6c904d'],
        [288, 'OXYGENATE', '5ac26e0f-3c01-43a7-a6d4-46f9193851ea'],
        [289, 'PROPHYLAXIS', '0d0e3e2d-5223-4258-b885-12848833eb08'],
        [289, 'RESIST PAIN', '0556d652-82ef-43be-a800-0d9335dbae4c'],
        [289, 'STABILIZE', '6f9b1dd2-b0e7-4e3f-a140-72c987b77705'],
        [290, 'AGONY', '46b12a6a-9d9d-4176-bfd6-80e8e21cb0e4'],
        [290, 'BUGS', '5ab4bf6b-9c90-4fbb-9005-b9545a51bec1'],
        [290, 'CHAOS', '4268d83b-c208-4aa3-8924-5620516f8434'],
        [290, 'CHAOTIC WORLD', '075f38b3-8d65-44c0-8492-4d4e992e6b80'],
        [290, 'CONFUSION', '5636bbee-fadd-4f5c-bf77-c15b05e8d265'],
        [290, 'ENTERTAINMENT', 'd4e9d465-160f-4148-a755-27b50616f240'],
        [290, 'MASS AGONY', 'b11af57e-bacc-4f13-8d75-d1201ec6f4f5'],
        [290, 'MASS CONFUSION', '1041d1cb-bbc2-4718-ae56-3d8c4276b77b'],
        [290, 'SWARM', 'd6725f7f-8084-4f36-8b46-e37e1c329af6'],
        [290, 'TRID ENTERTAINMENT', '56be1e57-eca7-4253-970a-b561e23b1e8d'],
        [291, 'HUSH', '4ba6626f-4109-4451-ab0a-e659752ab15e'],
        [291, 'IMPROVED INVISIBILITY', '1d9430e9-3ae9-4c0a-ba60-ee92c245ee08'],
        [291, 'INVISIBILITY', '4b929a2d-908e-40ab-babc-e262b7f69a28'],
        [291, 'MASK', '435ba03c-2b21-4bcb-858a-cc175f7b41d7'],
        [291, 'PHANTASM', '52acdeb6-3ec4-417c-a768-e6a445117f69'],
        [291, 'PHYSICAL MASK', 'af339680-1d73-44b8-a2aa-7d9b7630a647'],
        [291, 'SILENCE', 'c307d243-669b-47d0-9642-aee7f9207e63'],
        [291, 'TRID PHANTASM', '444adc27-26c7-4ff1-894f-a55fea22e24a'],
        [292, 'ANIMATE', 'b447e60d-88b6-48e4-a595-6dae86581867'],
        [292, 'ARMOR', '794f21eb-dc8d-45e8-b9b0-b85b810437f3'],
        [292, 'CONTROL ACTIONS', '32a6a213-8c89-4efe-b56d-042814a13b9f'],
        [292, 'MASS ANIMATE', '13577f45-cb22-4285-bbf4-06072286dfbb'],
        [292, 'MOB CONTROL', '0404dc24-1305-4891-899f-d45ddff2811c'],
        [292, 'STEALTH', '370e0dfb-550e-4330-92eb-9ef3b8a044b5'],
        [293, 'CONTROL THOUGHTS', 'd97d3ece-e21b-42c7-bfeb-4ca3834587c0'],
        [293, 'FLING', '52bd988c-88a5-4f07-8f02-f8a5f202ef8d'],
        [293, 'ICE SHEET', 'ee7c25c2-77af-4c08-827c-9e0f39af9bd4'],
        [293, 'IGNITE', '459e6c2d-d0b7-4c0e-a85a-dc5d8e794930'],
        [293, 'INFLUENCE', '600a7cce-effd-4bd3-8d20-0f840cd1bf22'],
        [293, 'LEVITATE', '8be2c62c-b2c9-435e-8721-dfad01f5161a'],
        [293, 'LIGHT', '70db860e-f66f-411d-bab4-d1dccbc0ce9f'],
        [293, 'MOB MIND', '64904294-a652-4361-8809-ce37a8d79f8f'],
        [294, 'MAGIC FINGERS', '036b3b19-caa7-4da1-b2de-f887ac3a6d20'],
        [294, 'MANA BARRIER', 'b1d545b6-2498-4682-8058-a3f7783c1c84'],
        [294, 'PHYSICAL BARRIER', '1e1e488d-d727-43f8-900d-5c171c320d1d'],
        [294, 'POLTERGEIST', 'd7d6bbf6-6855-47ce-9865-5a01db507d71'],
        [294, 'SHADOW', '6aa76b6a-0096-4e09-a672-d8de84885017'],
        [297, 'CURSE', '0d15391d-b247-439c-aac6-c671c4f60204'],
        [297, 'PRODIGAL SPELL', '716ce109-40df-46f2-b445-692f96e62537'],
        [297, 'REMOTE SENSING', 'b561907f-9b1b-4153-b314-155acc8139d2'],
        [297, 'WARD', '3cea53a2-7628-4009-9bc4-af2f141fc28d'],
        [298, 'CIRCLE OF HEALING', 'b7e36c07-0ac9-4a13-97b2-932cacc050e9'],
        [298, 'CIRCLE OF PROTECTION', '6f1689d0-1902-4155-b6e8-4451c88348b2'],
        [298, 'HOMUNCULUS', 'f99ab85f-2cc7-4c09-8ea4-581f75e40487'],
        [298, 'RENASCENCE', '27747429-0230-4c46-a7ce-bbee8d7d8c83'],
        [298, 'WATCHER', '1149e55c-e902-407c-9f40-9c0713447c50'],
    ],
    SG: [
        [102, 'CORRODE [OBJECT]', '45d775c9-d12f-4416-a45a-88922ec3c2fd'],
        [102, 'DISRUPT [FOCUS]', '5c9218f6-bdb4-46a5-89ce-00b4adfe0429'],
        [102, 'MELT [OBJECT]', '7a2101ff-6606-4b3e-b1c1-2f7ea74679dd'],
        [102, 'SLUDGE [OBJECT]', '6b12c245-ab52-49df-93fe-670841cb9e3d'],
        [103, 'DESTROY [FREE SPIRIT]', 'a6f43dcf-c0cc-4da9-af25-1516f2564200'],
        [103, 'DESTROY [VEHICLE]', '51f04999-1173-43da-94b6-af3749cb3156'],
        [103, 'FIREWATER', 'd3bf1bfc-e104-4b22-a1fe-0aae0ef0b35b'],
        [103, 'ICE SPEAR', 'bba17f26-7b83-4904-a5fa-a21ef7cacaa7'],
        [103, 'ICE STORM', '2c2ad94e-3dd5-40e3-a4e0-74668dae1b48'],
        [103, 'INSECTICIDE', 'ea47eaaf-80e4-4c89-a108-6d2fb3e376dd'],
        [103, 'NAPALM', '577871f2-f294-4db9-94f0-5790d0576a4b'],
        [104, 'ONE LESS', '894e4bea-883e-421b-8a6f-6ca61274cca3'],
        [104, 'RAM [OBJECT]', 'f883ce3d-a3a9-4021-b4f3-7812d6a5f7f1'],
        [104, 'SLAUGHTER', '06d5a10b-b353-44bc-936a-4d6c08ebeaf8'],
        [104, 'SLAY', '50f1bfce-a64d-4fac-b25d-d870e7ff312f'],
        [105, 'DEMOLISH [OBJECT]', 'da0462d4-f068-449d-a3c3-4678dc0adade'],
        [105, 'RADIATION BEAM', 'f20e3789-0333-4243-b31c-0dc07f1d8736'],
        [105, 'RADIATION BURST', '793736ac-c4a4-408c-824e-6cc5689622a3'],
        [105, 'WRECK [OBJECT]', 'f7494736-bf1f-4d2f-a137-6f43a0248d36'],
        [106, 'ANIMAL SENSE', '2e4c9b88-2203-4ab9-842b-e3c373db6982'],
        [106, 'ASTRAL CLAIRVOYANCE', 'c68f9aeb-e7b2-4b2a-9ce4-1ee306412ef7'],
        [106, 'ASTRAL MESSAGE', '87c6046a-1f20-4b64-9e89-aec583254a3e'],
        [106, 'BORROW SENSE', '3e350a47-4b06-48b1-94ef-fe00c3b86757'],
        [106, 'EYES OF THE PACK', '2f4d4afa-f94a-4659-be2a-9ffbd3589e44'],
        [106, 'POLLUTANT STREAM', 'e0b3608a-cf54-4a1d-a99a-a4cd513c5e8a'],
        [106, 'POLLUTANT WAVE', '7a6579fa-4eda-47e4-96d2-59f4e1f9f567'],
        [106, 'SHATTERSHIELD', '0c0c34cb-5df3-4928-8e81-b794ee2fb47c'],
        [107, 'ASTRAL WINDOW', '237ee405-062f-4e11-96a8-78336e1d6a0a'],
        [107, 'CATALOG', 'd6157db4-8957-4160-ab47-3ded6c4be07c'],
        [107, 'DIAGNOSE', 'fdbb2c8e-453b-46cf-8dcd-522c6d3aa3e0'],
        [107, 'DRAGON ASTRAL SIGNATURE', '0b2bd31a-09b2-40b8-a4ab-7c776ef33268'],
        [107, 'ENHANCE AIM', '96859e68-4051-4805-8de6-4f15ea4dee66'],
        [107, 'HAWKEYE', 'ba3a8f58-8eeb-49de-97ac-b68ec67b85f5'],
        [107, 'MANA WINDOW', '35d509e2-f0c7-432f-919a-34e526079097'],
        [108, 'AREA THOUGHT RECOGNITION', '575e98fc-a165-403c-aef0-4877fb75845a'],
        [108, 'MINDNET', '1a3b7121-ab36-4796-9ac8-2bae53491c5e'],
        [108, 'MINDNET EXTENDED', '4af09e0f-93a5-43f5-badb-9f070d574417'],
        [108, 'NIGHT VISION', '06a54506-0b09-4e5a-91f3-e29b20c8c224'],
        [108, 'SPATIAL SENSE', '31a6e1bf-403d-47e4-a6dc-fe113fd875f1'],
        [108, 'SPATIAL SENSE, EXTENDED', '5b72a202-0dcc-44e8-b7ae-f508b7f5319f'],
        [108, 'THOUGHT RECOGNITION', 'ab70d6c1-60e8-4475-87ee-16790cb9ff68'],
        [108, '[SENSE] CRYPTESTHESIA', 'b2851e5f-76b8-42a7-8e74-11c0b4b7b67f'],
        [109, 'ALLEVIATE ADDICTION', 'ff90355c-5eba-4a35-8bf9-66afff9075ad'],
        [109, 'ALLEVIATE [ALLERGY]', 'fd407eeb-103e-4bef-a719-1098d8387536'],
        [109, 'AMBIDEXTERITY', 'f7ad9877-1f67-40a0-9813-ba53db664833'],
        [109, 'AWAKEN', 'a5096a06-4dee-40f6-879b-b88616cdb728'],
        [109, 'CRANK', 'e0ea86bc-06df-4edc-bee1-03b6a2733675'],
        [109, 'TRANSLATE', 'aaebe992-95e0-4607-a3b4-256455e67791'],
        [110, 'DECREASE INHERENT LIMITS', '4fbbaf9c-15fb-46ec-b899-5fc48829e52a'],
        [110, 'DECREASE REFLEXES', '3c2d97b8-4761-4e5a-ba61-ff4b7a403ead'],
        [110, 'ENABLER', 'a547f08e-0822-4a1c-968a-a2d6c249572c'],
        [110, 'FAST', '8c6ce834-d47a-40a6-9e4c-57a1030ce57e'],
        [110, 'FORCED DEFENSE', 'b1347682-58ad-4684-a93a-3f7703f1b4bf'],
        [110, 'INCREASE INHERENT LIMITS', '80704822-953b-45c5-aa8e-77ca26e6cef7'],
        [111, 'CHAFF', '4c01416b-ff1c-4e55-a2eb-b8048b8709e4'],
        [111, 'DECOY', '55c77b11-0647-4ece-9164-27caeadcf764'],
        [111, 'DOUBLE IMAGE', 'b3179247-4b02-47ea-abb0-0934b673cff2'],
        [111, 'DREAM', '8d724d8c-e6a0-41d7-8799-4fbb02de62a0'],
        [111, 'EUPHORIA', '86dfd77f-afcb-4533-951c-7b2ea8d462c5'],
        [111, 'OPIUM DEN', '883457da-6b0f-49d8-b40e-fcdf7486737e'],
        [111, 'PHYSICAL CAMOUFLAGE', '03bcc045-08db-4967-80e3-09640859aa69'],
        [112, 'FOREBODING', 'e02e6362-5b3c-410c-818b-890c8d008321'],
        [112, 'HOT POTATO', 'b60ef1c2-565a-4b96-9ca2-270905d977ea'],
        [112, 'MASS [SENSE] REMOVAL', '4dad17ac-f04c-49ce-a719-e475620028d3'],
        [112, '[SENSE] REMOVAL', '945fc713-6e3d-4b1e-b1aa-a1dbd2a9d429'],
        [113, 'BIND', 'f7984928-b770-4c96-8454-e8708b820dd0'],
        [113, 'NET BIND', 'e59a2be4-41b5-4b3e-aa5b-c4881a021cae'],
        [113, 'SOUND BARRIER', '466e45ee-755d-4fd6-ba23-298afa5849ef'],
        [113, 'STENCH', 'ecd4d99e-7e5c-43be-bfb7-7af989879236'],
        [113, 'STINK', '0a2e9859-b489-43f7-8e8a-d29cb4c8b682'],
        [113, 'SWITCH VEHICLE SIGNATURE', '0e6abd64-04bf-44ca-9358-4f12c9673209'],
        [113, 'VEHICLE MASK', '7eec4aa0-806c-4b4d-b809-5c37c4c06ae5'],
        [114, 'BUG ZAPPER', '75411316-c3b0-43cb-bbb8-24bde461ea58'],
        [114, 'CALM ANIMAL', 'f075819d-4924-4140-a5b4-fe8fdc069485'],
        [114, 'CALM PACK', 'b0a9f3b0-d153-4ff3-9193-666f89aaf0c3'],
        [114, 'CATFALL', 'faf0247b-bd15-4287-aa08-99f704de2abb'],
        [114, 'CLEAN [ELEMENT]', '05088798-a160-4080-90bb-fed9880435ba'],
        [114, 'COMPEL TRUTH', 'b0d02e0b-6c8f-4fef-8ca3-fe8f509218f0'],
        [114, 'MANA BIND', '30292b3d-d81d-433f-a211-af1939e158db'],
        [114, 'MANA NET', '37e33acf-31ab-429e-b470-d4a4c2e27559'],
        [115, 'CONTROL ANIMAL', 'e0578a09-8fba-424f-9288-b5e1ef810c2c'],
        [115, 'CONTROL PACK', '7d37e3fa-d16b-4d4f-8285-629f511df0e6'],
        [115, 'DEFLECTION', '1b311db9-d5cc-4b4c-857a-3208caa1bf0a'],
        [115, 'FASHION', '0a52251a-8b85-4814-8645-b929182274db'],
        [115, '[ELEMENT] AURA', '90b5f888-bc04-45c2-9b5e-11d95b787c6e'],
        [115, '[ELEMENT] WALL', 'ac8c938d-3aa1-4911-a812-c770e858de92'],
        [116, 'DECREASE GEAR LIMITS', '35ba4222-4e7b-4862-a767-42c5d3dfe2cb'],
        [116, 'DECREASE NOISE', '243c19b9-3555-4257-bca0-a7e7f0fff6bf'],
        [116, 'FIX', '33d35d53-5f71-435d-9bbd-913a5ffc35e1'],
        [116, 'GECKO CRAWL', 'd9b045d9-1320-4ae9-98d4-c67b1d681719'],
        [116, 'GLUE', '9b996aac-6bc6-4781-9a57-61ce33a4cd20'],
        [116, 'GLUE STRIP', '0f725e2e-2389-4aa4-99f9-da26275080bf'],
        [116, 'INCREASE GEAR LIMITS', '93237162-228a-4073-b798-f1b0605388a9'],
        [116, 'INCREASE NOISE', '785b5b5e-500f-40a2-9b25-b90f3dde7c26'],
        [117, 'INTERFERENCE', '3f40c2bb-e66f-44dc-b801-d459a8d3a2b4'],
        [117, 'LOCK', '403e9895-9772-4d2d-9cec-aee93a65794f'],
        [117, 'MAKEOVER', '7152a1f0-6b8f-4ca8-8885-2f5eb5853d73'],
        [117, 'MANA STATIC', '37ac2ee9-24ed-4d06-8c99-6295e5438ecb'],
        [117, 'MIST', '091a0669-f0d2-4633-8cfa-06c25986da7c'],
        [117, 'OFFENSIVE MANA BARRIER', 'ccc4fc17-0c10-4ac5-8a60-d31b0f330b8b'],
        [117, 'PRESERVE', 'bed82cc3-80f9-48e5-b7a3-63e176eb6a71'],
        [117, 'PROTECT VEHICLE', 'e748de46-a314-4fc5-a7b1-4cdb16c59637'],
        [118, '(CRITTER) FORM', '03b3daef-040d-4377-baf6-9b1919f48050'],
        [118, 'PULSE', '02b38262-db06-4698-b4b2-7a9e7f2452a9'],
        [118, 'REINFORCE', 'e520af8e-e06d-494e-ab4c-f89e9f9df192'],
        [118, 'SHAPE [MATERIAL]', '54e25153-07a4-4f52-8cb6-de8e00e4ac91'],
        [118, 'SHAPECHANGE', 'd4bac5a3-8793-43be-a831-da7e299acd3c'],
        [118, 'SLOW VEHICLE', '603e63a2-1caa-4860-9344-88cbb2df10a2'],
        [119, 'SPIRIT BARRIER', '8e341753-a4e1-41af-ba05-66daa90194a6'],
        [119, 'SPIRIT ZAPPER', '5b3c8f11-37a8-4090-a332-969d6ea1adb6'],
        [119, 'STERILIZE', 'f1ed2b18-e50c-4c00-8fb5-ebf9bff9828a'],
        [119, 'TURN TO GOO', '621b881e-5486-4dcb-a26e-2ad66bba09e8'],
        [122, 'ALARM WARD (ANCHORED)', '1dfd942b-ce62-44bd-a74c-8d8254e6d24b'],
        [122, 'ALLY CONJURATION (MINION)', 'cbab5603-5140-40ec-85a2-4c0706ad440b'],
        [122, 'ASPECT MANA LINE (MANA)', 'ae2bddcc-9899-4549-b0ff-1dc7c1bb291a'],
        [122, 'ASTRAL DOPPELGANGER', '89e47041-6072-42f5-b693-d1b91cadca6e'],
        [123, 'ATONEMENT (CONTRACTUAL)', '317d1173-5c00-4eac-89ff-282b3123cfbb'],
        [123, 'ATTUNE ANIMAL (ADEPT)', '1e518a3c-fdf9-40c7-af85-0d71a22402e2'],
        [124, 'ATTUNE ITEM (ADEPT)', 'a31197f4-c687-485b-a924-e88f2c76df76'],
        [124, 'AUGURY AND SORTILEGE', 'b0bde155-75b7-4200-8656-8414e4ba746a'],
        [125, 'BLOOD BOND (MATERIAL LINK)', '5e770b01-842f-45a2-adb3-3923a37a8ea3'],
        [125, 'BLOOD RITE', 'a6ca2396-f78f-45c1-9293-72bc41bb860b'],
        [125, 'BLOOD SIGHT (ORGANIC LINK)', '66714935-5b3c-417d-b953-159fe5a2031c'],
        [126, 'CALLING [SPIRIT TYPE]', '99c41c3c-5895-4a61-bb6c-184475ee7def'],
        [127, 'CHARGED WARD (ANCHORED)', '42726082-1595-4de2-81b1-0930ae954718'],
        [127, 'CIRCLE OF CLEANSING', '0d1969eb-cbb1-4044-8c13-161f4b1d4cb8'],
        [127, 'CREATE ALLY SPIRIT (MINION)', '779f8d7e-57a7-49aa-957e-8f31da31feac'],
        [127, 'DEATH MARK', 'd0a24ff2-ca52-4d76-856a-60c30bf0ecf0'],
        [127, 'DISPERSION CIRCLE', '444208d1-5cc0-4cb7-981e-52df0c8252a1'],
        [127, 'DOOR WARDS (ANCHORED)', '7d1bdbfd-47cb-4992-b83b-4dc815337d5d'],
        [128, 'EMPOWER (ADEPT)', '47bc1866-ad35-4c9a-8b3d-52502122a33e'],
        [129, 'GRAVE BINDING', '884b16b4-dc92-4a32-8dde-197b37819b24'],
        [129, 'GROUP BOND (CONTRACTUAL)', '548aea9d-a0c6-4e94-b59b-b49fa7e51ab7'],
        [133, 'FAR SENSING (SPOTTER)', '705766cb-ba49-494e-a679-653ff18ef57b'],
        [133, 'IMBUE ITEM', '0f5308ee-75fc-4f46-ad85-c28d2bd0e3bc'],
        [133, 'KYTHING (ANCHORED)', 'ff8bc6fc-7361-47e9-a5a0-081927ec9166'],
        [133, 'LEECHING (MANA)', '8bd8ac0b-be01-4207-b601-77570305ea10'],
        [134, 'LEY SIGHT (MANA)', '32bfb856-4df9-438a-9122-85f5ec8a647c'],
        [134, 'LIGHT OF DHARMA (ANCHORED)', '3917e09a-8e02-4f98-a4d1-7e00e01f3487'],
        [135, 'LIVING VESSEL PREPARATION', '6b2838f7-8ecb-455a-a2cc-ae1484e48a9a'],
        [135, 'MANIFEST SHA', '9b61d871-f156-44fc-a703-e19e99933747'],
        [135, 'MASKING WARD (ANCHORED)', 'ab135fb5-251e-47ec-a93d-5d22f134f867'],
        [135, 'OBFUSCATING WARD', 'cde04a23-e0cc-4aed-98e9-0d744757610e'],
        [136, 'POLARIZED WARD (ANCHORED)', '10efca5d-c1df-4770-b296-471132b80b98'],
        [136, 'RECHARGE REAGENTS', 'e45f4b5d-8969-4e03-ae55-583beee464fc'],
        [136, 'RITUAL OF CHANGE (MINION)', 'e85244ab-038d-4168-b028-3f409d9d9974'],
        [136, 'SMUDGING', 'e7e508e7-832f-4a61-8f0e-1aced19cfb09'],
        [136, 'SPIRIT PACT (CONTRACTUAL)', '70b6b4f8-8caf-4100-bb0a-bbb0f40faa84'],
        [136, 'SUMMON GREAT FORM SPIRIT', '838a29e8-d154-41a1-a589-2e338d312a1b'],
        [137, 'TRAP WARD (ANCHORED)', '8ff1dcfc-a725-4698-83f2-7f1fb0f43f4f'],
        [137, 'WHISPER OF BONES', 'b87ad05f-05fb-461d-a19b-0f1775c480d7'],
        [212, 'ASTRAL POWDER', '30fb4769-568f-49d8-833a-868e34e34809'],
        [212, 'GOVI', 'aaa5044f-ccba-404f-b207-68bdb218d960'],
        [213, 'HAND OF GLORY', 'eab0bcfd-9bf5-4482-9cca-2bdecb7f7b59'],
        [214, 'INANIMATE VESSEL PREPARATION', 'c7db0147-a077-423a-b617-a5cc8c0d4982'],
        [214, 'MORTIS OPTIGRAM', '9028a07e-c600-4d18-a911-a0307fc0fe96'],
        [214, 'MYSTIC RESTRAINTS', '68a3c211-ee25-42c3-9c24-8f824956acec'],
        [215, 'PAPER LOTUS', '096db26e-5fbe-461c-afb4-d6b631658aa6'],
        [216, 'SHOFAR', 'a81eedee-cf7b-4582-991b-24d597138aee'],
        [216, 'SYMBOLIC LINK', 'cd9b8ee6-5116-48aa-9e32-b5b11fc99c3f'],
    ],
    SSP: [
        [16, 'CHILL', '3374e604-a947-43fa-a493-ea7c244e5559'],
        [16, 'FLAME BURST', 'bd49cb38-6f42-479a-b256-d6753b7717e4'],
        [16, 'FRIGID', '7a30952b-063d-4921-b05e-b438b8913519'],
        [17, 'MAGEBOLT', '1ddf48f9-8fd3-4c47-a8d7-5ff5770a863c'],
        [17, 'SUNBEAM', '79fb3fcb-9cc0-4993-8594-badace575372'],
        [17, '[ELEMENT] GRENADE', 'de6a72c9-d70f-4bec-a5ef-232a78526707'],
        [18, 'BROADCAST', '40f96beb-53d7-43cb-b345-b4f4ffb1151c'],
        [18, 'CONVERT BLOOD TO ICHOR', '8074c89c-172d-413a-a8a3-bc39b35f5e73'],
        [18, 'DECONTAMINATION', '5233fa7b-cd0c-49e0-9e8b-4b587036f8ec'],
        [18, 'DEHYDRATE', 'f626c8cc-4798-4b93-9cde-048a55a4682d'],
        [18, 'PASSENGER', 'aace66b8-a856-461f-9506-f0d7c05da1ba'],
        [18, 'RECORDED ROOM', '25679580-3324-44a0-ba31-d6013f1cf372'],
        [18, 'SECRET HANDSHAKE', '2d776604-c664-452b-bb7b-0ff5d6468c57'],
        [18, 'SENDING', 'af1681a1-b511-42da-9a8b-2bd26f3a08ca'],
        [18, '[SENSE] LINK', 'ef4204e5-d39c-41a1-9485-82aeb7ea499b'],
        [19, 'ALLEVIATE NAUSEA', 'f3f5512d-b323-421d-ac12-9eb7403d4160'],
        [19, 'GHOULISH STRENGTH', '49c69c23-0416-4022-b5b0-685284da94d7'],
        [19, 'HEALTHY GLOW', 'f9864d0e-ab96-48cf-8947-a4834577dc97'],
        [19, 'HYDRATE', '489c0eea-5d18-4e35-ba74-1d76fae320b5'],
        [19, 'INFLICT DISEASE', '2d3ce706-8baa-4e05-a9b4-51a811fbc647'],
        [19, 'NAUSEATE', 'aef23c55-c9b6-4534-8c11-41593b4500c0'],
        [19, 'PERSONAL WARMTH', '59933987-6438-40fb-8325-268959b888c3'],
        [20, 'AIR FILTER', 'df65b87a-e386-46f5-b8ad-21ce4b08dc09'],
        [20, 'ALTER MEMORY', 'f7354160-896e-40ab-91e6-673af95cf516'],
        [20, 'ALTER TEMPERATURE', '31217b77-f149-403d-91bb-cd24542051b2'],
        [20, 'FALSE IMPRESSION', '56a474f0-142f-41cf-a130-feb26b96e3b0'],
        [20, 'MANASCAPE', 'b6c1c8d6-da46-41a7-8693-6f582adf50c1'],
        [20, 'ROT', 'd9b376d9-f826-4138-9c8d-e0dcf1a0ae4c'],
        [20, 'VAMPIRIC SPEED', '8e0cbba7-efa2-4dca-99e4-9d0eb1decf13'],
        [20, 'VAMPIRIC STEALTH', '82b6ce21-1b48-485c-b856-03513a22f260'],
        [21, 'ASTRAL ARMOR', '419f63a8-534a-4971-9481-0b44d0acd9e3'],
        [21, 'CONTROL EMOTIONS', '8917fc0d-649a-4231-bae6-7b34ce417263'],
        [21, 'EVAPORATE', 'e6799bf0-ab6f-4adf-8591-f3a0acd123c0'],
        [21, 'INSULATE', '8dc8b22e-fe26-4b9f-b816-c4b6b3e1a813'],
        [21, 'LOOKING GLASS', 'c4758634-2c63-4b77-a439-51811b326e8b'],
        [21, 'MOB MOOD', '6befcc1b-9a2b-4a52-a45e-1de1e38d90e7'],
        [21, 'NAPALM WALL', 'bd2a6ecf-75e8-4948-a939-430c3ca78002'],
        [22, 'DECRYSTALIZE', 'de47011e-2de9-4e4d-9862-d05465c8b4e8'],
        [22, 'MANA EBB', '6ae76940-5983-42e3-9f46-4f771cc7481f'],
        [22, 'MANA FLOW', 'a920e020-9beb-46e9-b39a-d7ac43d3fe51'],
        [22, 'PETRIFY', 'c6995b10-5fff-44c2-8182-0a0a1b30cc6b'],
        [22, 'PULSE', '65a02e9c-6472-406e-b5d1-17ec184c8ed2'],
        [22, 'RADIATION BARRIER', '8689fa5c-5965-4230-9706-245be36b242c'],
        [22, 'RADIATION SHIELD', '48f38481-6ece-4157-8594-d49a86eeb91a'],
    ],
    FA: [
        [49, 'BRANCH', 'b98919cb-4e48-4839-891b-e93e9edd466c'],
        [49, 'GROWTH', '98381c0f-da21-466e-9f66-46381496be5a'],
        [49, 'LASH', 'd5312f77-833f-4942-93e5-0a109996bca6'],
        [49, 'ROSEBUSH', '3b1052db-d347-4d89-a147-c54092a57f78'],
        [49, 'SLASH', '271cbaa4-c7fe-450a-b7e2-65ad90621b6f'],
        [49, 'THORN', '2896f942-1af6-424f-b93d-b7c3d7e69cdd'],
        [49, 'VINES', '4b4d9aa1-e38d-4684-9201-02f99a8480d2'],
        [50, 'BARRAGE', 'a63280c2-3bf8-4007-9578-58580a684b03'],
        [50, 'CLAW', 'b28accd7-e2b5-491e-ab0c-00a74be62f1a'],
        [50, 'COMET', 'e7d5f89f-ae86-4ad3-aeb2-42e82a81e7ae'],
        [50, 'EVIL EYE', 'ef1febff-d790-4706-80b1-6ddfbf9d61e5'],
        [50, 'GRAVITY', 'f39ed466-c61a-47fe-8822-4f3113baf176'],
        [50, 'GRAVITY WELL', '4115bdb8-c298-44f7-8a1c-8097133378ec'],
        [50, 'MULTIPLY FOOD', '2933d3c3-50ff-4fe8-8414-37f2520e39e1'],
        [51, 'ALTER BALLISTICS', '243313e6-a9af-456a-9631-6581d869aa02'],
        [52, 'FOREST TRANSFORMATION', '71c1b568-6199-46bf-97b2-6faff4fb2822'],
        [52, 'NECRO SUMMONING', 'af79d0e0-ab7b-4fd5-899a-eb0ae0c48371'],
        [125, 'BOIL BLOOD', '80688ffa-82e6-4db2-a12d-9dd0a6603a3f'],
        [126, 'CORPSE EXPLOSION', 'a9b72b69-a7f0-4f58-a13e-a9227e9d51de'],
        [126, 'EMBOLISM', '6ff4ad6b-9883-46c7-bbcd-51511b34e9c9'],
        [126, 'GIGER SPIT', '8b50b92c-a8d3-4682-83fc-68ea654d78a5'],
        [127, 'CLOT', '22579211-45f0-493b-9c71-29f159ceb120'],
        [127, 'ICE VEINS', '2c22bc40-1eee-48e5-83e4-84960e621a3d'],
        [127, 'PYROHEMETICS', 'ed093fec-e0ac-4627-a81c-264162e13f47'],
        [127, 'RUPTURE', '59aa2e30-c0f5-4340-97b6-adfe4e609756'],
        [127, 'SHARE DAMAGE', 'ffd492e3-0b04-447f-95f3-4b686a9be37b'],
        [127, 'SOMATIC HEALING', 'a856169f-fdb0-4117-a82d-ef0eefa04e95'],
        [128, 'BLOOD PUPPET', '55f4619b-07a1-4a18-9f8d-3b9a587ffd9a'],
        [128, 'SYMPATHETIC REPRISAL', '8d1c08f2-fe77-4a11-ab5f-dca8a7e0a7d9'],
        [129, 'BLOOD BLADE', '664fd84a-35c3-4309-9fb8-2ac8d8ba4f30'],
        [129, 'BLOOD WHIP', '8a096951-d2ee-4c46-9c64-9e9a7f218c03'],
        [129, 'CORPSE LASH', 'b09723b8-d83e-4377-826d-4b286958d5e3'],
        [129, 'CORPSE SPIKES', 'fb3d0fd7-058f-4ebf-86be-7863d7a5820b'],
        [129, 'VISCERA WEB', 'c55c32d8-52e2-4cdd-94b4-83c7566cbfaf'],
        [130, 'BLOOD BATH', '31b2929d-d876-40df-9cd4-8b92f57e839b'],
        [130, 'BLOOD OATH', '3282adfa-a92b-4d7e-895c-51dd0fe7f61a'],
        [130, 'DEATH CURSE', 'b557c296-01c2-4293-9d5a-c8e95be77612'],
        [131, 'GUARDIAN BOND', '242a0e9f-4130-4094-8cac-3db739ffafb2'],
    ],
    SS: [
        [189, 'CONVINCE', 'b683e8f4-ca91-4c64-932d-757754069a1f'],
        [189, 'FASHION', '547c0959-7a9b-487c-adec-54f639585695'],
        [190, 'HIBERNATE', 'ad128cba-aa39-4433-ab1e-9259e19778f6'],
        [190, 'INTERFERENCE', 'ffc5309a-9ae8-4770-aabd-2abe8246c0ec'],
        [190, 'INTOXICATION', 'd3431ff8-e33f-4cd4-a185-4817b5cce2f8'],
        [190, 'NUTRITION', 'e55eccaa-107d-4cee-b0fb-d10abb2d1f35'],
        [190, 'SOUND BARRIER', '8b3edb22-35ab-44a3-aa9d-0553a1af4da4'],
        [190, 'VEHICLE MASK', '58331f62-e907-4a4a-a59c-f9303d16dcbe'],
    ],
    HT: [
        [129, 'CORPS CADAVRE', '1f10cb4f-67d6-4193-b897-1a7f5ab67c2a'],
        [132, 'ZOMBIE', 'bd2bfef0-9de4-4870-9822-cdd504f7560f'],
        [191, 'CATCH', '38c206bb-9ab5-48ad-b736-0a8a464f1f1e'],
        [191, 'CONCEAL SCENT', '3ca36ddc-1e69-48b4-884b-b37ad86b6412'],
        [192, 'MANABLADE', '70f31768-c19b-4bef-8b71-d992d956d06a'],
        [192, 'POWERBLADE', 'bc8e70a9-2af6-4728-836d-daf19d5c61d4'],
        [192, 'RECHARGE POTENCY', '69d35098-2786-4b84-9825-3706430cc82b'],
        [192, 'SNAKEBLOOD', 'bc591aab-8409-4359-9124-c93f4bc968f0'],
    ],
    CA: [
        [153, 'CONSISTENCY', '08863013-48b9-4c7f-9bb1-25951b984dc1'],
        [153, 'INCUBUS', 'd0f89025-7573-47d2-accf-48f2a7d7a03d'],
        [153, 'INCUBUS SHROUD', 'a2f9abc1-f4f0-4247-a9eb-5f0916212b91'],
        [153, 'REWIND', '750efc53-02df-4d67-b5df-0abf2ab7e70d'],
    ],
    BB: [
        [21, 'DEATH REPLAY', '3fc55119-a6c3-4b0c-91eb-de107fbdea98'],
        [21, 'INCISION (MANIPULATION/PHYSICAL):', '1cbb5f25-7ce7-4347-bea6-764da9ee6e18'],
    ],
    BTB: [
        [158, 'ASTRAL DISRUPTION', '89046778-a77a-4f21-a448-a750af0898eb'],
        [158, 'MASS ASTRAL DISRUPTION', '4c595074-add0-40da-a707-598d2b94ae4f'],
    ],
};
const SPELL_SECTIONS: Record<string, RulebookSection> = Object.fromEntries((Object.entries(SPELL_HEADINGS) as [BookCode, [number, string, string][]][])
    .flatMap(([book, entries]) => entries.map(([page, heading]): [string, RulebookSection] => [`${book}:${headingKey(heading)}`, { book, page, heading }])));
const SPELL_BY_CHUMMER_ID: Record<string, string> = Object.fromEntries((Object.entries(SPELL_HEADINGS) as [BookCode, [number, string, string][]][])
    .flatMap(([book, entries]) => entries.map(([, heading, id]) => [id, `${book}:${headingKey(heading)}`])));

/** The keys a spell's name may have its entry under: the name, without a bracket at its end, its kind in round brackets. */
const spellNameKeys = (name: string) => [...new Set([name, name.replace(/\s*\([^)]*\)$/, ''), name.replace(/\[/g, '(').replace(/\]/g, ')')].map(headingKey))];

/**
 * How the items of a category find their entry (entryKey): their entries, by Chummer id, the names whose heading is
 * another, the keys a name may have, and the item's source (book and page).
 */
interface ItemLookup {
    sections: Record<string, RulebookSection>;
    byChummerId: Record<string, string>;
    aliases: Record<string, string>;
    nameKeys(name: string): string[];
    source(item: SR5Item): string;
}
const ACTION_LOOKUP: ItemLookup = {
    sections: ACTION_SECTIONS, byChummerId: ACTION_BY_CHUMMER_ID, aliases: ACTION_ALIASES, nameKeys: actionNameKeys,
    // a general pack action's page too (its own source is empty)
    source: item => RedesignActionDetails.source(item),
};
const SPELL_LOOKUP: ItemLookup = {
    sections: SPELL_SECTIONS, byChummerId: SPELL_BY_CHUMMER_ID, aliases: { Punch: 'SR5:CLOUT' }, nameKeys: spellNameKeys,
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};

/**
 * The adept powers' entries (powers.xml), by book: page, heading and Chummer id. The levels and kinds of a power share
 * one (Improved Potential (Social) ... (Chaos Mentor)). Their cost and activation lines under the heading are left out:
 * the item has its power points and activation. Heightened Concern is Chummer's Heightened Concentration.
 */
const POWER_HEADINGS: Partial<Record<BookCode, [number, string, string][]>> = {
    SR5: [
        [309, 'ADRENALINE BOOST', '8caaadf4-75b4-4535-928a-5648d395c13a'],
        [309, 'ASTRAL PERCEPTION', '39224ecf-f3d0-40b6-95a6-2f047f95d736'],
        [309, 'ATTRIBUTE BOOST', 'ddcca815-d6fe-41ed-b174-2e7255320f17'],
        [309, 'COMBAT SENSE', '76337564-7688-497f-84f9-302c6ece10fe'],
        [309, 'CRITICAL STRIKE', 'dbf16604-164c-485c-96c8-fe3136cd5caa'],
        [309, 'DANGER SENSE', '980d6575-c28f-4076-9b36-881cea018335'],
        [309, 'ENHANCED ACCURACY', 'e009da31-0301-4604-b13f-49b071aa25a1'],
        [309, 'ENHANCED PERCEPTION', '974d2aba-1772-474b-aaff-c84a12766e5f'],
        [309, 'IMPROVED ABILITY', '75821fb7-a180-4012-aa16-daa92ac3bb63'],
        [309, 'IMPROVED PHYSICAL ATTRIBUTE', '901d2af5-246a-447a-a8e2-b2e8c10593df'],
        [309, 'IMPROVED POTENTIAL', '1fde7231-e5cc-4fa3-a1fe-b80b00212417'],
        [309, 'IMPROVED POTENTIAL', '2a7abc86-aa01-4127-b4b1-f73b49a2b5db'],
        [309, 'IMPROVED POTENTIAL', 'd9b811f4-aa64-46fb-b67d-2995134eda4e'],
        [309, 'IMPROVED POTENTIAL', '81cc6ee1-7c10-4a4a-baa8-f02cad4542c6'],
        [310, 'IMPROVED REFLEXES', 'fea9e769-5f2c-4bae-9610-56c0825e145a'],
        [310, 'IMPROVED SENSE', '1376c13b-9a01-4873-b935-5b7d91e03785'],
        [310, 'KILLING HANDS', '23636777-44df-44f1-8742-db29dc3c4fdf'],
        [310, 'KINESICS', 'f1e8a618-ba12-4972-91f0-974500387893'],
        [310, 'LIGHT BODY', 'ce7df757-792e-4fac-a86e-6b587586deb2'],
        [310, 'MISSILE PARRY', 'c152dcba-8bb7-4a2a-86bb-6f854ea53b55'],
        [310, 'MYSTIC ARMOR', 'da5f9389-a5fd-48ed-8825-8852ff5c56a8'],
        [311, 'NATURAL IMMUNITY', '98b59b41-6a91-4abc-a6d2-e8debaa3b5aa'],
        [311, 'PAIN RESISTANCE', '545a4bec-c144-42a1-b553-6d6c0c91f07f'],
        [311, 'RAPID HEALING', '4676b6f7-120d-4344-81ac-5922445a521b'],
        [311, 'SPELL RESISTANCE', '82d8c376-7509-468a-be17-8c9cba4c86c4'],
        [311, 'TRACELESS WALK', '3f3fcdbc-c046-4a95-bd46-511a76d75b56'],
        [311, 'VOICE CONTROL', '71692391-e01f-4902-98f0-abbbf5431680'],
        [311, 'WALL RUNNING', 'bfd1e09c-5765-423b-b079-f5d8e794485a'],
    ],
    SG: [
        [169, 'ANALYTICS', '0099ad65-bcc1-47a5-a241-02f621e7c33a'],
        [169, 'ANIMAL EMPATHY', '870edcf8-cb19-4e15-948c-1b3bf80ac651'],
        [169, 'BERSERK', '80577dac-7697-4da9-87fd-d4442dc34560'],
        [169, 'BERSERKER’S RAGE', '59455eae-beb5-45fc-b19d-dc3aff65335d'],
        [169, 'BLIND FIGHTING', 'f3df89bb-71f6-41d8-a86d-4bde1ab74352'],
        [169, 'CLOAK', '42baa818-50ca-4c6b-b316-780a51df9c97'],
        [169, 'COOL RESOLVE', 'deec22db-cf2c-47b6-ac34-95a13bcd0bf8'],
        [170, 'COUNTERSTRIKE', '6770cfab-8c1a-4c6d-add7-f7d96220e9b0'],
        [170, 'ELEMENTAL BODY', '1eb8d3fa-2a67-4b71-a9de-dfbf5236eeda'],
        [170, 'ELEMENTAL STRIKE', '3d27c3bb-9cca-45c2-b8b1-6225a236069b'],
        [170, 'ELEMENTAL WEAPON', 'eb323003-4112-42ad-955a-00211e43e6d1'],
        [171, 'EMPATHIC HEALING', '6680b68d-77df-4fe4-a722-30464dd3c646'],
        [171, 'FACIAL SCULPT', 'fbd06bae-b3ba-4514-8d90-870eff1c336b'],
        [171, 'FLEXIBILITY', '438fb5de-9c09-4421-a6a8-c3d68ba8aada'],
        [171, 'FREEFALL', '88bf5626-6cf8-4dcc-bfc0-8abc889cdf4e'],
        [171, 'HANG TIME', 'c59c1bb0-9b3e-41be-9079-8982b451fe45'],
        [172, 'INERTIA STRIKE', 'da59618c-059d-4cc5-adb5-c61e6049378c'],
        [172, 'KINESICS MASTERY', 'e1e242c3-cb63-476f-9868-90c311b36383'],
        [172, 'LINGUISTICS', '44f0bbba-184a-4e76-93de-19862ac6607b'],
        [172, 'MAGIC SENSE', 'd20f0441-a290-4732-829f-3138d446aad4'],
        [172, 'MELANIN CONTROL', '2149818a-22b0-4267-83d6-7b3c27d4ee69'],
        [172, 'METABOLIC CONTROL', 'ecd611b4-dda6-4683-b7a9-850a469a3274'],
        [172, 'MISSILE MASTERY', '1221e699-e61b-4aed-adbb-a8eec02a65e2'],
        [172, 'MOTION SENSE', '930ace31-a2a2-4616-8dfb-1074e4be76c9'],
        [173, 'NERVE STRIKE', 'd1279546-69a6-4c35-9b3d-0211138050e8'],
        [173, 'NIMBLE FINGERS', '1ec402f1-6139-4f94-8e86-92aa463bf536'],
        [173, 'PAIN RELIEF', 'adda6c9c-703b-4361-a4dd-d7ebfd3c138d'],
        [173, 'PENETRATING STRIKE', '70311f5c-a019-47b9-be21-e9a8d270e32e'],
        [173, 'PLAGUE CLOUD', '941225f2-148b-484e-a2b2-0a32cc7debe1'],
        [173, 'RAPID DRAW', '832a418d-4d55-433c-8230-4b04f05ba6d9'],
        [174, 'RIPOSTE', '11f3fa59-e06d-4816-87a9-b74664d1ae9a'],
        [174, 'SKATE', 'c0d647dd-4f66-42a6-9040-202b1bba4b71'],
        [174, 'SMASHING BLOW', '1dc0b5c6-94a8-4598-a017-f6399d9175da'],
        [174, 'SPIRIT CLAW', '24bc482d-9ce3-4d0a-bd43-31311b6716d6'],
        [174, 'SPIRIT RAM', '6145977c-5825-4358-b0db-1d189cd9d402'],
        [174, 'STILLNESS', '02eb1616-9361-47a8-acc8-030566d9a0ea'],
        [174, 'SUSTENANCE', '772e0298-8abf-42b7-9734-359cadcb8d1e'],
        [175, 'TEMPERATURE TOLERANCE', 'bf425bd4-f112-4218-b729-2e8bb32f3b2b'],
        [175, 'THREE-DIMENSIONAL MEMORY', '61406917-9d88-440f-a756-16bdf6ffb37e'],
        [176, 'TOXIC STRIKE', '6ed1a784-1097-4db8-b179-e4198493c2f0'],
    ],
    SGE: [
        [4, 'KERATIN CONTROL', '830de0b7-8d83-467b-91e4-ce10081838b0'],
        [4, 'LIVING FOCUS', 'ee72398d-9daf-493f-b79b-5dab81e84013'],
    ],
    SSP: [
        [23, 'DEMARA', '89f8d4a8-a769-4a3c-9009-f0371e42daf8'],
        [23, 'EIDETIC SENSE MEMORY', '57e7de72-6155-486b-9269-caebedfb34fe'],
        [23, 'ENTHRALLING PERFORMANCE', '51755f26-c5d4-461d-bd59-496a45b03e6b'],
        [23, 'HEIGHTENED CONCERN', 'df257b19-9ef7-4f0b-9aaa-4dbc43372431'],  // Chummer's Heightened Concentration
        [23, 'INDOMITABLE WILL', 'd75638f3-be99-4f65-b61f-ea8b4b249f92'],
        [23, 'IRON GUT', 'bde8c111-b429-4283-87ca-9d3a2afc0215'],
        [23, 'IRON LUNGS', 'bee8413d-ad32-4c0b-998e-b38f2728d417'],
        [23, 'IRON WILL', 'ad169692-909f-4945-a3b8-fc0d19e2ed28'],
        [24, 'KERATIN CONTROL', '489a28c7-c4a2-4071-9f5a-35c0e333f589'],
        [24, 'LIVING FOCUS', '57d6a5ba-44f0-458a-8db5-40acf479065c'],
        [24, 'MAINTAIN WARMTH', '29761d0e-072e-48a9-afc6-6154af8b2262'],
        [24, 'MEMORY DISPLACEMENT', '35a76113-84fb-4f9d-b47d-f7fb491e6285'],
        [24, 'PIERCING SENSES', '57cea4cd-754b-4fcd-8711-75721b1edc15'],
        [24, 'POWER SWIMMING', '0fd4d5ac-3254-458b-9323-e0b441060dc9'],
        [24, 'POWER SWIMMING', '639a2d7f-9018-4016-a61c-b7f83ebcd9b9'],
        [24, 'ROOTING', '79eda3bf-f81b-4db7-9cb9-d22255c99e12'],
        [24, 'SUPERNATURAL TOUGHNESS', '300edbf6-1943-4f4e-87eb-7379ccef8ed5'],
    ],
    SS: [
        [191, 'COMMANDING VOICE', '9fd628cc-dd06-435c-80d3-5261e7e5b1e5'],
        [191, 'LIGHT TOUCH', 'b6982580-fb86-4ac8-9312-98459ecbe811'],
        [191, 'MIMIC', '60ac2e3a-d24a-459c-b8a4-cf648f0de447'],
        [191, 'NERVE STRIKE', 'a66b175c-512b-4a31-ad61-27eb3bd05055'],
        [191, 'NIMBLE FINGERS', '4c7771f6-e071-46a4-a42b-5bfa7194f0b8'],
    ],
    HT: [
        [190, 'ADEPT ACCIDENT', '9646a0b8-ab39-4499-85cf-1ffd9983d0a5'],
        [190, 'ADEPT SPELL', '87f0f97d-cbcf-4427-9259-baf376c9f55a'],
        [190, 'FOCUSED ARCHERY', 'c2ea9046-647d-4104-871a-24b3ee1fecfa'],
        [190, 'KIAI', '857fcf19-78ce-427a-a1e8-077e52aab759'],
        [191, 'MASTER ARCHER', '3c0862c4-1070-44dd-8866-0ba89276246b'],
        [191, 'PRECISION THROWING', '18da4f2f-f813-4d17-8b7b-29b2751e9cfa'],
    ],
    BB: [
        [22, 'FEIGN DEATH', 'ca35c065-86ab-4aa8-a52f-ae37cc69648c'],
        [22, 'FEIGN ILLNESS', '0f0a55a8-5c39-4568-a15d-219b3664b10f'],
        [22, 'TRANSMIT DAMAGE', 'd890df94-b4f0-4b56-8289-7e1cfac2a95d'],
    ],
    CA: [
        [153, 'LIE DETECTOR', '7a5084df-b4d2-4f2a-84aa-43627f43c240'],
        [153, 'OSMOSIS', 'e2b791c0-54ef-4843-ab70-12a08767699a'],
        [153, 'VENTRILOQUISM', '93b7663e-30da-468b-83cf-dc07439bcae2'],
    ],
    BTB: [
        [159, 'MYSTIC APTITUDE', '1ac890d7-5152-40a8-80e8-73d342571a33'],
        [160, 'STATE OF PURITY', '56b4fe33-eb48-4365-ae2e-ebdffa05b1f6'],
    ],
};
/**
 * The complex forms' entries (complexforms.xml), by book: page, heading and Chummer id. Their Target / Duration / FV
 * line is a stat block (left out); Kill Code heads two with "COMPLEX FORM:".
 */
const COMPLEX_FORM_HEADINGS: Partial<Record<BookCode, [number, string, string][]>> = {
    SR5: [
        [252, 'CLEANER', '373638b9-4334-4645-99f5-c3673e4f809b'],
        [252, 'DIFFUSION OF [MATRIX ATTRIBUTE]', '33e75cd6-cad7-43dd-87ac-9838c83eccb5'],
        [252, 'EDITOR', '6b4ed8d5-75c8-4415-9578-15afa4ac8494'],
        [252, 'INFUSION OF [MATRIX ATTRIBUTE]', '2abb9759-30b1-490f-9b42-0d6b7d282526'],
        [252, 'PULSE STORM', 'd8b11a80-eb95-409e-a53b-18c48e09342e'],
        [252, 'PUPPETEER', 'f53a57c9-5073-4af3-aff9-45e3e449ac59'],
        [252, 'RESONANCE CHANNEL', 'cfebf27d-707e-4ea2-a376-394738a11b3c'],
        [252, 'STATIC VEIL', 'dbb1d719-c829-4c45-9a53-9ff538865c14'],
        [253, 'RESONANCE SPIKE', '704abd70-c0e6-4f06-b186-53a7cb856584'],
        [253, 'RESONANCE VEIL', '42cc98b0-2b3f-42a0-bbe7-fb7d2633d11a'],
        [253, 'STATIC BOMB', 'f64ccd1d-634f-4cf3-a020-ab03247abf25'],
        [253, 'STITCHES', '7cd49196-0912-43c5-b1a1-c9da96432340'],
        [253, 'TATTLETALE', 'f9dc77ad-bc06-4a1b-a967-0e78efe136e4'],
        [253, 'TRANSCENDENT GRID', '73ed88a2-7a5d-4b1c-bc2e-f92b80f6c593'],
    ],
    KC: [
        [90, 'COMPLEX FORM: LOTO', '3bed693e-d9dd-4873-8d54-2cbe97202174'],
        [90, 'OVERDRIVE', '60b3f99f-f903-426a-ae13-ea604e77a956'],
        [91, 'COMPLEX FORM: SPRITE PET', 'c9eb7fba-b5dd-40b1-907a-a6683dc9977d'],
        [91, 'HYPERTHREADING', '174f61be-5dad-41ad-8d6b-641bc514b9bb'],
        [94, 'ARC FEEDBACK', '07b461db-3982-4fa2-8e24-cc5007c377a4'],
        [94, 'BOOTLEG PROGRAM', '42a11004-5379-4b79-90fa-a30f7ddf4f14'],
        [94, 'HOST EMULATOR', '72630724-8d43-4a28-837c-160c735a0d0d'],
        [95, 'MIRRORED PERSONA', '080013b7-deb3-4a2e-822f-400ecf8293b2'],
        [95, 'PINCH', '7d98d12d-5b02-4bc8-bf1f-b0b3507ebdaf'],
        [95, 'PRIMED CHARGE', '1a4a6137-53d6-4ada-a788-49e56f73bb86'],
        [95, 'RESONANCE BIND', 'b3e7f9e4-aec4-4114-bd49-e04a43be502f'],
        [95, 'RESONANCE CACHE', 'c5185f4d-32b4-4239-91a9-f0095ccf8572'],
        [95, 'SEARCH HISTORY', 'f89957e0-9c70-4503-b47d-0511b7bca5b6'],
        [96, 'WEAKEN DATA BOMB', '819a111f-b49d-498b-ac63-54f770cf7cd7'],
        [96, 'WEAKEN ENCRYPTION', '9e849f66-6ad4-49fb-9ccd-e0b250b0625b'],
        [133, 'CAUSAL NEXUS', '92b4cf59-62ca-443b-aeb8-f5044967c835'],
        [133, 'FORCED HEURISTICS', 'cadf7e01-c75d-4a49-8676-87ddcb0eaa74'],
        [134, 'DISSONANCE SPIKE', '4856cfa1-89c8-484a-9127-ddc4a2327c63'],
    ],
    DT: [
        [58, 'DEREZZ', '57566f59-ddbf-42bb-929a-2966ce2fde46'],
        [58, 'FAQ', '2badbff2-02e1-4218-97f0-f53f71f22cc4'],
        [58, 'IC TRAY', '5e5c8711-70a9-4068-b084-2ae23fce8fa7'],
        [58, 'MISREAD MARKS', 'bfa66f3e-4d04-43a4-972a-4e0b430284ca'],
        [58, 'REDUNDANCY', '9a2bcb96-36fe-4f43-bbfe-f2040a8ee491'],
    ],
    CF: [
        [25, 'CORIOLIS', 'f9a63582-6858-4b83-a76f-6daa52b127c5'],
    ],
};
/** A table of entries with one Chummer id each (spells, adept powers, complex forms): the sections, the ids' entries. */
function idTable(headings: Partial<Record<BookCode, [number, string, string][]>>) {
    const entries = (Object.entries(headings) as [BookCode, [number, string, string][]][]).flatMap(([book, rows]) => rows.map(row => [book, ...row] as const));
    return {
        sections: Object.fromEntries(entries.map(([book, page, heading]): [string, RulebookSection] => [`${book}:${headingKey(heading)}`, { book, page, heading }])),
        byChummerId: Object.fromEntries(entries.map(([book, , heading, id]) => [id, `${book}:${headingKey(heading)}`])),
    };
}
const POWERS = idTable(POWER_HEADINGS);
const COMPLEX_FORMS = idTable(COMPLEX_FORM_HEADINGS);
const POWER_LOOKUP: ItemLookup = {
    sections: POWERS.sections, byChummerId: POWERS.byChummerId, aliases: {}, nameKeys: spellNameKeys,
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};
const COMPLEX_FORM_LOOKUP: ItemLookup = {
    sections: COMPLEX_FORMS.sections, byChummerId: COMPLEX_FORMS.byChummerId, aliases: {}, nameKeys: spellNameKeys,
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};

/**
 * The metamagics' entries (metamagic.xml), by book: page, heading and Chummer id. The Core book has no heading for
 * them: each is a paragraph that starts with its name ("CENTERING:", findRunIn). Their lines under the heading in
 * Street Grimoire and Forbidden Arcana (activation, prerequisite) are left out as the adept powers' cost lines.
 */
const METAMAGIC_HEADINGS: Partial<Record<BookCode, [number, string, string][]>> = {
    SR5: [
        [325, 'ADEPT CENTERING:', '03bdecec-6142-4b24-8aaa-0a0827c3eb78'],
        [325, 'CENTERING:', 'e021b9ba-2cbe-4c17-865d-0ebc9a2df4cc'],
        [325, 'FIXATION:', '099af8f9-6d04-4aa5-8645-f7204a8bf9be'],
        [325, 'FLEXIBLE SIGNATURE:', '666626f2-3605-4c48-8190-7bcbcdb2e89c'],
        [326, 'MASKING:', '505d9fe3-852c-459b-8f9e-3e22c1b91b9a'],
        [326, 'POWER POINT:', '406f096a-c093-4a02-b60f-002eb01a20b9'],
        [326, 'QUICKENING:', '4ea558ed-0fe8-4b9e-b2fa-afffb3eb2476'],
        [326, 'SHIELDING:', '532c6fed-5ad1-49b3-94cd-6f640b988f70'],
        [326, 'SPELL SHAPING:', '185c6889-2c45-47ee-9192-5f2fef3206a1'],
        [399, 'MOVEMENT', 'ef0f4461-4da9-4a24-b508-77f5c3a920d7'],
    ],
    SG: [
        [87, 'CORRUPTION', '920770d1-a705-4fc9-8814-f3a4a455e8fb'],
        [87, 'TAINT', '215dbdc3-b4f5-4ca6-98b1-5d6ea5eb5fda'],
        [90, 'CANNIBALIZE (ADEPTS ONLY)', '866592b7-b652-4270-b696-4a8020b62b12'],
        [90, 'POWER BLEED (ADEPTS ONLY)', '94998ad1-956f-4c04-bb3f-f4464170bf32'],
        [90, 'SACRIFICE', 'd220ba19-5259-4d12-a61e-49c751640b4b'],
        [145, 'DANGER SENSE', 'f2720e1b-494d-4d5b-9de2-7dc367f5b2a8'],
        [145, 'PSYCHOMETRY', '49f33f95-55fd-487f-9753-8b6207d021b9'],
        [145, 'SYMPATHETIC LINKING', '9540267c-d53c-4547-9bd2-e1f06723caee'],
        [148, 'CHANNELING', 'fdea34cc-5ffd-4f93-a80a-f1973c08a2c3'],
        [148, 'EXORCISM', '283f7a08-7e65-40d6-819c-ac40baf88f73'],
        [149, 'EXTENDED MASKING', '1712175b-66ee-44bd-9149-d2f450cc63d2'],
        [150, 'ASTRAL BLUFF', '81089c40-2a69-4ac3-b3e2-40ca1c9c4b6c'],
        [150, 'FLUX', 'd1d6cd22-d65c-4218-a783-f7c6a62dfa48'],
        [151, 'ABSORPTION', '94a38b4a-060d-4e95-bd58-665ff47929e7'],
        [151, 'REFLECTION', '102cc073-ba99-42a5-b5c6-37c9e87c3954'],
        [152, 'ANCHORING', 'bb1431df-c546-4799-8dd4-ec42125f1a47'],
        [153, 'ADVANCED ALCHEMY', 'bffb21bd-30d2-4af8-a632-1d10109a1d25'],
        [153, 'EFFICIENT RITUAL', '00aa480b-792f-4196-810d-72a91bcb81d0'],
        [153, 'GREATER RITUAL', 'c98c7b04-052c-4f70-bb15-19aaed70d2b7'],
        [153, 'PENETRATING SPELL', '433c2fdb-7dfe-4876-988f-2ec868631922'],
        [155, 'CLEANSING', '2cf811cd-1712-4c44-b20e-3f49ad8103a4'],
        [155, 'SENSING', '657034b0-7c9d-4f5e-8169-578bf18069e4'],
        [156, 'INFUSION', '954aca74-bb3e-493d-8df1-3563803780e5'],
        [156, 'QI SCULPT', 'c860a479-4bb4-45f2-b4dd-dfe1ce39c045'],
        [156, 'SUPERNATURAL PROWESS', '69e7b92a-c5f9-4471-957f-839f5e7ac62d'],
        [157, 'APEX PREDATOR', '443b0790-f4f3-40d4-9a13-2c6e42cbb4fa'],
        [157, 'TOTEM FORM (ANIMAL)', '066207e4-dc08-4718-96c2-a6ab4d9d0380'],
        [158, 'DOMAIN OF THE SPIRITUAL', '8c433e0e-d1ee-41d8-82bd-ecfc20c6a069'],
        [158, 'FAE-TOUCHED', '8d16f0b3-ec2d-445e-b8f5-85ceeb32efe9'],
        [158, 'STILLNESS OF THE VOID', 'c943ee91-ecad-4e84-bc8c-fab11b29090c'],
        [159, 'DOMAIN OF THE WARRIOR', '605f3c8e-96c2-40f0-a09a-2857d2c5bbe6'],
        [159, 'PRESENCE', '67e53002-2302-47c6-bc3c-f0b455e73672'],
    ],
    FA: [
        [43, 'PARADIGM SHIFT: INSECT SHAMAN', 'a3015186-c234-448c-811d-43c7d722abd2'],
        [44, 'ASTRALNAUT', 'c46f1864-8d72-4c4c-9704-cb286eab053d'],
        [44, 'IMPROVED ASTRAL FORM', 'b314c391-52fc-447e-bece-483943b00237'],
        [44, 'PARADIGM SHIFT: TOXIC', 'a83ef030-4372-421e-874e-839ceb77a64e'],
        [44, 'SPIRIT EXPANSION: SHEDIM', '95a75c73-37a6-4e3c-9fef-27322d43394a'],
        [44, 'SPIRIT EXPANSION: UMT', '0b136740-8728-4c05-86f1-ddaf9368c0a8'],
        [44, 'STRUCTURED SPELLCASTING', '5159ae63-7251-4c33-a6f9-77f6a06fa349'],
        [45, 'RECKLESS NECRO CONJURING', 'f4576514-4744-42ba-baaa-02dc4aaed297'],
        [45, 'TAROT SUMMONING', '59d0beab-4fba-48a9-a135-02e396ded7a4'],
        [46, 'HARMONIOUS DEFENSE', '4eab0dc3-a040-42b1-a21e-552047ed27af'],
        [46, 'HARMONIOUS REFLECTION', '680743d7-d474-4042-abbf-ea905eedc0de'],
        [46, 'NOBLE SACRIFICE', 'fa550487-39ef-4ea2-a613-5b9bdee0961c'],
        [131, 'PREDATOR FEAST', '5b2175c6-bbc9-4e8f-ac33-7a7ac6ded312'],
        [131, 'SOUL TETHER', 'ba511830-7fb6-4ec0-8861-5cff07c90f41'],
        [131, 'SPIRITUAL SACRIFICE', '30774b9d-bb89-4ece-9bc4-35017cbf30b4'],
    ],
    DTR: [
        [165, 'ECHO BINDING', '42f5af49-ade3-43a7-b501-25ae975a574b'],
        [165, 'ENHANCED MIST FORM:', '2bd5228e-6698-4905-aecb-45fa5653456c'],
        [165, 'ESSENCE EXPANSION:', '0ab2d588-34f5-4204-aee2-b944e5db411a'],
    ],
    HT: [
        [134, 'GREAT FORM POSSESSION', '7b297dad-1111-4819-8c7a-ecdb95479011'],
    ],
};
/**
 * The echoes' entries (echoes.xml), by book: page, heading and Chummer id. The Core book's and Data Trails' first ones
 * are paragraphs that start with their name (findRunIn; Data Trails calls Fight or Flight Filter "FFF"); Chummer's
 * Dissonant Echoes (its book DTD) are in Data Trails.
 */
const ECHO_HEADINGS: Partial<Record<BookCode, [number, string, string][]>> = {
    SR5: [
        [258, 'ATTACK UPGRADE:', '36aa9af4-5c04-40d9-ba09-31b401cc1ff0'],
        [258, 'DATA PROCESSING UPGRADE:', 'cd2e640c-06b7-4638-9eb4-bf75c28452a2'],
        [258, 'FIREWALL UPGRADE:', '4550fe9d-e5da-4b01-8115-14f7a0dfab1c'],
        [258, 'MIND OVER MACHINE:', '13c9f18c-a5f6-40e3-97c1-39265e1d70c2'],
        [258, 'NEUROFILTER:', '0adbc66d-6b29-4427-b652-0a93a87804b2'],
        [258, 'OVERCLOCKING:', '61055141-71f5-400e-9e67-cef650ce4801'],
        [258, 'RESONANCE LINK:', 'dbd2fbba-8487-45cc-a92a-33813c3643b6'],
        [258, 'RESONANCE [PROGRAM]:', 'd5dbe3f7-8a44-466b-8d5d-db9f0c68ee6b'],
        [258, 'SLEAZE UPGRADE:', 'ce98f873-d261-4f1e-8bc7-fafa3c712700'],
    ],
    DT: [
        [58, 'FFF:', '18269d5a-2750-4636-8ae3-f9f268d44577'],
        [58, 'MATHEMAGICS:', 'e7dc7a5a-89dc-42e4-8332-8225bbff3c45'],
        [59, 'MMRI:', '262dd3e2-5433-4b9a-b637-c5f5a3af5510'],
        [59, 'QUIET:', '032d5d7f-41b9-47f5-8bd0-b7e2cf2c3adf'],
        [59, 'RESONANCE RIDING:', '0408da17-8327-4e8c-a64f-48431bba8e58'],
        [59, 'RESONANCE SCREAM:', 'e6f66ec1-af07-4008-abbe-e4d31cc82358'],
        [59, 'SKINLINK:', '45ed755c-cf0e-4f57-95d2-2c01b4eda760'],
        [165, 'CONTAMINATE', 'cee8e3bc-447b-4a67-9752-15e3e104e57d'],
        [165, 'PRYON', '2fe27536-4de7-49c1-a933-8d9a65604533'],
        [165, 'SIPHON', 'a0966081-2534-4fc4-a2e6-504b4ecf9756'],
    ],
    DTR: [
        [85, 'NEW ECHO: DEFRAG', '2c5953bf-3680-4ce5-9087-2e1e419937b2'],
    ],
    KC: [
        [101, 'AEGIS', '64710f70-897a-4505-829d-7d0ade750b24'],
        [101, 'DRAINING SPIKE', '8aa97815-eacb-412d-99ac-1acda562fb52'],
        [101, 'NEURAL SYNERGY', 'a6f9a6cd-4727-4de6-a774-bb93ab67940a'],
        [101, 'PREDICTIVE ANALYTICS', '96f534c0-b53b-43af-bdac-54de468f0d70'],
        [102, 'RESONANCE RESISTANCE', '37e8342f-9aad-4ee0-8e68-7a5c00f2678b'],
        [102, 'THE VAN DER WAALS EFFECT', '1e0405f3-3872-4a53-afd7-bd643899e7d9'],
        [102, 'WILL OF THE RESONANCE', '6cb9bc65-7b64-44dd-ba9a-f96f3c09c741'],
    ],
};
const METAMAGICS = idTable(METAMAGIC_HEADINGS);
const ECHOES = idTable(ECHO_HEADINGS);
const METAMAGIC_LOOKUP: ItemLookup = {
    sections: METAMAGICS.sections, byChummerId: METAMAGICS.byChummerId, aliases: {}, nameKeys: spellNameKeys,
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};
const ECHO_LOOKUP: ItemLookup = {
    // by name too: Data Trails' name for one, and the Dissonant Echoes Chummer gives a book of their own (DTD)
    sections: ECHOES.sections, byChummerId: ECHOES.byChummerId, nameKeys: spellNameKeys,
    aliases: { 'Fight or Flight Filter': 'DT:FFF', Contaminate: 'DT:CONTAMINATE', Siphon: 'DT:SIPHON', Pryon: 'DT:PRYON' },
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};

/**
 * The qualities' entries, by book: page, heading and the Chummer ids (qualities.xml) of the qualities it describes. One
 * entry often has several: the levels and kinds of a quality (Addiction (Mild) ... (Burnout), Trust Fund I-IV,
 * Infected: Ghoul (Dwarf) ... (Troll)) share their section. Positive and negative qualities are one category.
 */
const QUALITY_HEADINGS: Partial<Record<BookCode, [number, string, string[]][]>> = {
    SR5: [
        [69, 'ADEPTS', ['55247bdc-c313-4614-ae15-5012308096ff']],
        [69, 'ASPECTED MAGICIANS', ['4adeb2d4-e42e-4b7a-9a5d-3df325ae59a5']],
        [69, 'MAGICIANS', ['0e741331-d776-4be8-abc5-4101228abdef']],
        [69, 'MYSTIC ADEPTS', ['9d53e1e4-3f31-40cb-bfbe-4b94f5ba757e']],
        [71, 'AMBIDEXTROUS', ['68cfe94a-fa7e-4129-a9b9-b5d73e3ced99']],
        [72, 'ANALYTICAL MIND', ['5b19dbcd-fb69-4a02-a25a-7ac5342ca576']],
        [72, 'APTITUDE', ['58e3d62a-2073-4af5-b8e0-00c446b3a5ab']],
        [72, 'ASTRAL CHAMELEON', ['7d81f676-e523-4ec6-ae98-8d801f90b031']],
        [72, 'BILINGUAL', ['c734e46a-d391-45a6-b022-6f18db5019f1']],
        [72, 'BLANDNESS', ['9cffd452-8489-48d5-888c-ac35459d9174']],
        [72, 'CATLIKE', ['84305e09-f8d5-4a82-8257-0119b8c3f926']],
        [72, 'CODESLINGER', ['41cc3e26-ae55-4e28-bd6a-b08866c21424']],
        [72, 'DOUBLE-JOINTED', ['db579224-99c7-48e0-84ab-77a987a84f4a']],
        [72, 'EXCEPTIONAL ATTRIBUTE', ['2ac8a95a-a4d0-4bef-a2f2-dcde020258cf']],
        [74, 'FIRST IMPRESSION', ['9f25cc0a-c47c-49dd-953c-8fe60628bae8']],
        [74, 'FOCUSED CONCENTRATION', ['4d5c22b9-4908-493d-a6f7-4ccc3066888c']],
        [74, 'GEARHEAD', ['5c18a150-8e38-4f6d-b4f5-b1b674a3581e']],
        [74, 'GUTS', ['0d0cb0fc-c79d-418e-9216-8a197369e52d']],
        [74, 'HIGH PAIN TOLERANCE', ['b7866fb4-3747-4caf-9240-69cbdd79ce78']],
        [74, 'HOME GROUND', ['823eb204-c155-45a9-bb9a-98dcbe17a707']],
        [75, 'HUMAN-LOOKING', ['2844e64e-f271-4ca7-bd58-0860b2db56c9']],
        [75, 'INDOMITABLE', ['0f3a0971-1cc5-47d6-a32d-d098ecdfb4d9', '58e6a651-cdd7-4144-a2cc-4cee24526e92', 'b9f1dbeb-1728-4250-a066-4773f758fe6a']],
        [75, 'JURYRIGGER', ['27c7ea84-bfe4-47e1-8382-38d9a5c8e680']],
        [76, 'LUCKY', ['78f7456d-78b8-461e-a2b2-bd0d63c48712']],
        [76, 'MAGIC RESISTANCE', ['f80ef6fc-e844-441c-81e3-b1264b34a4e7']],
        [76, 'MENTOR SPIRIT', ['ced3fecf-2277-4b20-b1e0-894162ca9ae2']],
        [76, 'NATURAL ATHLETE', ['225f0d31-8c03-4283-9a22-558ab01a6c47']],
        [76, 'NATURAL HARDENING', ['52648a83-1d2a-4b04-b7fc-ee5a62bce4f7']],
        [76, 'NATURAL IMMUNITY', ['8d558134-210d-4c96-b487-021a44409075', 'ce7634aa-0729-423d-bc38-d6f56416b904']],
        [76, 'PHOTOGRAPHIC MEMORY', ['9d3be1d9-1309-45e7-8bd9-1f5a3ede3522']],
        [77, 'ADDICTION', ['ea7cced4-a201-44a2-9a1b-e10180b1df81', '9a52a300-4d90-4b1f-a113-d0e40a410063', 'b5fa94e6-03fb-4d00-b368-86c318f79c09', '0886bbb3-f5a9-4583-bcea-d6723889c80d']],
        [77, 'QUICK HEALER', ['291efdb6-a8b8-49ce-b2be-72f9d3f8a243']],
        [77, 'RESISTANCE TO PATHOGENS/TOXINS', ['e160111a-5fe3-4154-9d5a-82330c9b32fc', 'c74c9ed8-a917-4809-9e8a-5717dd16619b', '139ca69c-e9d3-4540-a4c6-b8c778e70185', '5c022754-f7cf-479f-80b2-de8454fd76e4']],
        [77, 'SPIRIT AFFINITY', ['c067baa6-0dfa-4783-a0c8-0873564f0308']],
        [77, 'TOUGHNESS', ['00cc6499-db13-447e-8116-278d317a9e31']],
        [77, 'WILL TO LIVE', ['18d2a522-6460-4654-916b-a96631f11323']],
        [78, 'ALLERGY', ['b7841930-0c7b-4be4-b1cf-86debc41aa95', 'f3ad08be-a7a4-4965-bb38-f8db9016c94e', '84a43000-9ae4-4391-b156-d5fbc9a092de', 'cfdc255a-bb46-4d9c-8960-e4181455f4e3', 'e89db285-8db9-4a9c-80cb-94d87b86a80b', '90188ca7-0ccb-4198-b199-dcf33e029d74', 'df14fb6e-456d-4d24-83e8-b1c97576dce2', '8a40007a-9876-4998-a7c9-047248cfbc52']],
        [78, 'ASTRAL BEACON', ['94a09a8d-d582-44f0-9f2c-71f7ba94e767']],
        [79, 'BAD LUCK', ['bc5f41ca-1549-4367-9c12-afa403182f8c']],
        [79, 'BAD REP', ['25356bae-efcc-46c6-9c4f-66909b9b7233']],
        [79, 'CODE OF HONOR', ['dda02333-10e3-4295-9392-691ff3a7bd4a']],
        [80, 'CODEBLOCK', ['86b259fd-17c8-4ae5-b246-49782e7c5047']],
        [80, 'COMBAT PARALYISIS', ['62c7ed8f-b534-41e3-84ac-29534826d476']],
        [80, 'DEPENDENTS', ['2b9a495d-b735-416b-a000-f648c3b4191a', 'cc857826-3bb2-466d-987b-7d56a337bc08', '066a2de9-1717-44ca-a8c6-90366890574a']],
        [80, 'DISTINCTIVE STYLE', ['a030d7e2-755b-4f71-b848-ad9772fba242']],
        [81, 'ELF POSER', ['7036225b-d0f0-4c86-85b7-cc4d46943113']],
        [81, 'GREMLINS', ['de12b672-f60a-486d-85f6-b94a80a058da']],
        [81, 'INCOMPETENT', ['216290b9-053d-4f6d-81c9-d1fe8ae346be']],
        [81, 'INSOMNIA', ['0cf25fda-725b-49fd-a8cf-de589e938065', '149e6bf7-a6b4-4893-b755-4d983372079c']],
        [82, 'LOSS OF CONFIDENCE', ['c9cd05ad-cd3c-451e-8285-e0fb1d95ebc1']],
        [82, 'LOW PAIN TOLERANCE', ['9ba327d2-38c5-4a25-ae44-25e98f0bbf03']],
        [82, 'ORK POSER', ['075447a2-5730-4750-a19f-1a5c6086903d']],
        [82, 'PREJUDICED', ['d6843e67-0837-4353-a5db-f4c320560ddb', '9a76f104-a472-4b6a-b5b7-a8f5248f65a9', '1dc88694-8519-4fb0-b8c9-c5a823084730', 'b0640207-7965-4f1a-a28c-0dd5e24d2d8c', '53ddd66b-ad89-43eb-9174-cbff6ed2a9c3', '100cf04a-51e5-477a-a57c-2dae699f7f04']],
        [83, 'SCORCHED', ['69984296-4057-4a0f-964e-a0efb4bfc7ce']],
        [83, 'SENSITIVE SYSTEM', ['13fd45c3-e031-4452-8bf8-31829d2401f9']],
        [83, 'SIMSENSE VERTIGO', ['b2210e9a-ab8a-45f9-b5db-13f6923c2d22']],
        [84, 'SINNER (LAYERED)', ['e00623e1-54b0-4a91-b234-3c7e141deef4', '9ac85feb-ae1e-4996-8514-3570d411e1d5', '318d2edd-833b-48c5-a3e1-343bf03848a5', 'd9479e5c-d44a-45b9-8fb4-d1e08a9487b2']],
        [85, 'SOCIAL STRESS', ['8ba2830a-3f10-4877-9752-93be051b205b']],
        [85, 'SPIRIT BANE', ['40c06974-a85b-4f2b-9558-51c140c16d87']],
        [85, 'UNCOUTH', ['f0873c37-4f09-41cd-be81-88e8df5b42ae']],
        [87, 'UNEDUCATED', ['d8362a78-54e9-4dbe-8388-6ba0a7b9df31']],
        [87, 'UNSTEADY HANDS', ['e96c7280-b9b0-4112-8b65-a3568c7ca13e']],
        [87, 'WEAK IMMUNE SYSTEM', ['0a7bcb95-dd9c-4e3e-ab0a-291a352ac1d4']],
        [309, 'ASTRAL PERCEPTION', ['9e50dbab-8a5d-430e-83b0-731cce142848']],
        [398, 'MIMICRY', ['59d9baa1-6705-49e8-940b-ea42ffc02692']],
        [400, 'PSYCHOKINESIS', ['8dbc6b92-18a7-4007-b37f-295d21f8ab82']],
    ],
    RG: [
        [127, 'ACROBATIC DEFENDER', ['5150f4f0-5193-4f02-8914-d70e831e3567']],
        [127, 'AGILE DEFENDER (–3 KARMA)', ['1d0c4278-501d-456f-ab63-69afee6fbf95']],
        [127, 'BRAND LOYALTY (–3 KARMA)', ['31108c89-a67c-47d4-a757-db4e22e2f607', '348d7043-7a1c-498f-85eb-3339be9941d1']],
        [127, 'COMBAT JUNKIE (+7 KARMA)', ['8d2b32ec-2ddf-40dd-a29b-bf2e85a3d8ca']],
        [127, 'ONE TRICK PONY (–7 KARMA)', ['98644894-e3a4-41f2-9b7e-91feb74d0334']],
        [127, 'PERCEPTIVE DEFENDER', ['b5f6d958-2563-431b-a7a4-a9028a9f0277']],
        [127, 'SHARPSHOOTER (–4 KARMA)', ['1675810d-0f77-42f9-848a-eaa929cb3a20']],
        [127, 'TOO PRETTY TO HIT (–3 KARMA)', ['0c23861e-36d1-4454-b327-0d8118d02d60']],
        [169, 'BLIGHTED', ['f810fb60-8e1f-4111-a4f3-b652e91693ca', '94cbe9bc-fabc-4126-81f8-3e31c7ed85f8', '6be0022f-f8c8-4c51-808c-d339d3e8fecb']],
        [169, 'EARTHER', ['e7c16580-6705-4a93-a9be-dbea90efd2eb']],
        [169, 'RAD-TOLERANT', ['01bba489-52a2-4a80-845e-61905a970626']],
        [169, 'RADIATION SPONGE', ['da4f7e4a-0e7e-45e6-a872-643bdecb183e']],
        [169, 'SPACER', ['8826405e-a995-4687-b7c8-4e1e51fef3f0']],
    ],
    SG: [
        [84, 'THE TWISTED WAY', ['43be9ef8-d7e9-47fe-ac79-7d15c508a2ad']],
        [131, 'TATTOO MAGIC', ['237EB46A-A012-4E0B-808A-80EDA1C1A586']],
        [176, 'THE ARTISAN’S WAY', ['15b8fbbd-9d6f-43e4-acf3-97badf073ac4']],
        [176, 'THE ARTIST’S WAY', ['a61e2873-fe15-40f5-9ce3-07caa1f824d2']],
        [176, 'THE ATHLETE’S WAY', ['3f536570-2f0c-40b1-a056-d310e29e983d']],
        [176, 'THE BEAST’S WAY', ['2e7424d3-5d11-4c9d-ba92-f0431bb86786']],
        [177, 'THE BURNOUT’S WAY', ['7da60a93-aa53-478c-8d08-18b5638d9b87']],
        [177, 'THE INVISIBLE WAY', ['01181bb0-2a94-43f1-8a97-41347eac3843']],
        [178, 'THE MAGICIAN’S WAY', ['64165b48-d67e-4bb8-b662-ca45fbf5b3c0']],
        [178, 'THE SPEAKER’S WAY', ['88dd98ab-2f09-4ba9-b5c1-ff788c31fbac']],
        [178, 'THE SPIRITUAL WAY', ['1a530492-7036-49fe-9ff1-ff84c9ed5d0a']],
        [178, 'THE WARRIOR’S WAY', ['32d0d753-9dad-4074-ab38-2d1ff5069a6a']],
        [199, 'SPIRIT CHAMPION', ['34d7e834-4fbe-49b1-86e8-a9ff354fd972']],
        [199, 'SPIRIT PARIAH', ['94a4cc04-d856-418f-ac60-165f327433d5']],
    ],
    KC: [
        [76, 'AVRSE', ['8e16f569-a1b1-499c-8046-85d25fb00041']],
        [76, 'DECK BUILDER', ['d85c6437-7611-47d3-b4c7-4e581e5349a4']],
        [76, 'IMPENETRABLE LOGIC', ['7ac54323-a913-4a8e-803e-c6ac2d4ba359']],
        [76, 'ROOTKIT', ['fb8bce41-05ea-48af-a45b-dc80dc392f23']],
        [76, 'SILENCE IS GOLDEN', ['eefe6c28-5d7b-403d-8c24-5bc26536b52b']],
        [77, 'BASEMENT DWELLER', ['19042705-1c57-4973-bf2e-45186ea2b8d5']],
        [77, 'BIG BABY', ['2c3a3f51-53c5-4d47-b991-0c64f31472d3']],
        [77, 'BUDDY SYSTEM', ['6bbeb733-a7cc-4427-924b-8c6174399051']],
        [77, 'DISCOMBOBULATED', ['a3d131f2-5ed9-42d0-86c2-396e50a9117d']],
        [77, 'DOWN THE RABBIT HOLE', ['282c446f-8156-4268-8baa-5d7e732fcd53']],
        [78, 'ECHO CHAMBER', ['1638946e-7e2e-4e57-a7cb-d20f2e4eead1']],
        [78, 'FROSTBITE', ['356eabd2-7d97-46bb-81a1-ac913a670364']],
        [78, 'INFORMATION AUCTIONEER', ['96322f26-94cf-4d2c-9282-6525f9008fec']],
        [79, 'LAZY FINGERS', ['c4dab0b4-32c4-4840-9713-aa46c2412835']],
        [79, 'MALWARE INFECTION', ['f4a052dc-17ca-4bec-a9bf-30e6da80285e']],
        [79, 'MATRIX TROLL', ['ba1644ab-2191-4366-8f5f-13c21eca1cc4']],
        [79, 'SLOPPY CODE', ['5e75a946-b14e-488d-93ea-cd82e648286d']],
        [79, 'WELL, ACTUALLY ...', ['b45b2d09-80d4-4e24-b96c-1e1f3665dee3']],
        [89, 'RESONANT STREAMS', ['d2873478-d265-45bb-8a9f-320b8d0d33d3', 'e3d04705-b90a-4d94-90d0-4ad2c7adfa79']],
        [91, 'SOURCERORS', ['11d6c3b6-47c4-4765-a625-7a5907ba1b4a']],
        [91, 'TECHNOSHAMANS', ['71511c8f-85f1-4e35-aeaa-be8fa3a45331']],
        [96, 'BETTER ON THE NET', ['522dbfb5-5ea0-4707-a7e8-1ac777b3aff7', '39139f84-b8ab-4523-ac02-851350e3f2b6', '25d34c52-6927-44dd-85bd-684e9add1f89', '59436ccc-5e4b-481d-8d63-d3ba912f2d8a']],
        [96, 'BRILLIANT HEURISTICS', ['63fd5450-5f3d-4090-933e-ad0cf39ef0e2']],
        [96, 'FRACTAL PUNCH', ['530062d2-6dbe-4e19-b16a-82953c72745d']],
        [96, 'GROVELER', ['cc967d0f-6b7a-4c62-b202-37f94242169c']],
        [96, 'HOLD THE DOOR', ['ad8d9751-d82f-4d80-b351-c102cd60c2b1']],
        [96, 'LONE WOLF', ['ca9b24ba-3a2e-41cd-8434-b33f91d691aa']],
        [97, 'NATURAL HACKER', ['be396e6b-55f8-46ac-b6d8-866985b3cffd']],
        [97, 'ONE WITH THE MATRIX', ['8bdd4868-191c-4c28-800b-526cb39f7786', '3c83d73e-7aa7-4fe5-8f03-6e983648e2eb', 'b705a89c-219c-432c-ab47-98ff6c975b4a']],
        [97, 'REVERBERANT', ['c80d0f3d-5be7-4d63-8891-ae3bccbfe48f']],
        [97, 'SPRITE AFFINITY', ['eeb4db5b-f5b7-4ab5-b310-1d7107cd722f']],
        [97, 'TEAM PLAYER', ['adf86253-baaf-4c03-87fe-aba3a453b3b5']],
        [97, 'TRUST DATA, NOT LORE', ['0b8c9e67-6767-48d3-b14d-8a9b2024447a']],
        [97, 'TRUST LORE, NOT DATA', ['223bad23-027c-4ea3-ac0b-1ccccace61fe']],
        [98, 'UNIQUE AVATAR', ['ad35c6ec-664c-46a3-8dc5-ac48dfddd0cf']],
        [99, 'BRITTLE [ATTRIBUTE]', ['d40aee6b-80b7-43f5-b335-dabf8f1ad14d', 'cb5bd1e5-b9ef-434f-af17-0e7b4decaa46', '64d430b1-6d6a-4abc-9ef8-3ddaee2352ce', 'a1530804-a35b-4d2f-ae3e-50d647016903']],
        [99, 'CODE OF HONOR: BLACK HAT', ['d3ed1f43-ffd8-4c96-8faf-de8bbf4c3c83']],
        [99, 'DATA HOG', ['7e172644-9b48-4822-8636-b45827ff6938']],
        [99, 'ESCAPED CUSTODY', ['2cafaee0-fb4b-4b56-90e2-8eb864c5a033']],
        [99, 'KNOW YOUR LIMIT', ['57e260d7-7e08-4dae-a3e3-0d174bf61689']],
        [99, 'ON THE WAGON', ['ff939676-0195-4885-ba91-5ee536719b2f']],
        [99, 'RESONANT BURNOUT', ['f6a8d504-db7a-47eb-ace5-604de21c80fd']],
        [99, 'SPRITE COMBUSTION', ['4116d691-86f0-4fb5-bf78-f2059514956a']],
        [100, 'TAINT OF DISSONANCE', ['153dc4b0-199d-4fc7-9b94-b8cf05afdf56']],
        [100, 'WIRED USER', ['102c4f07-f82c-4976-89bd-bcd3b906fb68']],
        [100, '’WARE INTOLERANCE', ['2509cf19-002f-4f24-a52f-f1441dd4d614']],
        [102, 'PARAGONS', ['c5311ee0-8a9b-41b9-857f-28541090968a']],
        [132, 'MORPHINAE', ['580c8ae5-899b-4fa9-8f2d-600c9ac758f9']],
        [133, 'APOPHENIANS', ['e40e318d-ecde-4a20-bfc5-36d341a644b5']],
        [134, 'ERISIANS', ['ee5d131f-5606-4a40-8035-9970aa3b5b29']],
    ],
    R5: [
        [33, 'ACCIDENT PRONE', ['ba27345f-0e68-4660-9b76-2b999c3a4161']],
        [33, 'CHASER', ['ab72b0fb-5a64-4d5e-9e23-2fdf548a7f53']],
        [33, 'DEALER CONNECTION', ['ef6796eb-6559-4f22-bfa6-7e6571a3690d']],
        [33, 'GREASE MONKEY', ['1b40cda8-97e1-40bf-827b-0d38c3ba6dfc']],
        [33, 'MOTION SICKNESS', ['9038578e-6a7c-43d7-ae51-324738a1a9d1']],
        [33, 'SPEED DEMON', ['5bcfc0fc-1e46-4ba9-a48c-7b623e9ab8db']],
        [33, 'STUNT DRIVER', ['fe34b084-2368-4f8d-bb91-689ee22e9380']],
        [33, 'SUBTLE [VEHICLE] PILOT', ['311421e2-a71e-4f06-a15a-9fbc53247376']],
        [34, 'TOO MUCH DATA', ['22c624b8-89f4-4c0d-ab19-c84ca204e2a5']],
    ],
    DT: [
        [44, 'DATA ANOMALY', ['2e3e5050-c77b-4ad8-8f7a-eff1b94b64a0']],
        [44, 'FADE TO BLACK', ['72190f27-8bcf-48c4-bdbd-72bb91aa0dcf']],
        [44, 'GO BIG OR GO HOME', ['64876d0b-bfa6-45df-b8c8-caf6385306c6']],
        [44, 'GOLDEN SCREWDRIVER', ['4e605661-0450-4034-9d3b-11d931c4ce3c']],
        [44, 'I C U', ['ea23db09-759b-4e49-a7e9-34a232ff558d']],
        [44, 'NINJA VANISH', ['ffa26ef9-e2d3-47c2-8fb7-43ad27e85b62']],
        [45, 'ONLINE FAME', ['b016006c-129b-450d-b257-9d49a814cfa7']],
        [45, 'OTAKU TO TECHOMANCER', ['d62880dd-3e28-4b0c-8c71-dc0e4b72397b']],
        [45, 'PAIN IS GAIN', ['d7b36dd1-6703-46a7-b1d6-c9cd379451f1']],
        [45, 'PRIME DATAHAVEN MEMBERSHIP', ['7297d8b0-8bb8-4d7a-ab10-2d4e4381e5d0']],
        [46, 'CODE OF HONOR: LIKE A BOSS', ['233cb57f-6e4d-45dc-b7a9-9bc1e1bf940c']],
        [46, 'CURIOSITY KILLED THE CAT', ['263c4fc6-65b1-4d10-b1aa-5cccaefa26f3']],
        [46, 'DATA LIBERATOR', ['f573305b-944f-490e-94e1-18f8bb7bc590']],
        [46, 'PROFILER', ['ee6703a8-f613-43e0-b2e6-c502af7e82dc']],
        [46, 'QUICK CONFIG', ['7ba73ee6-ab20-4384-9980-b8d4d3e24374']],
        [47, 'DECAYING DISSONANCE', ['b4e94407-9751-4717-a5eb-2b0838d81fa9']],
        [48, 'ELECTRONIC WITNESS', ['565e404b-947f-4027-a2dd-f74f51682c3b']],
        [48, 'FARADAY HIMSELF', ['38a26727-a736-47a9-803f-cfa762c9b8a0']],
        [48, 'LATEST AND GREATEST', ['3a32e8c5-6d02-4360-bac2-221229a68741']],
        [48, 'LEEEEEEEROY JENKINS', ['e138ecce-6fba-4fe6-be09-1d60dc8c3853']],
        [48, 'NERDRAGE', ['b77f30b2-e518-44a9-8a0e-7ef3eddb65cd']],
        [49, 'PRANK WARRIOR', ['a6ca7ad6-49f0-41df-b9cb-1693818a0b3b']],
        [49, 'WANTED BY GOD', ['a82b239b-fa92-45e7-ac87-4adedf72396a']],
        [146, 'CHATTY', ['829568f2-509f-40a3-a16a-a5994ae8a037']],
        [146, 'DESIGNER', ['6c403cb7-791b-4fb1-bb5a-2f95a6859cfe']],
        [147, 'EXCEPTIONAL ENTITY', ['36464D0B-2F7D-439C-8AE1-7678E530FDA1']],
        [147, 'HELLO WORLD!', ['0EE4765D-46D6-4AD9-A3EE-33D6A1167D9A']],
        [147, 'INHERENT PROGRAM', ['36429E96-89FA-4E37-A20A-61A8D35A92AC']],
        [149, 'IMPROVED RESTORATION', ['d6ced15f-2ba7-4a02-bfb7-ddcc0a3e263e']],
        [149, 'LOW PROFILE', ['6a2da674-ba73-4a95-ab3d-e4bbe2eeb926']],
        [149, 'MUNGE', ['d7c75876-dc2d-44c3-bdb4-e898ef733d4e']],
        [150, 'MULTIPROCESSING', ['b86f54af-cca7-4698-ad6d-21ffca93fb23']],
        [150, 'PILOT ORIGINS', ['91a06a6b-7d4a-4b10-9180-18dd3da623ab']],
        [151, 'CORRUPTER', ['40F20232-AD18-4A00-858D-8B1A85A5A71D']],
        [151, 'EASILY EXPLOITABLE', ['73e0a16b-3fac-41a1-9157-cd51625e1843']],
        [151, 'FRAGMENTATION', ['40CEDA2D-B7D1-44C2-80F0-A26EA96DCBE2']],
        [151, 'REDUNDANCY', ['364CDB2A-C405-488C-8E08-631EF02EBCF2']],
        [151, 'SAPPER', ['6DCA4827-142C-4BC1-93AE-16F4F9C47ECA']],
        [151, 'SENSOR UPGRADE', ['5A9EF869-FE86-4877-8D25-5F744C9CD007']],
        [151, 'SNOOPER', ['33BE6D42-8E90-456F-85DE-AFB195747472']],
        [151, 'VIRTUAL STABILITY', ['130F2287-6E27-4A7B-A45C-0313E8ECAD73']],
        [152, 'PERSNICKETY RENTER', ['B65991AF-B962-4641-A5A2-92FC53F30370']],
        [152, 'REAL WORLD NAIVETÉ', ['81224e80-43f1-4b70-8eb5-029540db2f62']],
    ],
    FA: [
        [31, 'ADEPT HEALER', ['dcba5a01-849b-412c-83ba-f0ac5aa46e71']],
        [31, 'ALCHEMICAL ARMORER', ['e508350b-f61d-4878-bd6d-98f8c9e3588b']],
        [31, 'ALCHEMICAL BOMB MAKER', ['73bbf3ca-44c0-4b91-a511-9f1229b4efd3']],
        [31, 'ANIMAL FAMILIAR', ['3e9881c4-6556-4df1-8e9c-bc839ba683b2']],
        [32, 'APT PUPIL', ['79c1be77-1da7-405e-8b2b-99a06abc4327']],
        [32, 'ARCANE BODYGUARD', ['9f02d7f6-6fe3-4a9c-8c0e-83ae788f1985']],
        [32, 'ARCANE IMPROVISER [CHAOS]', ['ec302d7a-1955-43bb-9c1f-2c32da7ca8c0']],
        [32, 'ARCHIVIST', ['f65a7108-0b57-4f82-950d-9896be68aae9']],
        [32, 'ASTRAL BOUNCER', ['f5e31754-4270-43a0-8dbf-528dd7274afb']],
        [32, 'ASTRAL INFILTRATOR', ['0591e06b-4465-47fe-875a-89d4b52d4f61']],
        [33, 'BAREHANDED ADEPT', ['742caf46-a10b-4aa1-a6bc-a53feb99748c']],
        [33, 'BLOOD NECROMANCER', ['3fa061b9-c3bd-40bb-a292-eb35a8f8f5f8']],
        [33, 'CHAIN BREAKER', ['8c49fcfb-54fa-43ce-b2af-51780dabf40f']],
        [34, 'CHAKRA INTERRUPTER', ['56d00933-379d-4442-8878-6db5b08fd20c']],
        [34, 'CHARLATAN', ['6d6356ab-3a88-441a-8368-05a8fb8307a7']],
        [35, 'CHOSEN FOLLOWER', ['578e1220-09f9-41eb-9616-cae4b7c96e56']],
        [35, 'CLOSE COMBAT MAGE', ['507657d6-d882-49f3-b007-9224652c2fa7']],
        [35, 'DARK ALLY', ['39384189-d15a-4f2e-97a9-7f9a0b85ef64']],
        [35, 'DEATH DEALER', ['36e76b70-bf6a-4e66-8dac-13cd529b9274', 'cfc637e9-0071-4313-a25b-b411793f2321']],
        [36, 'DEDICATED CONJURER', ['2a599984-62e4-4110-9784-dc1922df395d']],
        [36, 'DEDICATED SPELLSLINGER', ['bbc6879e-b50d-4862-b85c-a86c5b9e5d67']],
        [36, 'DUAL-NATURED DEFENDER', ['b618c943-41f7-46ae-80e7-69e543bc0ec6']],
        [36, 'DURABLE PREPARATIONS', ['ef1e36f8-6c4c-4908-9155-ecef6c376c6e']],
        [36, 'ELEMENTAL MASTER', ['05089559-972e-463c-a276-641e358a9201']],
        [37, 'FLESH SCULPTER', ['39c97163-ffab-4705-91e1-82aef058cc86']],
        [37, 'HEALER', ['e12f7c66-d0a0-4e93-9454-69024b945220']],
        [37, 'ILLUSIONIST', ['a8a3d83d-034c-4729-ae3e-435fa52b4c4b']],
        [38, 'ITEMS OF POWER', ['8f18e68a-fbaf-46b6-bf00-c99910292c20']],
        [38, 'MAGE HUNTER', ['c6ceed11-802c-4ff6-a636-4213663fcf21', '79ed28ba-fab7-4fc3-b4c1-5c177a92f9a6', '1126c856-7e2e-43de-91ce-8ff70f2368a4']],
        [38, 'MISSILE DEFLECTOR', ['1510e2fd-4821-4e4c-bcd3-eacb0eed5f20']],
        [38, 'MYSTIC FOREMAN', ['39b19ecb-f3a8-488e-a413-f399a1991b55']],
        [38, 'MYSTIC PITCHER', ['f6e65194-8055-484e-8db1-30ef63ec8eef']],
        [39, 'PACIFIST ADEPT', ['727e5ca7-0b64-462f-a3dc-254c451db3a1']],
        [39, 'POTION MAKER', ['9ce70b7b-b0cd-4ec8-87f6-42c3b74faf2a']],
        [39, 'PRACTICED ALCHEMIST [ISLAMIC]', ['bed784d2-33dc-448e-acf6-a682bb286954']],
        [39, 'PUPPET MASTER', ['b9808fa8-744f-46e2-b769-bed5ce0b3ad1']],
        [39, 'RECKLESS SPELL MASTER', ['b15bbc5a-626c-4f04-b08e-203cb24c6b1a']],
        [40, 'RENAISSANCE RITUALIST [CHAOS]', ['baa0cfd8-3c53-48ba-b3b7-61de0bc48695']],
        [40, 'REVENANT ADEPT', ['cd712655-a83b-4905-923d-be07ced1677b']],
        [40, 'SHOCK MAGE', ['820ec42b-5255-4c73-93af-e8caa5b6abbf']],
        [40, 'SKINWALKER [SIOUX]', ['16cb1300-bdf4-42d0-9556-3b681ef517fc']],
        [40, 'SPECTRAL WARDEN', ['25f5745d-8e1d-463f-9b96-c047bc99a587']],
        [40, 'SPELL JAMMER', ['632aebb2-e6f2-4b38-81c7-be494964c614']],
        [40, 'SPIRIT HUNTER', ['7bd24b5c-9ad4-4083-b58b-5dcc420d1950', '3ef898e6-b57d-4254-88d8-b8e37491e186', '80b557bc-c7fd-413f-8b8a-4571c8f3fa56']],
        [41, 'SPIRITUAL LODGE', ['268ea4c4-15af-4b16-8960-a3b34963fe01']],
        [41, 'SPIRITUAL PILGRIM', ['d815700b-9e8a-410b-8795-83196629a5ad']],
        [41, 'SPRAWL TAMER', ['c1145d3c-a9e2-4e91-8f1f-49f69a1f219e']],
        [42, 'STALWART ALLY', ['c9ea31d0-eef7-4489-bc11-04a2e41a4932']],
        [42, 'TABOO TRANSFORMER', ['fcde8bed-ed62-4378-b995-80f96ff423af']],
        [42, 'VEXCRAFT', ['4db55b27-c211-48f2-b9a0-446bd9d32db6']],
        [42, 'WORSHIP LEADER', ['665d2f01-636b-4bde-b91f-47b388a0a57a']],
        [43, 'THE ELEMENTALIST', ['4d5e0fd2-dab3-4de0-9756-096a748bb3cc', 'de428f71-12d1-4c21-98c5-1b3f86da5ba2', 'd426f03d-6a3e-4696-a977-a49fb93be9aa', 'c9c20750-894a-42b8-8119-0e12484698d4']],
        [43, 'THE HEDGE WITCH/WIZARD', ['d03a9696-2341-4894-8cf2-0537c4e74af2']],
        [43, 'THE NULL WIZARD', ['ecb5ab50-68c9-45ee-9fb4-c2f0b3051096']],
        [43, 'THE SEER', ['90691f29-5b81-4a81-9ebc-21f2f5da1d55']],
        // the kinds of aspected magicians (FA 47)
        [47, 'THE APPRENTICE', ['c1d4d7ec-9ebb-4e85-ae72-8155b0f27478']],
        [47, 'THE ENCHANTER', ['a2484390-c4ea-4013-b007-4dc5d3a5c85b']],
        [47, 'THE EXPLORER', ['2f20c108-d724-4684-a642-d40ffe7c51e1']],
        [49, 'THE AWARE', ['dea0e693-05c5-422d-bd1b-f1d1eac9cd30']],
        [132, 'CRYSTAL BREATH', ['c2b4f018-7b14-4e04-aab9-71c891dd0a18']],
        [132, 'CRYSTAL EYE', ['1abbf9a5-af57-4e9f-af7a-05872ae8ddad', '6b669cf8-ef03-49c1-8e42-b16e0daea0bc']],
        [133, 'CRYSTAL GUT', ['82ad9ac5-5ff7-4ea6-9925-a4012af6fe50', '40f0ec08-0948-41dc-b0a2-2804ae913936', '1ca531dc-8d76-42aa-a667-874c94166f0e', 'c3c759fd-4b38-46d9-bccc-64ceb1e0247b', '35e38f80-6054-4f2d-9da7-13dc8e95e923', '3f17850d-5d1c-4dc3-8bb2-09614dd15862', 'aafc734a-91f9-4b40-af9b-5f771e5dcf37', '5d155e0a-b7fa-4047-8a50-43e9616cb354', 'e3613a3d-31c9-40db-a54c-154130ddafe2', '84e80b32-52b7-4fc0-a990-5a74fb5d497c', 'd635f134-3b02-45eb-96d2-e42e100b47cc', '5093e803-da71-4d8c-acb0-22e9ecae3112', '9e390ad1-a8cb-4fbd-a0bb-cf2f3b56dfc1', 'd62eadf5-071e-4270-86c7-d4fb299ff440', '9c8e4825-507f-4683-a477-bf7d895b75b1']],
        [133, 'CRYSTAL JAW', ['11001f88-572a-4818-97fd-e78c8bc8f619']],
        [133, 'CRYSTAL LIMB', ['350844b9-db9f-4cce-83c3-e8965511e928', '834b6e22-5fb3-4a44-a54e-b70729cdb87e']],
        [133, 'CRYSTAL SPINE', ['a054e8a5-f09b-46a6-8c69-5b6b44ddd312']],
        [133, 'CRYSTALLINE BLADE', ['8779458a-5af9-4328-af57-4212eff304bf']],
        [133, 'CRYSTALLINE CLAWS', ['b4e54478-b550-4ee4-a69f-e22944b82b66']],
        [133, 'CRYSTALLINE DIVER', ['256dbeb8-7bb8-4369-8c93-b8b206a859b8']],
        [134, 'CRYSTALLINE GRACE', ['beb709ac-4c40-4b05-9c49-1fe26e4fa2ab']],
        [134, 'CRYSTALLINE REFLEXES', ['9ff65ab9-7a3c-490d-ad73-789999ab60e2']],
        [134, 'CRYSTALLINE SHARDS', ['2169823c-22ab-457d-93f7-a96590ed77ff']],
        [134, 'CRYSTALLINE VISION', ['e24b86ad-004b-4252-8383-3ca4aad53a26']],
        [182, 'THE MENTOR’S MASK', ['bf68095e-35b9-49dc-a008-f67bbac9b83b']],
    ],
    HT: [
        [127, 'SUKUYAN', ['3c746778-bec5-4b9b-a1a4-62ac6eb98342', '735aee59-2236-43e4-b618-9b9923513597']],
        [191, 'BARRENS RAT', ['efd34715-a95c-41d5-ae81-f3b394246448']],
        [191, 'CODE OF HONOR: AVENGING ANGEL', ['86b95cd9-6c29-481e-9f75-cbb4aaf98f03']],
        [191, 'ELEMENTAL FOCUS', ['8b686f85-1ef6-4369-a8ad-31eeb64985e9']],
        [191, 'FACELESS', ['48e7351a-3d47-48d4-a969-cc5943d29da0']],
        [191, 'IMPASSIVE', ['1c356f79-e4c1-4874-aed0-d7796ea35ed4']],
        [191, 'POISONER', ['9410a544-e13e-4de8-b5bf-7bfe316b70ac']],
        [191, 'PRACTICE, PRACTICE, PRACTICE', ['81fc0829-3456-4701-8ecc-f101d145b538']],
    ],
    CA: [
        [150, 'ALIBI', ['e1662684-d100-439b-9719-ba6a9e594e95']],
        [150, 'CLOSER', ['8c3408e1-0161-40a8-88c7-a920437bdb5e']],
        [150, 'CYNIC', ['d11a5ccd-f48b-46ed-89cc-4580a62c63ad']],
        [150, 'EMPATHIC LISTENER', ['919cc565-a5b6-4eda-addb-afa2e293af24']],
        [150, 'GOOD LOOKING AND KNOWS IT', ['42664f89-f8f1-4ccb-bd95-06ef0e451d47']],
        [150, 'GROUPTHINK', ['96ab453c-6a4a-4f53-8553-1b9cf272af72']],
        [151, 'ALPHA JUNKIE', ['74c43bb0-5eef-4100-80b4-f80bd901866a']],
        [151, 'HONEST FACE', ['2c1aff52-95e2-43f5-98ea-c653c66b7ee7']],
        [151, 'INNOCUOUS', ['bf5ea495-0b6d-4ce5-87a8-3de0c43b7be6']],
        [151, 'MASTER DEBATER', ['41416949-62eb-4638-9457-fd7e833cea58']],
        [151, 'MEMORY PALACE', ['f138a414-f318-4404-a0a3-b7aaec022317']],
        [151, 'METHOD ACTOR', ['38bb885a-0cb4-43f2-a3a0-3d46a87455d0']],
        [151, 'MNEMONIC VAULT', ['1ef1c539-9873-4bcb-bbb0-cff114e02375']],
        [151, 'WATCH THE SUIT', ['8e0dd838-dbc4-4e5c-a0f1-e3ade21338a6']],
        [152, 'DESIGNATED OMEGA', ['d9f0f912-fc95-4267-bed2-8d3fcc67846b']],
        [152, 'DISHEVELED', ['1b5acdf3-66ae-4ed7-b5fa-614668721774']],
        [152, 'FAVORED', ['93bdc421-a7c8-44e9-9f6a-9c316638c889', '4de3693d-687e-4d49-a2f9-b9f6bd21aa91', '3fdb7c0d-ddaa-4f70-ae04-1f5a8e4a50c5', '7d8b0ea0-dead-41f9-b409-9e10b9d63728', '9920918e-dfd3-4a19-96b6-59ddebc8b286', '276403f7-ebb9-45dc-bfaf-868ddad16afa']],
        [152, 'ONE BORN EVERY MINUTE', ['85aeb12b-e630-4ea8-87b8-283be9d14234']],
        [152, 'SOCIAL APPEARANCE ANXIETY (SAA)', ['7653cadb-0092-4a94-9a17-9329fb4f6041']],
        [152, 'THE GOAT', ['c41e83a2-1a36-4b97-b286-5fbc6510d3d7']],
        [152, 'UGLY AND DOESN’T CARE', ['106cc6bf-ba42-457e-9451-92ea2da38fbd']],
    ],
    BB: [
        [11, 'GIFTED HEALER', ['a8747e12-08b1-4665-8e48-23c30c047be6']],
        [12, 'AGED', ['97e9b186-8924-4885-a948-3c781244a5cb']],
        [12, 'ILLNESS', ['d537536d-893d-4bd6-89c6-03b7dd5bd24c']],
        [12, 'PREGNANT', ['08cceb0d-4fbe-44c8-97ca-e9ec24b692df']],
    ],
    BTB: [
        [139, 'QUADRIPLEGIC', ['39803e82-d85a-4da1-9637-fdd3249f2f21']],
        [139, 'SOCIAL CHAMELEON', ['a766e0d9-954e-4738-88f2-bde4f4e89880']],
        [160, 'HAIR TRIGGER', ['5c49d5e2-ca52-406e-a532-8d4d148ea825']],
        [160, 'HI-REZ', ['31e3097d-68c4-4140-969d-91bd43612afd']],
        [160, 'INSTINCTIVE HACK', ['ef40cac3-d81e-4c7f-b14d-46abfd2f9dff']],
        [160, 'PROTOTYPE MATERIALS', ['f6387f9d-c177-4c9b-a141-af2d17ea6317']],
        [161, 'ELEMENTAL ATTUNEMENT', ['430af564-0be1-42f0-a0d0-318c093ea3d8']],
        [161, 'RABBLE ROUSER', ['1118c31d-521b-46c3-ba82-04123c1303be']],
        [161, 'RESONANT DISCORDANCE', ['eb3b2334-29f3-4bd5-a9cc-817672b28d6e']],
        [161, 'SHOOT FIRST, DON’T ASK QUESTIONS', ['83e5f9a2-e76b-4a11-81db-4b0466b727ce']],
        [161, 'SPECIAL MODIFICATIONS', ['0dd183a3-85ce-4029-9de5-9b6aa1eb539c', '56815ed4-4093-471a-a0a3-8f5b23675629']],
        [162, 'DEAD SIN', ['c0d411e6-ca88-4011-b56c-9f594882beb4']],
        [162, 'HARD LUCK', ['96f148e1-fb72-416a-8235-89a3eeafe534']],
    ],
    RF: [
        [86, 'RANK', ['c15df7f5-2108-4be2-9500-86045221be0a', '53bd1804-1029-4ebe-9464-a82d91be5dd9', 'fe414583-aa74-4a50-8132-27887ec341d6', '49a9c3a8-538a-4d4e-a4e8-8bf837687d25', '6ccdc691-30cb-40f0-a283-6321703b018f', 'aa9fbb62-1c5c-4c4f-acfd-34880cf61600']],
        [103, 'CREATING A CHANGELING', ['3ea0d4dd-5ed7-4ab0-817f-68d7d67ab3d1', 'bb16aae9-b511-47b2-93c4-217918346cc8', '9baa5b9d-e96c-466d-b0b4-dd789a6c0f83']],
        [111, '360-DEGREE EYESIGHT', ['6509ce7a-a453-4941-9bfa-ec0fe48c6d40']],
        [111, 'ANIMAL PELAGE', ['9b441cbf-538d-4a75-bc7d-b1c9b6be0f9d', '4a381795-b582-4a81-8963-d81027a3986f', 'f46d91ad-8b3c-4bd7-bc5b-85ab7bb36d78']],
        [111, 'ARCANE ARRESTER', ['0355c69a-85b4-48ae-84d6-f6dbf031eae7']],
        [112, 'BALANCE RECEPTOR', ['cdcb6ace-b35e-48bc-8eb0-d7a48626e350']],
        [112, 'BEAK', ['f767c6fa-c316-428b-b15d-f7f96be97fba']],
        [112, 'BICARDIAC', ['f368f4c5-6d8e-4bf0-9567-f6ba8367678f']],
        [112, 'BIOSONAR', ['79c42549-0ebd-48f9-9e1d-1215ab07bd47']],
        [112, 'BROADENED AUDITORY SPECTRUM', ['8c434958-fce8-45d3-88a5-b0f6f8ca58b0', 'bbabf58c-e3b7-49c0-be8f-29f7d8011814']],
        [112, 'BONE SPIKES', ['0c11aefb-2306-43e9-9588-a84a563e9025']],
        [113, 'CAMOUFLAGE', ['cb8ee404-fe6d-4697-9adf-1e41b14355cb']],
        [113, 'CELERITY', ['bd2cf8ea-4eb3-458c-aa04-2de47067f3ad']],
        [113, 'CLAWS', ['7d6e068b-0d9d-47d5-b175-6785b50eeb2b']],
        [113, 'CLIMATE ADAPTATION', ['1d9239a1-0e58-4779-873d-5b8677865806', '850ac6a8-4264-4b7f-bf75-04e1c768b411']],
        [113, 'CORROSIVE SPIT', ['a4a85a3e-c5b6-4613-b299-7726c6918026']],
        [113, 'DERMAL ALTERATION', ['fe67d02c-e9f0-4d8f-9888-adbea2797376', '8a09e5c6-8b0a-4fbb-80dc-42020fac96b5', 'baee0763-4b49-4568-a80b-e1d4682272cd', '64354f78-c8dd-4d3e-9d9f-3fcbe08e6c27', 'bfb6b16b-d2b1-4b28-af37-e011d016da37']],
        [114, 'DEFENSIVE SECRETION', ['de498da5-c141-4ea3-991e-97e73fb551d4']],
        [114, 'DERMAL DEPOSITS', ['72d1d797-4b61-4fbd-97b7-ffb8ea9ddf36']],
        [114, 'ELECTROCEPTION', ['67767d53-56f0-4b66-b7ef-5ff6319ea551', '54c7952d-24b2-489e-9597-3430dfff6207']],
        [114, 'ELONGATED LIMBS', ['5e0aebd7-02a0-4ffd-80f5-56a26d508e2f']],
        [115, 'FANGS', ['27209cc3-756b-4cb2-b6fe-ffec5bd6a072']],
        [115, 'FROG TONGUE', ['ef0e9191-c931-4d41-986f-ed1ad0092a65']],
        [115, 'FUNCTIONAL TAIL', ['07536b3f-ca42-43af-b7eb-ce4e410aaa2e', '92f92e40-f9c3-4d5a-b832-44375088be97', 'c724871b-6ae9-43fe-a0ae-83b0afcd4123', 'c4324d55-2914-4b5c-9586-19f5515da5d7']],
        [115, 'GILLS', ['195f183e-8c42-49cb-bfce-fe84bb9a9964', 'd10f48e4-5587-4ecf-ba8e-f7de16fe6a2a', '1cf04f79-0d0a-4c61-b166-d1c95b78ebfb']],
        [115, 'GLAMOUR', ['35103093-5f41-4d42-a2b5-6fbb64f627b1']],
        [115, 'GORING HORNS', ['556c2599-ae97-44ff-98aa-442af1c9c6d4']],
        [116, 'GREASY SKIN', ['3f96728d-9309-4335-9712-a568b61a8983']],
        [116, 'KEEN-EARED', ['32c427cf-2f0b-4cbc-a1bd-5dc97ba5e9c6']],
        [116, 'LARGER TUSKS', ['9885823f-d80f-45dc-b379-1b3f55cd6aa3']],
        [116, 'LOW-LIGHT VISION', ['2f080d13-92d7-4b16-9ee6-93b5a89206e4', '210401d7-57fa-4260-9517-2725689a509e']],
        [116, 'MAGIC SENSE', ['912bef16-2f72-45e2-95bb-96ef7eea4811']],
        [116, 'MAGNETOCEPTION', ['a22edb75-9b26-4f9f-b61a-26c58197694b']],
        [116, 'MARSUPIAL POUCH', ['51027aca-c1db-470a-afa4-d28cc219152f']],
        [116, 'METAGENIC (ATTRIBUTE) IMPROVEMENT', ['2ffd990c-ced6-4484-955c-108473df5335', '96c4c8e1-2f5d-431c-96c8-db83820f747b', 'c734c06d-c9e4-431d-93ba-033e82444efc', '76ac03f1-b379-48a8-a6e8-d8611fce0adf', 'f1609199-e601-4b69-837f-2029b2ea94f0', '7ee0765f-34f4-43ef-82c0-55c1b8bef8d8', 'bfdffed5-b687-4cb4-ad6a-ac59788fdc8a', 'a6536e32-5f2f-4865-8f6a-d2ba268d4647']],
        [116, 'METAHUMAN TRAITS', ['dc510f9d-0648-474b-8016-11a810ada098']],
        [116, 'MONKEY PAWS', ['9b8a9ecc-295f-4764-b5d8-0a3fb317d9b8']],
        [117, 'NASTY VIBE', ['f3f8c1c4-a222-4f9d-a89d-b8a25fde0dad']],
        [117, 'NATURAL VENOM', ['05113ce9-0255-4753-b467-569564f6a60d', '280af894-df4f-451c-874d-71c4b3db1580', '0d416e3e-2f90-4a33-8277-d58af5e42de5', '3a627958-3dc8-4db9-8672-3c4f343f484b', '51d327e7-e5f7-4972-a9f8-836bb555f53d', 'c5552f98-af9d-413e-ba81-4d42dc9d0770', 'a31a80cb-d05b-40ff-849e-37d2d9856225', '19901576-8376-439a-9070-0a2df09c6baf', '827a22bc-43ea-4f17-bf81-f68e289ea623', 'be99a6f3-e1f2-4abe-afae-34a7dadb0b8f', '4d6208c5-5b00-440c-a720-20f41d54410c', '2291b5e9-ebec-4a8f-96ae-e2539501ba72']],
        [117, 'OGRE STOMACH', ['b3fce27e-d762-4eaa-9cb6-c62cfb2fbccf']],
        [117, 'PHOTOMETABOLISM', ['5ce51789-1ed2-446a-8aff-5f7f70969507']],
        [117, 'PROBOSCIS', ['493450e1-b88b-441b-b7ee-bdecf5a99d2d']],
        [118, 'SATYR LEGS', ['5451c3da-b08c-4a63-899f-afb62bd50a57']],
        [118, 'SETAE', ['3e80d1e0-ae6a-4059-8a49-ae97547b3384']],
        [118, 'SHIVA ARMS', ['51ba5e67-f2fd-4149-b24c-9b502ed0e7c7']],
        [118, 'THERMAL SENSITIVITY', ['9b205e4a-66c7-45d9-b87b-d0c743944d60']],
        [118, 'THERMOGRAPHIC VISION', ['fd346177-3791-44c0-af8c-7cf176fc9aa3']],
        [118, 'THORNS', ['c16ecaf5-e57f-4aae-8ef9-b7df84626ac5']],
        [118, 'UNDERWATER VISION', ['4390735f-54fa-44a5-bce7-d23a67427f25']],
        [118, 'VOMERONASAL ORGAN', ['6dae7800-8634-44e3-9aca-f5a18eb06b45']],
        [119, 'ADIPOSIS', ['db002182-a3c4-4c77-a615-7a878d227871']],
        [119, 'ASTRAL HAZING', ['8236f10b-345c-44f5-b0b1-648004f24d3f']],
        [119, 'BERSERKER', ['95ba1f65-34c0-4f6e-9440-40e860278342']],
        [119, 'BIOLUMINESCENCE', ['96b4cfc7-ddf6-4828-8393-7625b0564bd1']],
        [119, 'WEBBED DIGITS', ['059f4399-f3c4-40b0-a975-d7e29a2e412b']],
        [120, 'CEPHALOPOD SKULL', ['8b0eb8a7-fc44-4452-bfd6-db8ee531bc0d']],
        [120, 'COLD-BLOODED', ['006409d3-cc04-4195-8569-b81d73ccb1a2']],
        [120, 'CRITTER SPOOK', ['bf416ac2-75b2-4907-8b15-1447784b5851']],
        [120, 'CYCLOPEAN EYE', ['acd06d4f-7f09-4d80-8bab-006b680392a2']],
        [120, 'DEFORMITY', ['ddc04b8e-b0f7-485d-9ab7-dee1110133fd', '5c067c2c-435e-40c8-ab76-e4ffe6a4f884']],
        [120, 'FEATHERS', ['35279341-3611-439a-9550-8227b306198f']],
        [120, 'IMPAIRED (ATTRIBUTE)', ['96911a4d-d82e-4a1e-a550-3e12b8e14a7b', '8a1a04ff-5bff-48b2-90c2-b9bdb5fde8e8', '959b00a6-a55b-4c6b-95b0-a9746b31a24d', 'c00591dc-fe6d-4ff0-8e42-22000878f03f', '14e71856-7d38-4e04-933f-069ed89a14e9', 'b58b47a7-9011-4bef-8ba2-ae561a443765', '0df94dda-5941-4130-b6fc-0a98fcf7f846', 'a6a4d71d-452f-4d26-9588-e7a5bc2474c0']],
        [121, 'INSECTOID FEATURES', ['7618be2b-b4c1-4f7c-905b-7698cc2e744e']],
        [121, 'MOOD HAIR', ['0ece5812-aa89-484b-b899-f02ac961a417']],
        [121, 'NEOTENY', ['9135118a-1085-4e31-9682-014c8b40c888']],
        [121, 'NOCTURNAL', ['b0887f45-c0b1-4a5c-bd17-d73450287621']],
        [121, 'PROGERIA', ['856622a9-b28c-4ac7-8707-812a51fecf7a']],
        [121, 'SCALES', ['873d8045-853f-4797-9f08-1a1eac388af0']],
        [121, 'SCENT GLANDS', ['b0152c5a-b959-43f2-825e-801e5ac07466']],
        [122, 'SLOW HEALER', ['b8b300d4-cf20-4652-8feb-2528030c6271']],
        [122, 'STRIKING SKIN PIGMENTATION', ['c57c9407-7ac6-4061-abab-7735c8bd69b4']],
        [122, 'STUBBY ARMS', ['73ded55c-3f96-4efa-bd03-cd9bdebeb303']],
        [122, 'SYMBIOSIS', ['33a1a0ed-20b8-4ddd-9070-2b460a5455b7']],
        [122, 'THIRD EYE', ['dba6c764-3851-4d8e-97ce-344f45c8d771']],
        [122, 'UNUSUAL HAIR', ['69a61e8c-238e-4ef9-8847-6271ed260a62']],
        [123, 'VESTIGIAL TAIL', ['4e35cd80-5a2e-431b-aafc-5a39a9e17f38']],
        [136, 'BANDERSNATCH', ['65026e10-6fa5-49a4-9da6-d9575b5b9cde']],
        [136, 'BANSHEE', ['0a3f2c4f-efdc-422f-91bf-07baf2229bc6']],
        [136, 'INFECTED OPTIONAL POWERS', ['f466b913-5df0-4370-abf0-fad4ab380d19', '62d59650-f889-4599-9700-60829d50887e', 'ae0312ad-acb2-4ae8-974e-99af82e81211', '3ec5c096-322a-4342-a4fb-4c2ffda565f7', 'c0e9082b-4930-4f0a-8d84-090878a28a7b', '11f49fab-be66-4679-bc23-b08cf5742cac', '0baaaa57-d738-448e-8f0f-cdb96357c4ef', '28d06111-33e6-4260-a4f3-bca94d3b5afa', 'd5de8180-d8b7-48ab-8a1d-878f1c2736af', 'a85e0a7e-cfb5-4b51-8eb5-f2775cba303a', 'b0460fde-7bf8-4e77-b402-6fe7143aa590', 'ad81bcdf-2f45-4ca3-ab46-c766fd734800', 'e3ed1dec-9e91-4dbf-ac5c-30bd6d9900a4', '630fd84e-553d-4faf-a271-9148b717d226', '7843087c-30a3-4d87-aaa2-5ebdb90cccd8', '6d9f205e-52a0-4bb2-a4c2-e49232dd8346', '311ebb96-bf65-483e-86b7-62702a43aae3']],
        [137, 'DZOO-NOO-QUA', ['6556d48f-2cbd-4bc6-a2c8-e9fe3f99ac7e']],
        [138, 'GHOUL', ['ed801fa4-0514-458a-b850-9eeddf0c2fed', 'e156dc45-66ca-4b45-baf8-5c875b9866c4', '2d99bbb6-7af0-45c6-a83b-46d9d9f10838', 'ea7c269f-6843-488a-b0fa-8f79c935f568', '8325c7f3-c578-458a-9068-e159b2c686ef', '92123580-1f4f-4c6a-b2f5-3b9c9031d705']],
        [138, 'GNAWER', ['5f31925d-cc76-49da-acab-644b66d5e93d']],
        [138, 'GOBLIN', ['ae5e7ba4-5b9e-40f9-8ace-66f19c6e11eb']],
        [139, 'GRENDEL', ['ba87adfa-6c7e-4c9b-bf13-b6576b59bd1f']],
        [139, 'HARVESTER', ['8e3d558a-b69a-4176-a130-1ec3465aa809']],
        [139, 'LOUP-GAROU', ['fe0c2ae0-fc0f-40fe-9bae-1c3ad5c7e29a']],
        [139, 'MUTAQUA', ['818bfd22-7dec-4e50-8189-7fed09fbcfed']],
        [139, 'NOSFERATU', ['39a8e176-ddbf-470e-84a0-ba25ccd92ca0']],
        [140, 'VAMPIRE', ['7d0a1679-846a-4cf2-b8b5-b5c686766a90', '4024b100-c762-4354-95e4-db5cb0694a9a']],
        [140, 'WENDIGO', ['652948f9-e629-4dea-bd13-776dd41ca6a1']],
        [141, 'CARRIER', ['8fa3b253-1e6f-439d-940e-f48a1d8959c8', '3fc02bdc-1f3f-448c-8e8c-d1869ac4fcfc']],
        [145, 'ADRENALINE SURGE', ['f446f88c-26aa-496a-aa78-ed478bf0875f']],
        [145, 'ANIMAL EMPATHY', ['94b64f4d-ef99-460a-a9e8-86c4e14f9159']],
        [145, 'BLACK MARKET PIPELINE', ['a68a897e-412f-4659-a637-4848f39a9c90']],
        [145, 'BORN RICH', ['8f232e71-d4bf-4bea-b1b2-b88c7e652073']],
        [145, 'CITY SLICKER', ['2714ba2c-9297-4f15-ab41-9b4ed3169eaf']],
        [145, 'COLLEGE EDUCATION', ['604aea10-3f13-4f28-a87b-25b8bf677276']],
        [145, 'COMMON SENSE', ['cf3a62e1-8a41-413e-a679-30c8d1b5a0c1']],
        [146, 'DAREDEVIL', ['d5eaa4c0-7f7c-4eb2-a708-bed460914d0a']],
        [146, 'DIGITAL DOPPELGANGER', ['75c24a3e-f5f9-47e4-947f-e461bac0e82f']],
        [146, 'DISGRACED', ['e30d8c76-968d-4f05-9635-5cb18ca43836']],
        [146, 'ERASED', ['07f1833e-e5e0-41e1-91de-9044b2f48367']],
        [146, 'FAME', ['51e9e615-e3ba-4b25-b7b0-ffa8acf076f8', 'b6334a9c-4c68-4db5-918e-59e1d91c46fd', 'e8b81024-b6cc-42cf-b56e-664bc01993ea', 'd43aca8d-a304-4060-86c7-81ac62fc8df0']],
        [147, 'FRIENDS IN HIGH PLACES', ['e07fc29c-55cc-46b3-af56-3b1de76f0a89']],
        [147, 'HAWK EYE', ['f356d63f-1782-4952-aca2-bc04e2cd6c60']],
        [147, 'INSPIRED', ['f8f216b5-1c29-467d-9fb5-c9812408203d']],
        [147, 'JACK OF ALL TRADES, MASTER OF NONE', ['624fa943-c0a1-44ee-8cd8-3aef4bea3f4b']],
        [148, 'LIGHTNING REFLEXES', ['3564b678-7721-4a8d-ac79-1600cf92dc14']],
        [148, 'LINGUIST', ['d6c7389c-d6cf-42b1-b3f2-3466d5a5d485']],
        [148, 'MADE MAN', ['45be40cc-a21a-4771-b47d-a532ea60b205']],
        [148, 'NIGHT VISION', ['7a468691-1362-439a-a096-76da6933b24c']],
        [148, 'OUTDOORSMAN', ['055e66f2-b530-4664-a143-0c0544e0baee']],
        [148, 'OVERCLOCKER', ['554ca59c-22e6-46ef-9b05-250ec8abd728']],
        [148, 'PERCEPTIVE', ['1bad26cf-9d67-4bb1-9b4f-e9c80d668651']],
        [148, 'PERFECT TIME', ['fd78fa11-5ab6-40db-bdb8-9fd722b08054']],
        [148, 'POOR LINK', ['9567f663-b56e-4038-9e15-78c963171fc6']],
        [149, 'PRIVILEGED FAMILY NAME', ['e518d74e-9e63-42fe-be47-2e37c461d21b']],
        [149, 'RESTRICTED GEAR', ['ce939b04-5fc6-49e9-a747-9c9d1254449e']],
        [149, 'SCHOOL OF HARD KNOCKS', ['f15c06f4-d413-4fee-a8de-b1089340fcd7']],
        [149, 'SENSE OF DIRECTION', ['3030bfc9-5551-4ef9-bf3c-badef9c27472']],
        [149, 'SENSEI', ['dc7a0c59-5f9c-4ba9-8b63-aaf442472673']],
        [149, 'SOLID/LEGENDARY REP', ['16f138ec-2a6a-4cc3-a5a9-3c12b0fb9689', 'da834cdb-bb3f-4866-a7f6-755d9d17c62b']],
        [149, 'SPEED READING', ['c0f1c43c-7e50-4a84-ad0d-a0bc28f77836']],
        [150, 'SPIKE RESISTANCE', ['60972204-7dc5-4882-be7d-781f533dabef']],
        [150, 'SPIRIT WHISPERER', ['af460f42-c0d2-4f7d-8b80-8e71d19b5aac']],
        [150, 'STEELY EYED WHEELMAN', ['3fd458df-fd47-4c62-9235-1af27eed2928']],
        [150, 'TECHNICAL SCHOOL EDUCATION', ['56ef3346-1182-4326-961a-6a9edb0d171f']],
        [150, 'TOUGH AS NAILS', ['3deeaa50-96d3-4c21-8f09-b9c224af5de3', '798c8081-d7a8-4c11-8d6f-80fb12a48062']],
        [151, 'ALBINISM', ['cb3afab7-03ab-400f-bb67-5a854b24418b', '30eb56ed-b154-4748-a11f-415f03392113']],
        [151, 'TRUST FUND', ['2656bcd7-3fe1-4c34-a4fb-89ebebfbf016', '36d761de-b423-4610-b8e4-026e7e78a3bf', 'e03653d0-6c53-4835-a3f6-baa0908d53c9', '79835078-5e76-4431-902f-02fdc4990ac9']],
        [151, 'TRUSTWORTHY', ['0334f054-7d44-443c-a14b-372ba86ff03f']],
        [151, 'VEHICLE EMPATHY', ['c23bc3b5-dd6b-41ee-90b1-6a4e08e3767f']],
        [151, 'WATER SPRITE', ['57cd5ee6-236c-4625-a59e-56c7f15130ab']],
        [151, 'WITNESS MY HATE', ['f8af38e2-e79a-44f9-8e72-57aba35b7056']],
        [152, 'AMNESIA', ['1209249d-4600-46a7-833c-87d14f719b5e', '1f03322a-ef16-4495-9bdb-824006c41aad']],
        [152, 'ASTHMA', ['84d4acee-d58a-43dc-bea7-90cb133fbc76']],
        [152, 'BI-POLAR', ['e7148da6-022b-4d54-b888-60719265e7f1']],
        [153, 'BIG REGRET', ['5c5dd94f-8ad2-4fb2-bbe6-26d18e0da436']],
        [153, 'BLIND', ['81f51f6b-672f-477b-b84a-10b602d714e0']],
        [153, 'BORROWED TIME', ['56ed0031-cf9b-427c-978f-0a766ac2181d']],
        [153, 'COMPUTER ILLITERATE', ['bdb17940-1bb5-4d6e-925f-019cfa8090af']],
        [153, 'CREATURE OF COMFORT', ['cf66af29-b4ff-4931-bc0b-5c5b6006e978', 'd63f2467-1b76-4f7b-adef-bfced240109e', 'bf0f580e-ca90-40e7-8ca1-018bacad9bbc']],
        [154, 'DAY JOB', ['8fc3e769-ea71-41e1-968c-600d507cdf94', '4294e480-4299-41e5-9336-50a98ec14bbf', '12b6f08b-5513-4dfd-840d-fd43595d15b8']],
        [154, 'DEAF', ['fc31eb53-28a3-46cb-af10-982fca829e34']],
        [154, 'DID YOU JUST CALL ME DUMB?', ['8bca877e-42e5-4ff7-92ec-4c83f4cadb86']],
        [154, 'DIMMER BULB', ['7706ce23-77c2-470f-bb7e-6a4e56fa78fe']],
        [154, 'DRIVEN', ['4d435a24-f8f9-456d-83c1-6fecb217cf67']],
        [154, 'EMOTIONAL ATTACHMENT', ['fae6e95c-f71b-47e5-8cb4-696f2af2bf22']],
        [155, 'EX-CON', ['4fe8fa5e-e31b-4126-a880-3e719a0a5820']],
        [155, 'FLASHBACKS', ['9056baa6-ed79-4f28-a199-36093d99555f', '41d447d7-5ea0-45f9-8b9d-16b5c9ec8937']],
        [155, 'HOBO WITH A SHOTGUN', ['b86cdb32-7c3a-404b-94c1-cafe8ccad060']],
        [155, 'HUNG OUT TO DRY', ['6a0a61f0-4b14-410e-9c3c-4c88a4592277']],
        [155, 'ILLITERATE', ['df4cfe8b-3394-4ac8-b5c8-fda04701de17']],
        [156, 'IN DEBT', ['2b4dd1b1-b806-44e3-9067-65dc39c82d13']],
        [156, 'INCOMPLETE DEPROGRAMMING', ['43cab487-f5f7-4fc1-bc61-c011c3aa3a67']],
        [156, 'INFIRM', ['34ed73cb-28a3-43e1-a2bc-addbe2ccbbd3']],
        [156, 'LIAR', ['bf50a6c9-f165-451c-8d38-89240f39bb44']],
        [156, 'NIGHT BLINDNESS', ['dab93ad4-bc28-4f67-a3f7-209ba893c7fb']],
        [157, 'OBLIVIOUS', ['136cb6e9-0353-4324-9671-1ee176c5aeef', '26fe2c36-f6cc-4f97-ae1b-5d5eb3be2315']],
        [157, 'PACIFIST', ['3b2624fe-1d4d-47ba-a663-3ca21323f28c', 'ab5142e6-c8d7-4035-86da-dcdcc2fa46cc']],
        [157, 'PARANOIA', ['4e2763ca-e042-4cad-996b-1b472c5426ca']],
        [157, 'PARAPLEGIC', ['dca0897f-532a-43ab-8796-4ef761e829af']],
        [157, 'PHOBIA', ['3659b016-5511-4cdb-a9f3-ce2ecfba4513', '255ba2d3-6fbd-4b89-8131-c10f96e70d32', 'e929cc4a-0973-4c55-9ca9-a925b0d7d463', 'ff42593b-e1da-406e-aa10-cd90ef2629f5', '1c293ee1-c2e3-4e82-9ee6-91425955f250', '10b0e391-6cb4-46ba-a357-570ffa2eba69']],
        [158, 'PIE IESU DOMINE. DONA EIS REQUIEM.', ['eeb2ed52-dd4a-4961-83e2-d707530ed193']],
        [158, 'POOR SELF CONTROL', ['5adbea9d-7b48-4bc9-9941-31df54b02804', '9f5ba6ba-c18e-49a4-8043-2dc5e7900b0c', '9d11f7df-c783-4bcb-8970-3473379bcf9d', '6406fb36-187e-486e-8dd0-1ddf6f1b3dbe', '882c7cbc-2a0a-4465-ac2e-7ae8af98c928', 'd194fce3-8b1b-4ad8-a2be-87dbdd1c0569', 'beb59507-23bc-4b21-97d9-a3256d505774', '03c2f009-825b-4464-abd1-1d27d5ce905e', '5792c584-c1e0-4231-9cdf-e6ef27ce2539', 'f7ca837e-3691-4b49-8ef2-5f2ddbe53c1e', 'e73e2f0a-3bba-42d7-9351-d68255ce3f3a', 'cd39499d-ec05-44ec-b13f-fc66e11f686c', '3039da6f-ad92-4082-bcf1-f2b400323679', '68399920-e3ff-4d17-a69a-0265c57422ab', '62de8226-b9a9-4065-9e82-b9ac4d4d027a', '83e2a9b7-e06e-494e-95d3-c6e554d9928e']],
        [158, 'RECORDS ON FILE', ['ce01db25-465b-4d13-b091-055496f3a5c4']],
        [159, 'REDUCED (SENSE)', ['1ae3ce29-5249-4477-952a-6074a212e197', '4d3a1151-0bc3-4858-98e1-fe930cd98425', '2699e390-edd6-45fc-9e87-6c584e864490', 'c70262ae-6137-4c2a-82c7-b38c6debb367', '82b00ac1-06c0-4566-ad51-69bba96efc6f', 'cd42abaf-348c-41e9-ac9d-fbf9e2946b86']],
        [159, 'SENSORY OVERLOAD SYNDROME', ['04b68abc-0f9d-4fe9-8b41-82d7b9c95e2e']],
        [159, 'SIGNATURE', ['3e255d71-c126-40a6-a6f6-44bd17d019e4']],
        [159, 'VENDETTA', ['34965554-9252-4b37-b40b-c904e8034d03']],
        [159, 'WANTED', ['1e3d8aff-c31c-41f9-8c62-e3332cac79fa']],
    ],
    CF: [
        [54, 'BETTER TO BE FEARED THAN LOVED', ['32a4d207-a67b-4cdb-a0c8-731320f85ffc']],
        [54, 'BIOCOMPATIBILITY', ['23bfa65d-9241-4183-b7ea-0e2935e42f29', 'dcecd7e5-8cf1-4f83-89fa-177e28cfba03']],
        [54, 'CYBER SINGULARITY SEEKER', ['b47319f5-372d-4e23-9fd9-a8e4aecd4c85']],
        [54, 'DRUG TOLERANT', ['00c827f6-aaa7-4003-87c9-f14e36263252']],
        [54, 'PROTOTYPE TRANSHUMAN', ['08c4dfad-3661-48d9-a265-43cce84e20d8']],
        [55, 'REDLINER', ['38deea18-76f0-49a3-95ba-50006e4e7f90']],
        [56, 'REVELS IN MURDER', ['999fd139-d2c7-42ba-8ff8-cd9cbe65711c']],
        [56, 'UNCANNY HEALER', ['0ebdfce5-c613-4fd9-9763-cae2d21c2153']],
        [57, 'AIPS', ['b8f8799f-b89b-462e-9e8c-e47cdd965587']],
        [57, 'ANTIPATHY', ['b9afa9de-39c0-4e49-8271-f76910352ec2']],
        [57, 'BLANK SLATE', ['af6974ba-43fe-4a6e-97f7-82df2bbb97f9']],
        [57, 'CYBER-SNOB', ['aaac8dfd-dee6-4277-b967-9ec9089260a7']],
        [57, 'CYBERPSYCHOSIS', ['01cd8471-224e-4ffe-9d89-79f565d78e29']],
        [57, 'DEAD EMOTION', ['425fbcac-53a5-4788-a80c-0dc788e883b0']],
        [57, 'DRY ADDICT', ['cd75169e-efa4-40aa-a4c8-ee055a5dd748', 'f1026e12-7605-4454-acba-fbcf0b8b59f3', '78106262-f5a7-4d17-984c-ccb7765a51e0', 'af760e11-1d73-40f2-bbf0-ac6a73d05d39']],
        [58, 'FAMILY CURSE', ['00ae8fce-15aa-4a7f-90e3-9336824a626e']],
        [58, 'IMPLANT-INDUCED IMMUNE DEFICIENCY', ['37129686-fe48-4374-acca-7b06d1373db0']],
        [58, 'LACK OF FOCUS', ['06078d89-0f12-4f57-99d0-e088847dec7e']],
        [58, 'LIGHTWEIGHT', ['8e176d15-e646-4aed-824c-171c6bd9e4bc']],
        [58, 'ONE OF THEM', ['d398b3ec-93b1-4229-906a-49d7136045cb']],
        [58, 'POOR SELF CONTROL', ['4765ff9e-90f4-4783-b0cc-826419fafade', 'f5fada49-7344-4e0d-b2d8-61aead583d7b']],
        [59, 'QUASIMODO', ['bd64ccab-5138-475d-8eb1-400ae4a11ac2']],
        [59, 'SO JACKED UP', ['21c98d92-0a8b-454b-8623-b99480f3a518']],
        [59, 'SUPERHUMAN PSYCHOSIS', ['6b9c009f-613b-4d3f-82c6-53e191c4e095']],
        [59, 'TLE-X', ['262bb242-69eb-41fc-b751-e6fdeac3f071']],
        [60, 'TOUGH AND TARGETED', ['815f235c-dda7-4140-a667-c274ced1d9d6']],
        [157, 'GENETIC OPTIMIZATION', ['3109f474-0d10-4c75-bc07-ef22afdd92ab', 'c42cc305-3d7a-4c68-9ce7-32e1fc628505', '8c667328-eba0-4dc7-be5a-19c285997f10', 'a6b946e2-7e58-4607-b9ce-7b27055c9562', '7022143c-3d58-4ad7-9cdb-dab007f75f54', '22a991a5-e8b1-4ca7-98b9-3181df5dbf7e', '62035d8e-c784-450e-9b03-501281a6771a', '96ae02da-5824-4ebd-a0c5-65bb5b43fd48']],
        [158, 'PHENOTYPIC VARIATION', ['0d5e6819-ac41-4700-ac7d-58fa957b328c', '13edde6a-f920-4665-9e65-53a20b30c2a3', 'eac42e74-2f7b-418d-bd38-c1cdd56ceec4', 'f0bd7ebc-8b59-4586-b83a-d884540a7651', 'e89ddeca-1de4-410e-916f-205aeaee6ea2', 'b17b895e-6819-4609-91e6-9ce42d0446a9', '89564979-72ca-4e73-9923-0ce088da0227']],
    ],
    DTR: [
        [163, 'WILDCARD CHIMERA', ['b0321887-df33-49d9-9d2e-e718eca9c7a0']],
        [164, 'IT WORKS IF YOU WORK IT', ['b3373640-35cc-4a29-b2b0-6ded9acd8d4b']],
        [164, 'METAVIRAL ATTUNEMENT', ['94702bfe-ec3e-4b57-ba3e-8c45f214e9f1']],
        [164, 'SOUL SWALLOWER', ['254c19fc-0a5b-4f75-a6d9-614f885e3d19']],
    ],
    SL: [
        [126, 'CORPORATE LOYALIST', ['21e19949-5481-47a6-939b-d3522ba3a7c8']],
        [126, 'LOCATION ATTUNEMENT', ['07916773-5aa2-4c8b-b239-932a9359428a', '257afab2-b281-4e27-b6d2-1b02b409637a', '3619084e-9c13-48d0-b985-0d15aa9d885a']],
        [127, 'CORPORATE PARIAH', ['0d1d5e5d-5a11-4dff-9776-3cf088ab8ea7', '7bce4053-611b-4b58-8e1d-fc9dde20fd9f']],
        [127, 'NATURAL LEADER', ['52d00c91-76d5-4b06-b475-f49637ea9763']],
        [127, 'OBSERVANT', ['e9a11971-48a2-4c9a-89b4-16c844e197ba']],
        [127, 'STAY OUT OF MY WAY', ['e4956c8e-119f-4670-9dcf-30f4709863ae']],
        [127, 'THIS IS YOUR LAST CHANCE', ['a3c1f52d-edee-4927-899f-18265e75de1c']],
        [181, 'BATTLE HARDENED', ['8d9cc4fa-ce95-423a-8db8-724372903b3d']],
        [181, 'EVERY MAN FOR HIMSELF', ['bb0cd874-a7bb-4863-b393-23ef0eda6313']],
        [181, 'NO MAN LEFT BEHIND', ['7b051d98-e95b-48f9-8fbb-dae69a739913']],
        [181, 'THOUSAND-YARD STARE', ['0f9a0d45-a3c5-454d-8581-a5a1804e522e']],
    ],
    TCT: [
        [188, 'BLACK FOREST NATIVE', ['f9b746ae-9112-4b84-ba8d-e0a852678a20']],
        [188, 'COMMUNITY CONNECTION', ['397eee55-11eb-4ede-bede-a8a13befa21c']],
        [188, 'DELICATE FINGERS', ['fd5468e4-a671-4c84-a9ec-590b94ae6ae3']],
        [188, 'HUMAN LIFESPAN', ['9ad4e8e7-80d7-4941-96d5-9a1aaa1bd4c9']],
        [188, 'NASTY TROG', ['3a5b909e-7b37-471d-a24a-3fda7c18d837']],
        [188, 'TROG ARTISAN', ['8d8dee2e-868b-4eda-87b5-959dd55304e0']],
        [188, 'TROG HISTORIAN', ['94d14ec2-7bcf-4728-8ff6-ef315da4c80c']],
        [188, 'TROG LEADER', ['ac24ddb3-5e35-486c-a899-5b1bd11e9d86']],
        [189, 'BAD CREDIT', ['e4bceac5-8f1d-4090-90fc-ad5e94bca8d7']],
        [189, 'ELEVATED STRESS', ['0b28f554-8929-4b8b-b8c6-4203ca856b33']],
        [189, 'FORCE OF CHAOS', ['13379299-27a2-4b5d-8938-6a54f49dc861']],
        [189, 'TROG NETWORKER', ['14b5b9c0-5180-47ec-8bf9-f422d3196744']],
        [189, 'TROG TRAITOR', ['ca4459b7-ea68-4b6c-9754-8bdcf3f4aef7']],
    ],
    HS: [
        // a dracoform by its drake (how it looks)
        [163, 'EASTERN DRAKE', ['3a8006d6-72c2-4655-9200-45ec21cad760']],
        [163, 'WESTERN DRAKE', ['f257ce85-fc27-4fa1-8d34-6eb4102e7614']],
        [163, 'FEATHERED DRAKE', ['90a7cc01-ee0f-4d60-aeb9-05752e68ddf9']],
        [163, 'SEA DRAKE', ['c284e172-1d20-4844-b24c-e094d2588b72']],
        [164, 'LATENT DRACOMORPHOSIS (5 KARMA)', ['e132257f-14d8-4e5a-9f20-ae6af29649d5']],
    ],
    AP: [
        [16, 'DEUS VULT! (COST: 4 KARMA)', ['fb9eab85-ae9a-4d03-8c3f-70b6a32d5e17']],
        [17, 'CONSUMMATE PROFESSIONAL', ['c6a2aa0f-76fd-432b-85bb-3ef2c2857525']],
        [17, 'OUT FOR MYSELF', ['3e175d5e-3935-4273-ac08-7e99fecd7fae']],
        [17, 'STRIVE FOR PERFECTION', ['03d5c621-7883-492e-988b-5aafdebc855d']],
        [17, 'MY COUNTRY, RIGHT OR WRONG', ['204d2317-77cd-448c-9506-091269d1e58a']],
    ],
    NF: [
        [177, 'CANDLE IN THE DARKNESS', ['7d1bedb9-5d27-419f-bc15-0a39d9b67516']],
        [177, 'MASSIVE NETWORK', ['f8384574-ce99-4e33-8a94-b5aea7ddf4bd']],
        [177, 'NETWORKER', ['fc195df5-83f6-4aff-aca8-4287a56e4d4c']],
        [177, 'STOLEN GEAR', ['8b18a3aa-fd5a-4712-8dd4-117d7a73ba11']],
    ],
    SASS: [
        [31, 'COLLEGE EDUCATION', ['4e2ddf3d-802f-4206-85ce-81f1defa528f']],
        [31, 'INSPIRED', ['fd9b9b6d-c969-40f1-8dc7-61f8e5d9cd4d']],
    ],
};
const QUALITY_SECTIONS: Record<string, RulebookSection> = Object.fromEntries((Object.entries(QUALITY_HEADINGS) as [BookCode, [number, string, string[]][]][])
    .flatMap(([book, entries]) => entries.map(([page, heading]): [string, RulebookSection] => [`${book}:${headingKey(heading)}`, { book, page, heading }])));
const QUALITY_BY_CHUMMER_ID: Record<string, string> = Object.fromEntries((Object.entries(QUALITY_HEADINGS) as [BookCode, [number, string, string[]][]][])
    .flatMap(([book, entries]) => entries.flatMap(([, heading, ids]) => ids.map(id => [id, `${book}:${headingKey(heading)}`]))));

/** The keys a quality's name may have its entry under: the name, without its kind in brackets or its level (Trust Fund II). */
const qualityNameKeys = (name: string) => {
    const bare = name.replace(/\s*\([^)]*\)$/, '');
    return [...new Set([name, bare, bare.replace(/\s+(I{1,3}|IV|V)$/, ''), bare.replace(/^[^:]+:\s+/, '')].map(headingKey))];
};
const QUALITY_LOOKUP: ItemLookup = {
    sections: QUALITY_SECTIONS, byChummerId: QUALITY_BY_CHUMMER_ID, aliases: {}, nameKeys: qualityNameKeys,
    source: item => (item.system as { description?: { source?: string } }).description?.source ?? '',
};

/** The words of a heading or a name for the page fallback (entryKey): capitals, no brackets, no small words. */
const SMALL_WORDS = new Set(['OF', 'THE', 'A', 'AN', 'ON', 'IN', 'OR', 'AND', 'TO', 'FOR', 'V']);
const headingWords = (text: string) => headingKey(text).replace(/\s*\([^)]*\)/g, ' ').split(/[^A-Z0-9']+/)
    .filter(word => word.length > 1 && !SMALL_WORDS.has(word));

/** What the import offers, in the order of its window; `checked` is the box's state when the window opens. */
export const RULEBOOK_CATEGORIES = {
    attributes: {
        label: 'SR5.Redesign.Rulebook.Category.Attributes',
        checked: false,
        sections: ATTRIBUTE_SECTIONS,
    },
    skills: {
        label: 'SR5.Redesign.Rulebook.Category.Skills',
        checked: true,
        sections: Object.fromEntries(Object.entries(SKILL_PAGES).map(([name, page]) => [name, { book: 'SR5' as const, page, heading: name.toUpperCase() }])),
    },
    actions: {
        label: 'SR5.Redesign.Rulebook.Category.Actions',
        checked: true,
        sections: ACTION_SECTIONS,
    },
    // entries with a stat block (Type, Range, Damage, Duration, Drain) and, in the Core rulebook, a text shared by the
    // spells of a group (Acid Stream and Toxic Wave): the text is the one after the group's blocks
    spells: {
        label: 'SR5.Redesign.Rulebook.Category.Spells',
        checked: true,
        sections: SPELL_SECTIONS,
        statBlocks: true,
    },
    // the cost and activation lines under the heading are left out (in capitals in Street Grimoire: "COST: 0.5 PP PER
    // LEVEL"), as the item has its power points and activation
    powers: {
        label: 'SR5.Redesign.Rulebook.Category.Powers',
        checked: true,
        sections: POWERS.sections,
        costLines: true,
    },
    // a stat block under the heading (Target, Duration, FV), as the spells'
    complexForms: {
        label: 'SR5.Redesign.Rulebook.Category.ComplexForms',
        checked: true,
        sections: COMPLEX_FORMS.sections,
        statBlocks: true,
    },
    // the activation and prerequisite lines under a heading are left out, as the adept powers' cost lines
    metamagics: {
        label: 'SR5.Redesign.Rulebook.Category.Metamagics',
        checked: true,
        sections: METAMAGICS.sections,
        costLines: true,
    },
    echoes: {
        label: 'SR5.Redesign.Rulebook.Category.Echoes',
        checked: true,
        sections: ECHOES.sections,
    },
    // positive and negative qualities in one: under the heading their cost line ("COST: 5 KARMA", "BONUS: 3, 6, OR 9
    // KARMA"), left out, as the item has its karma; many have long texts with lists of their kinds (Code of Honor,
    // Allergy, SINner), so their passages may be longer
    qualities: {
        label: 'SR5.Redesign.Rulebook.Category.Qualities',
        checked: true,
        sections: QUALITY_SECTIONS,
        costLines: true,
        maxLength: 3000,
    },
} satisfies Record<string, { label: string; checked: boolean; sections: Record<string, RulebookSection>; statBlocks?: boolean; costLines?: boolean; maxLength?: number }>;
export type RulebookCategory = keyof typeof RULEBOOK_CATEGORIES;

/**
 * What the import keeps in the world's settings, which every client loads when it joins: per category the file of each
 * book it came from, whether the cards show it, where each section was found, and the entry of the world compendium
 * holding its text (`journal`). The text itself is in that compendium (PACK_NAME), one journal entry per category, read
 * when a sheet first needs it. Imports before there were more books kept one file (`file`) and no book: the Core
 * rulebook; imports before the compendium kept the text here too (`text`), which the GM's client moves (migrate).
 */
type RulebookStore = Partial<Record<RulebookCategory, {
    files?: Partial<Record<BookCode, string>>; file?: string; importedAt: string; enabled: boolean; journal?: string;
    sections: Record<string, { book?: BookCode; page: number; text?: string }>;
}>>;

const NAMESPACE = 'sr5-redesign';
const STORE_KEY = 'rulebookText';
/** The world compendium of the imported text (JournalEntry), readable by the players: their sheets show it too. */
const PACK_NAME = 'sr5-redesign-rulebook';
const PACK_ID = `world.${PACK_NAME}`;
/**
 * A section ends at the next heading: a line in capitals (MENTAL ATTRIBUTES, CLUBS, PICK UP/PUT DOWN OBJECT, 52 BLOCKS,
 * [SENSE] REMOVAL, (CRITTER) FORM...), not a bracket of capitals alone (a spell's kind under its heading)
 */
const HEADING = /^(?!\([^a-z]*\)$)(?=.*[A-Z]{2})[A-Z0-9[(][A-Z0-9 ()&,'’/:.+!?[\]-]{3,}$/;
/** A spell's stat lines under its heading (Type: P, Range: LOS, Damage: P, Duration: I, Drain: F – 3). */
const STAT_LINE = /^(Type|Range|Damage|Duration|Drain|DV|Threshold|Target|FV):/i;
/** A skill entry's own lines after its text (Default: Yes, Skill Group, Specializations): the section ends there. */
const ENTRY_FOOTER = 'Default:';
/**
 * A bracket on the line under a heading: a skill's linked attribute ("(LOGIC)"), an action's kind ("(COMPLEX ACTION)"),
 * a ritual's keywords with its kind after them ("(MINION) RITUAL").
 */
const BRACKET_LINE = /^\([^a-z]+\)( [A-Z]+)?$/;
/** A heading over more lines: the next one goes on with it ("FIRE LONG BURST" / "OR SEMI-AUTO BURST"). */
const continues = (line: string, next: string) => /[,/&-]$/.test(line) || /^(OR|AND|&) /.test(next);
/** Running heads and folios at the page's edges (">> SHADOWRUN CONCEPTS <<", "<< Your Character 51") */
const PAGE_FURNITURE = /(^>>.*<<$)|(^<<.*\d+$)|(^\d+\s.*>>$)/;
/**
 * A running head or folio pdf.js put on a line of text: "taken>> FORBIDDEN ARCANA << Physical", ">> STREET GRIMOIRE < <",
 * "<< SHADOW SPELLS >> 17", "MASTERING THE MATRIX >>178".
 */
const INLINE_FURNITURE = /\s*(?:>\s*>\s*[A-Z0-9][A-Z0-9 &’',.:-]*<\s*<|<\s*<\s*[A-Z0-9][A-Z0-9 &’',.:-]*>\s*>)\s*\d*\s*|\s*\b[A-Z][A-Z &’',.:-]{3,}>\s*>\s*\d+\s*|\s*\d+\s*<\s*<\s*[A-Z][A-Z &’',.:-]{3,}\b\s*/g;
/** The longest passage kept (a category may keep longer ones: maxLength), cut at a sentence. */
const MAX_LENGTH = 1500;

let store: RulebookStore = {};
/** The text of each category as read from the compendium, and the reads under way. */
const texts: Partial<Record<RulebookCategory, Record<string, string>>> = {};
const loading = new Map<RulebookCategory, Promise<void>>();

type JournalPack = CompendiumCollection<'JournalEntry'>;
const pack = () => game.packs.get(PACK_ID) as JournalPack | undefined;
/** The compendium, made on the first import (GM only); players may read it. */
async function ensurePack(): Promise<JournalPack> {
    const existing = pack();
    if (existing) return existing;
    const create = (foundry.documents.collections.CompendiumCollection as unknown as {
        createCompendium(metadata: object): Promise<JournalPack>;
    }).createCompendium;
    return create.call(foundry.documents.collections.CompendiumCollection, {
        type: 'JournalEntry',
        name: PACK_NAME,
        label: game.i18n.localize('SR5.Redesign.Rulebook.PackLabel'),
        ownership: { PLAYER: 'OBSERVER', TRUSTED: 'OBSERVER', ASSISTANT: 'OWNER' },
    });
}
/** Keeps a category's text in its journal entry (made when it has none yet); returns the entry's id. */
async function writeTexts(category: RulebookCategory, sections: Record<string, string>, journal?: string): Promise<string> {
    const target = await ensurePack();
    const flags = { [NAMESPACE]: { category, texts: sections } };
    const existing = journal ? await target.getDocument(journal) : null;
    if (existing) {
        // the whole map replaced, not merged: sections of books imported again or left out go
        await existing.update({ [`flags.${NAMESPACE}.-=texts`]: null } as never);
        await existing.update({ flags } as never);
        return existing.id!;
    }
    const name = game.i18n.localize(RULEBOOK_CATEGORIES[category].label);
    const [created] = await JournalEntry.createDocuments([{ name, flags } as never], { pack: PACK_ID });
    return created.id!;
}
/** Reads a category's text, once per client: one the cards show, or (`always`) one hidden, for an import to keep it. */
function loadCategory(category: RulebookCategory, always = false): Promise<void> {
    const entry = store[category];
    if (!entry || (!entry.enabled && !always) || texts[category] || !entry.journal) return Promise.resolve();
    const running = loading.get(category);
    if (running) return running;
    const read = (async () => {
        const doc = await pack()?.getDocument(entry.journal!);
        // the compendium or its entry deleted: no text, the sections' pages still link (an import makes them again)
        if (!doc) console.warn(`SR5 Redesign | the rulebook text of ${category} is gone (compendium ${PACK_ID}, entry ${entry.journal}); import the books again to bring it back`);
        texts[category] = (doc?.getFlag(NAMESPACE as never, 'texts' as never) ?? {}) as Record<string, string>;
    })().catch(error => { console.error('SR5 Redesign | rulebook text could not be read', error); texts[category] = {}; })
        .finally(() => loading.delete(category));
    loading.set(category, read);
    return read;
}
const redrawSheets = () => {
    for (const app of foundry.applications.instances.values()) {
        if (app.rendered && app.element?.classList.contains('sr5-redesign')) void app.render();
    }
};
/**
 * Imports before the compendium kept their text in the setting: the GM's client moves it to the compendium and
 * leaves the setting with where each section is, so no client loads the text when it joins any more.
 */
async function migrate() {
    if (!game.user?.isGM) return;
    const next: RulebookStore = { ...store };
    let moved = false;
    for (const category of Object.keys(store) as RulebookCategory[]) {
        const entry = store[category];
        if (!entry || !Object.values(entry.sections).some(section => section.text !== undefined)) continue;
        const sections = Object.fromEntries(Object.entries(entry.sections).map(([key, section]) => [key, section.text ?? '']));
        const journal = await writeTexts(category, sections, entry.journal);
        next[category] = { ...entry, journal, sections: Object.fromEntries(Object.entries(entry.sections).map(([key, { book, page }]) => [key, { book, page }])) };
        moved = true;
    }
    if (moved) await save(next);
}

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
const settings = () => game.settings as unknown as {
    register(namespace: string, key: string, config: object): void;
    registerMenu(namespace: string, key: string, config: object): void;
    get(namespace: string, key: string): unknown;
    set(namespace: string, key: string, value: unknown): Promise<unknown>;
};
const save = async (next: RulebookStore) => {
    await settings().set(NAMESPACE, STORE_KEY, next);
    store = next;
};

/** The pdf.js Foundry serves for its PDF journal pages, loaded on first use. */
type PdfPage = { getTextContent(): Promise<{ items: { str?: string; hasEOL?: boolean; height?: number }[] }>; cleanup(): void };
/** A line of a page: its text and the size of its type (body text, a heading, a table's cells set apart by it). */
interface PdfLine { text: string; size: number }
type PdfDocument = { numPages: number; getPage(n: number): Promise<PdfPage>; destroy(): Promise<void> };
type PdfJs = { getDocument(source: { data: ArrayBuffer }): { promise: Promise<PdfDocument> }; GlobalWorkerOptions: { workerSrc: string } };
async function loadPdfJs(): Promise<PdfJs> {
    const url = foundry.utils.getRoute('scripts/pdfjs/build/pdf.mjs');
    const pdfjs = await import(/* webpackIgnore: true */ url) as PdfJs;
    pdfjs.GlobalWorkerOptions.workerSrc = foundry.utils.getRoute('scripts/pdfjs/build/pdf.worker.mjs');
    return pdfjs;
}

/** A page's text as lines (spaces evened out) with their type's size (its first word's), the running heads left out. */
async function pageLines(pdf: PdfDocument, n: number, cache: Map<number, PdfLine[]>): Promise<PdfLine[]> {
    if (n < 1 || n > pdf.numPages) return [];
    const cached = cache.get(n);
    if (cached) return cached;
    const page = await pdf.getPage(n);
    const lines: PdfLine[] = [];
    let line = '';
    let size = 0;
    for (const item of (await page.getTextContent()).items) {
        if (item.str === undefined) continue;
        if (!size && item.str.trim()) size = Math.round((item.height ?? 0) * 10) / 10;
        line += item.str;
        if (item.hasEOL) { lines.push({ text: line.replace(/\s+/g, ' ').trim(), size }); line = ''; size = 0; }
    }
    if (line.trim()) lines.push({ text: line.replace(/\s+/g, ' ').trim(), size });
    page.cleanup();
    const kept = lines.filter(({ text }) => text && !PAGE_FURNITURE.test(text))
        .map(({ text, size }) => ({ text: text.replace(INLINE_FURNITURE, ' ').trim(), size })).filter(({ text }) => text);
    cache.set(n, kept);
    return kept;
}

/**
 * The lines of an entry's own fields (an action's marks, its test, an IC's attack; the kind of a Run & Gun action:
 * "Simple Action/Simple Action/Complex Action", "Interrupt Action (–5 Initiative Score)"): each one a line of its own.
 */
const FIELD_LINE = /^(Marks Required|Test|Attack|Limit|Duration|Type|Range):|^((Free|Simple|Complex|Interrupt|Variable) Action( \([^)]*\))?\/?)+$/i;
/**
 * A quality's cost line in small letters (Run Faster's infected: "Cost: 29 Karma"), an adept power's cost and activation
 * (Cutting Aces gives the power points alone: "0.25 PP per level").
 */
const COST_LINE = /^\(?(Cost|Bonus|Activation)\s*:|^\d*\.?\d+\s*PP\b/i;
/** A list's mark at a line's start, as pdf.js gives it. */
const BULLET = /^[•●▪◦∙]\s*/;
/**
 * Lines into paragraphs: a line-end hyphen joins the word again ("Es-" + "sence"), other line ends become spaces; an
 * entry's field lines (Marks Required:, Test:) are paragraphs of their own, the text after them too (from the first
 * line that starts a sentence: "You can use...", "Binder IC corrupts..."; "Processing" goes on with the field), split by "\n".
 */
const joinLines = (lines: string[]) => {
    let text = '';
    let inField = false;
    for (const line of lines) {
        const field = FIELD_LINE.test(line);
        // a list's item starts a paragraph of its own (the kinds of Code of Honor, an Allergy's severities)
        if (text && BULLET.test(line)) { text += `\n${line.replace(BULLET, '• ')}`; continue; }
        if (text && (field || inField && /^[A-Z][\w’'-]*(\s+[A-Z][\w’'-]*){0,2}\s+[a-z]/.test(line))) text += `\n${line}`;
        else if (!text) text = line;
        else text = /[a-z]-$/.test(text) && /^[a-z]/.test(line) ? text.slice(0, -1) + line : `${text} ${line}`;
        if (field) inField = true;
        else if (inField && text.endsWith(`\n${line}`)) inField = false;
    }
    return text;
};

/** The lines of the next entry of a group (its heading, over up to three lines) when its bracket or stats follow. */
const groupHead = (lines: string[]) => {
    let count = 0;
    while (count < 3 && count < lines.length && HEADING.test(lines[count])) count++;
    return count && count < lines.length && (/^\([^)]*\)$/.test(lines[count]) || STAT_LINE.test(lines[count])) ? count : 0;
};

/** A passage that goes on longer, cut at the last sentence that fits (a paragraph's end too). */
const clip = (text: string, max = MAX_LENGTH) => {
    const head = text.slice(0, max);
    const end = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'));
    return `${(end > 0 ? head.slice(0, end + 1) : head).trim()} …`;
};

/** Two sizes of type the same, give or take the rounding. */
const sameSize = (a: number, b: number) => Math.abs(a - b) < 0.3;

/**
 * A paragraph that starts with its entry's name (Core's metamagics and echoes: "Centering: A magician who...", "Power
 * Point (Adepts Only): If you're an adept...").
 */
const RUN_IN = /^([A-Z][A-Za-z0-9'’\-[\] ]{1,40}?(?: \([^)]*\))?):\s+(?=\S)/;

/**
 * A section whose name starts its first paragraph instead of a heading of its own (its table's heading ends in ":",
 * "CENTERING:", and no heading of that name is found): the text after the name, up to the next paragraph that starts with a name the same way (after a line
 * that ends a sentence), a heading or a change of the type's size, on the next page too. A sidebar set into a sentence
 * (Flexible Signature, SR5 325) is stepped over, as in findSection.
 */
async function findRunIn(pdf: PdfDocument, section: RulebookSection, cache: Map<number, PdfLine[]>, maxLength: number) {
    const wanted = headingKey(section.heading);
    for (let offset = 0; offset <= MAX_OFFSET; offset++) {
        const pdfPage = section.page + offset;
        const lines = await pageLines(pdf, pdfPage, cache);
        const at = lines.findIndex(({ text }) => { const name = RUN_IN.exec(text)?.[1]; return !!name && headingKey(name) === wanted; });
        if (at < 0) continue;
        const { text: first, size } = lines[at];
        const body = [first.slice(RUN_IN.exec(first)![0].length)];
        let full = false;
        let inset = false;
        const ended = () => /[.!?:)”"’]$/.test(body[body.length - 1]);
        for (const { text, size: lineSize } of [...lines.slice(at + 1), ...await pageLines(pdf, pdfPage + 1, cache)]) {
            if (HEADING.test(text) || text.startsWith(ENTRY_FOOTER)) {
                if (ended()) break;
                inset = true;
                continue;
            }
            if (!sameSize(lineSize, size)) continue;
            // in a sidebar: the sentence goes on at the line in the text's own size that does not start a new one
            if (inset) {
                if (!/^[a-z]/.test(text)) break;
                inset = false;
            }
            if (RUN_IN.test(text) && ended()) break;
            body.push(text);
            if (joinLines(body).length > maxLength) { full = true; break; }
        }
        const text = full ? clip(joinLines(body), maxLength) : joinLines(body);
        if (text) return { book: section.book, page: section.page, text };
    }
    return null;
}

/**
 * One section: the heading on the printed page (searched over the possible offsets; a heading may take up to three
 * lines), its text up to the next heading. `statBlocks`: the entry's stat lines and the next entries of its group
 * (their headings, brackets and stats) come before its text and are left out. The text is the lines in the size of
 * its first one: a table's cells, a caption or a sidebar in another size are not the entry's. A heading in another
 * size than the entry's own in the middle of a sentence is a table or sidebar set into the text (Door Wards, SG 129):
 * the text goes on after it, on the next page too.
 */
async function findSection(pdf: PdfDocument, section: RulebookSection, cache: Map<number, PdfLine[]>,
    { statBlocks = false, costLines = false, maxLength = MAX_LENGTH } = {}) {
    const wanted = headingKey(section.heading);
    for (let offset = 0; offset <= MAX_OFFSET; offset++) {
        const pdfPage = section.page + offset;
        const pageLinesOf = await pageLines(pdf, pdfPage, cache);
        const lines = pageLinesOf.map(line => line.text);
        let end = -1;
        for (let at = 0; at < lines.length && end < 0; at++) {
            for (let count = 1; count <= 3 && at + count <= lines.length; count++) {
                if (count > 1 && !HEADING.test(lines[at + count - 1])) break;
                // a heading has no small letters: a line in a list or a table of the same words is not it (Flux, SG 151)
                if (/[a-z]/.test(lines[at])) break;
                if (headingKey(lines.slice(at, at + count).join(' ')) === wanted) { end = at + count; break; }
            }
        }
        if (end < 0) continue;
        let headingSize = pageLinesOf[end - 1].size;
        // the section may go on over the page
        const following = [...pageLinesOf.slice(end), ...await pageLines(pdf, pdfPage + 1, cache)];
        const first = () => following[0]?.text ?? '';
        // what goes with the heading: the rest of it, a bracket under it (over two lines too: "(COMPLEX ACTION/INTERRUPT"
        // / "[–5 INITIATIVE SCORE])")
        let previous = lines[end - 1];
        for (;;) {
            const close = /^\([^a-z)]*$/.test(first()) ? following.slice(1, 3).findIndex(line => /^[^a-z]*\)$/.test(line.text)) : -1;
            const bracketEnd = close >= 0 ? close + 2 : 0;
            const group = statBlocks ? groupHead(following.slice(0, 4).map(line => line.text)) : 0;
            // the heading again, in the entry's own size under a larger one (Advanced Alchemy, SG 155)
            if (following.length && headingKey(first()) === wanted) headingSize = following.shift()!.size;
            else if (bracketEnd) following.splice(0, bracketEnd);
            else if (following.length && (BRACKET_LINE.test(first()) || (HEADING.test(first()) && continues(previous, first())))) previous = following.shift()!.text;
            // a spell's kind may be in small letters ("(Blood, Direct, Elemental)")
            else if (statBlocks && (STAT_LINE.test(first()) || /^\([^)]*\)$/.test(first()))) following.shift();
            else if (group) following.splice(0, group);
            // a quality's cost (in capitals, over two lines too: "COST: 3 KARMA PER" / "RATING (MAX RATING 3)")
            else if (costLines && following.length && (!/[a-z]/.test(first()) || COST_LINE.test(first()))) following.shift();
            else break;
        }
        const bodySize = following[0]?.size ?? 0;
        const body: string[] = [];
        // in a table or sidebar set into the text: everything in it is stepped over, its own headings too (Homunculus,
        // SR5 300: its sidebar has a HOMUNCULUS of its own), up to the line of text that carries the sentence on
        let inset = false;
        let full = false;
        for (const { text, size } of following) {
            // a line in capitals in the size of the entry's own heading is the next one's, however short or what it
            // holds ("TAG", "AGILE DEFENDER (–3 KARMA)")
            const heading = HEADING.test(text) || text.startsWith(ENTRY_FOOTER) || (sameSize(size, headingSize) && /^(?=.*[A-Z]{2})[^a-z]+$/.test(text));
            if (inset) {
                if (heading || !sameSize(size, bodySize)) continue;
                // a paragraph of text that does not go on with the sentence is another entry's
                if (!/^[a-z]/.test(text)) break;
                inset = false;
            } else if (heading) {
                const unfinished = body.length > 0 && !/[.!?:)”"’]$/.test(body[body.length - 1]);
                if (unfinished && !sameSize(size, headingSize) && !text.startsWith(ENTRY_FOOTER)) { inset = true; continue; }
                break;
            } else if (!sameSize(size, bodySize)) continue;
            body.push(text);
            // measured on the joined text (its words joined again over the line ends), as it is cut
            if (joinLines(body).length > maxLength) { full = true; break; }
        }
        const text = full ? clip(joinLines(body), maxLength) : joinLines(body);
        if (text) return { book: section.book, page: section.page, text };
    }
    // no heading of its own: a heading ending in ":" may be the name its paragraph starts with (findRunIn)
    return section.heading.endsWith(':') ? findRunIn(pdf, section, cache, maxLength) : null;
}

/**
 * The key of an item's entry: by its Chummer id when Chummer's import brought it (the same on every language and after
 * a rename); else in the book of its source, by its name (an item without a source looks in every book). Failing that
 * (an item renamed, "My Brute Force"), an entry on its source's own page whose heading's words are all in its name, or
 * its name's in the heading, when exactly one is: an entry is shown only where it is sure. Empty when there is none.
 */
function entryKey(item: SR5Item, lookup: ItemLookup): string {
    const flags = (item.system as { importFlags?: { name?: string; sourceid?: string } | null }).importFlags;
    const byId = flags?.sourceid ? lookup.byChummerId[flags.sourceid] : undefined;
    if (byId) return byId;
    const name = flags?.name || item.name;
    if (lookup.aliases[name]) return lookup.aliases[name];
    const source = /^([A-Z0-9]+)\s+(\d+)/.exec(lookup.source(item));
    const books = source ? [source[1]] : Object.keys(BOOKS);
    const keys = lookup.nameKeys(name);
    for (const code of books) {
        const key = keys.map(each => `${code}:${each}`).find(each => lookup.sections[each]);
        if (key) return key;
    }
    if (!source) return '';
    const page = Number(source[2]);
    const named = new Set(headingWords(name.replace(/\s+v\.\s.*$/, '')));
    const onPage = Object.entries(lookup.sections).filter(([, section]) => section.book === source[1] && section.page === page)
        .filter(([, section]) => {
            const heading = headingWords(section.heading);
            return heading.length && named.size && (heading.every(word => named.has(word)) || [...named].every(word => heading.includes(word)));
        });
    return onPage.length === 1 ? onPage[0][0] : '';
}

export const RedesignRulebook = {
    register() {
        settings().register(NAMESPACE, STORE_KEY, {
            scope: 'world',
            config: false,
            type: Object,
            default: {},
            // the open redesigned sheets draw again: their rows' source links and opened texts come from the store; a
            // category imported again (or removed) is read again from the compendium
            onChange: (value: unknown) => {
                const before = store;
                store = (value ?? {}) as RulebookStore;
                for (const category of Object.keys(RULEBOOK_CATEGORIES) as RulebookCategory[]) {
                    if (before[category]?.importedAt !== store[category]?.importedAt || before[category]?.journal !== store[category]?.journal) delete texts[category];
                }
                redrawSheets();
            },
        });
        settings().registerMenu(NAMESPACE, 'rulebookImport', {
            name: 'SR5.Redesign.Rulebook.MenuName',
            label: 'SR5.Redesign.Rulebook.MenuLabel',
            hint: 'SR5.Redesign.Rulebook.MenuHint',
            icon: 'fas fa-book-open',
            type: RulebookImportApp,
            restricted: true,
        });
        Hooks.once('ready', () => {
            store = (settings().get(NAMESPACE, STORE_KEY) ?? {}) as RulebookStore;
            void migrate();
        });
    },

    /**
     * Reads the text of every category the cards show from the compendium (once per client; a sheet awaits it before
     * it draws, so its rows and cards have the text at once).
     */
    async load() {
        await Promise.all((Object.keys(store) as RulebookCategory[]).map(category => loadCategory(category)));
    },

    /** The card's passage from the user's rulebook, as markup for the card's description; empty when there is none to show. */
    excerpt(category: RulebookCategory, key: string): string {
        const entry = store[category];
        const found = entry?.enabled ? entry.sections[key] : undefined;
        if (!found) return '';
        const text = texts[category]?.[key] ?? found.text;
        if (text === undefined) {
            // not read yet (a card outside a sheet that loaded it): read now, the sheets draw again with it. Read
            // already (its entry or the compendium gone) or nothing to read: none. Read again, the redraw came back
            // here, read again at once and drew again, a loop that froze the page
            if (!texts[category] && entry!.journal) void loadCategory(category).then(redrawSheets);
            return '';
        }
        // the passage alone: its page is the card's or row's source link (source() below), as an item's
        return `<div class="sr-rich-book">${text.split('\n').map(paragraph => `<p>${escape(paragraph)}</p>`).join('')}</div>`;
    },

    /**
     * A row's or card's own description (the player's or GM's text, a card's own words) with the passage of the user's
     * rulebook under it. After a description of its own a label names the book the passage is from (its page is the
     * row's or card's source link already); a passage alone needs none. A description of bare text gets its paragraph, so
     * the label keeps its step under it.
     */
    withPassage(own: string, category: RulebookCategory, key: string): string {
        const excerpt = RedesignRulebook.excerpt(category, key);
        if (!excerpt) return own;
        const text = own.trim();
        if (!text.replace(/<[^>]+>/g, '').trim()) return excerpt;
        const book = (/^([A-Z0-9]+)\s/.exec(RedesignRulebook.source(category, key))?.[1] ?? 'SR5') as BookCode;
        const from = game.i18n.format('SR5.Redesign.Rulebook.FromBook', { book: BOOKS[book]?.title ?? book });
        const label = `<div class="sr-rich-book-label"><i class="fas fa-book-open" aria-hidden="true"></i><span>${escape(from)}</span></div>`;
        return `${text.startsWith('<') ? text : `<p>${text}</p>`}${label}${excerpt}`;
    },

    /** The page of the card's passage as a source ("SR5 130") for its source link; empty when there is none to show. */
    source(category: RulebookCategory, key: string): string {
        const entry = store[category];
        const found = entry?.enabled ? entry.sections[key] : undefined;
        return found ? `${found.book ?? 'SR5'} ${found.page}` : '';
    },

    /** The key of an action's entry (category actions), see entryKey. */
    actionKey: (item: SR5Item) => entryKey(item, ACTION_LOOKUP),

    /** The key of a spell's or ritual's entry (category spells), see entryKey. */
    spellKey: (item: SR5Item) => entryKey(item, SPELL_LOOKUP),

    /** The key of a quality's entry (category qualities), see entryKey. */
    qualityKey: (item: SR5Item) => entryKey(item, QUALITY_LOOKUP),

    /** The category and key of an item's entry: actions, spells, rituals, qualities, powers, forms, metamagics, echoes. */
    itemEntry(item: SR5Item): { category: RulebookCategory; key: string } | null {
        if (item.type === 'action') return { category: 'actions', key: RedesignRulebook.actionKey(item) };
        // rituals are items of their own; Chummer keeps them with the spells (spells.xml, category Rituals)
        if (item.type === 'spell' || item.type === 'ritual') return { category: 'spells', key: RedesignRulebook.spellKey(item) };
        if (item.type === 'quality') return { category: 'qualities', key: RedesignRulebook.qualityKey(item) };
        if (item.type === 'adept_power') return { category: 'powers', key: entryKey(item, POWER_LOOKUP) };
        if (item.type === 'complex_form') return { category: 'complexForms', key: entryKey(item, COMPLEX_FORM_LOOKUP) };
        if (item.type === 'metamagic') return { category: 'metamagics', key: entryKey(item, METAMAGIC_LOOKUP) };
        if (item.type === 'echo') return { category: 'echoes', key: entryKey(item, ECHO_LOOKUP) };
        return null;
    },

    /** An item's own description with its entry under it (withPassage); the description alone for any other item. */
    itemPassage(item: SR5Item, own: string): string {
        const entry = RedesignRulebook.itemEntry(item);
        return entry ? RedesignRulebook.withPassage(own, entry.category, entry.key) : own;
    },

    /**
     * The books the categories' sections are in, the ones with the most sections first (Core and Run Faster on top, a
     * book of two or three entries at the end); books of as many in the order of BOOKS.
     */
    books(categories: RulebookCategory[]): BookCode[] {
        const counts = new Map<BookCode, number>();
        for (const category of categories) {
            for (const section of Object.values(RULEBOOK_CATEGORIES[category].sections as Record<string, RulebookSection>)) {
                counts.set(section.book, (counts.get(section.book) ?? 0) + 1);
            }
        }
        return (Object.keys(BOOKS) as BookCode[]).filter(book => counts.has(book)).sort((a, b) => counts.get(b)! - counts.get(a)!);
    },

    title: (book: BookCode) => BOOKS[book].title,

    /** A category's import: what was found of how many, per book; the files it came from. */
    status(category: RulebookCategory) {
        const entry = store[category];
        const sections = Object.values(RULEBOOK_CATEGORIES[category].sections as Record<string, RulebookSection>);
        const found = Object.values(entry?.sections ?? {});
        const books = RedesignRulebook.books([category]).map(book => ({
            book,
            total: sections.filter(section => section.book === book).length,
            count: found.filter(section => (section.book ?? 'SR5') === book).length,
            file: entry?.files?.[book] ?? (book === 'SR5' ? entry?.file : undefined) ?? '',
        }));
        return {
            total: sections.length, count: found.length, books,
            importedAt: entry?.importedAt ?? '', enabled: !!entry?.enabled, imported: !!entry,
        };
    },

    /**
     * Reads the PDFs given and keeps the sections found of the categories chosen in their books, replacing what these
     * books gave before (a category keeps the sections of the books not given). A file in which nothing was found
     * (another book) replaces nothing. Returns per book what was found and the headings not found.
     */
    async import(files: Partial<Record<BookCode, File>>, categories: RulebookCategory[], onProgress: (done: number, total: number, book: BookCode) => void) {
        const given = (Object.keys(files) as BookCode[]).filter(book => files[book]);
        const wanted = given.map(book => ({
            book,
            sections: categories.flatMap(category => Object.entries(RULEBOOK_CATEGORIES[category].sections as Record<string, RulebookSection>)
                .filter(([, section]) => section.book === book).map(([key, section]) => ({ category, key, section }))),
        }));
        const total = wanted.reduce((sum, { sections }) => sum + sections.length, 0);
        const read: { category: RulebookCategory; key: string; found: { book: BookCode; page: number; text: string } }[] = [];
        const missing: Partial<Record<BookCode, string[]>> = {};
        let done = 0;
        const pdfjs = await loadPdfJs();
        for (const { book, sections } of wanted) {
            const pdf = await pdfjs.getDocument({ data: await files[book]!.arrayBuffer() }).promise;
            const cache = new Map<number, PdfLine[]>();
            try {
                for (const { category, key, section } of sections) {
                    onProgress(done++, total, book);
                    const found = await findSection(pdf, section, cache, RULEBOOK_CATEGORIES[category] as { statBlocks?: boolean; costLines?: boolean; maxLength?: number });
                    if (found) read.push({ category, key, found });
                    else (missing[book] ??= []).push(section.heading.replace(/\s*\([^)]*\)$/, ''));
                }
            } finally {
                await pdf.destroy();
            }
        }
        if (wanted.length) onProgress(total, total, wanted[wanted.length - 1].book);
        const empty = wanted.filter(({ book, sections }) => sections.length && (missing[book]?.length ?? 0) === sections.length).map(({ book }) => book);
        const replaced = given.filter(book => !empty.includes(book));
        const next: RulebookStore = { ...store };
        const importedAt = new Date().toISOString();
        // the text of each category: what its other books gave before (read from the compendium), then this import's
        const textOf: Partial<Record<RulebookCategory, Record<string, string>>> = {};
        for (const category of categories) {
            const before = store[category];
            const bookFiles = { ...(before?.file ? { SR5: before.file } : {}), ...before?.files };
            for (const book of replaced) bookFiles[book] = files[book]!.name;
            const kept = Object.entries(before?.sections ?? {}).filter(([, section]) => !replaced.includes(section.book ?? 'SR5'));
            if (kept.length) await loadCategory(category, true);
            textOf[category] = Object.fromEntries(kept.map(([key, section]) => [key, texts[category]?.[key] ?? section.text ?? '']));
            next[category] = { files: bookFiles, importedAt, enabled: true, journal: before?.journal,
                sections: Object.fromEntries(kept.map(([key, { book, page }]) => [key, { book, page }])) };
        }
        for (const { category, key, found } of read) {
            next[category]!.sections[key] = { book: found.book, page: found.page };
            textOf[category]![key] = found.text;
        }
        // a category that holds nothing (all its books were the wrong files) stays as it was
        for (const category of categories) {
            if (!Object.keys(next[category]!.sections).length) { if (store[category]) next[category] = store[category]; else delete next[category]; continue; }
            next[category]!.journal = await writeTexts(category, textOf[category]!, next[category]!.journal);
            texts[category] = textOf[category];
        }
        await save(next);
        return {
            missing,
            found: Object.fromEntries(wanted.map(({ book, sections }) => [book, { count: sections.length - (missing[book]?.length ?? 0), total: sections.length }])) as Partial<Record<BookCode, { count: number; total: number }>>,
            empty,
        };
    },

    /** What a book gave the world: its sections in all categories and the file they came from (the last one). */
    bookStatus(book: BookCode) {
        const entries = Object.values(store).filter(Boolean);
        const count = entries.reduce((sum, entry) => sum + Object.values(entry!.sections).filter(section => (section.book ?? 'SR5') === book).length, 0);
        const file = entries.map(entry => entry!.files?.[book] ?? (book === 'SR5' ? entry!.file : undefined)).find(Boolean) ?? '';
        return { count, file };
    },

    /** Shows or hides a category's text on the cards; the text stays in the world. */
    async setEnabled(category: RulebookCategory, enabled: boolean) {
        const entry = store[category];
        if (entry) await save({ ...store, [category]: { ...entry, enabled } });
    },

    async remove(category: RulebookCategory) {
        const journal = store[category]?.journal;
        const next = { ...store };
        delete next[category];
        await save(next);
        delete texts[category];
        if (journal) await (await pack()?.getDocument(journal))?.delete();
    },
};

const { ApplicationV2 } = foundry.applications.api;

/**
 * The settings window of the import in the sheet's look (redesign-apps.scss: its window, tables, switch and buttons):
 * what it does, then two tables, one group each. What to import: per category a box to import it, what it holds now
 * under its name, a switch to show it on the cards and a button to remove it (asked first). Your books: per book the
 * categories it is for and what it gave the world, a button to pick its PDF (the file then, with a cross to leave it
 * out); the books no chosen category is in are left out. Under them the reading's progress and what it found per book,
 * and the buttons. GM only (the menu is restricted).
 */
class RulebookImportApp extends ApplicationV2 {
    static override DEFAULT_OPTIONS = {
        id: 'sr5-redesign-rulebook-import',
        classes: ['sr5v2', 'sr5-redesign-app', 'sr5-rulebook-import'],
        position: { width: 560, height: 'auto' as const },
        window: { title: 'SR5.Redesign.Rulebook.Title', icon: 'fas fa-book-open' },
    };

    /** The window's choices, kept over its renders (a switch or a removal draws it again): categories, then files. */
    #chosen = new Set((Object.keys(RULEBOOK_CATEGORIES) as RulebookCategory[]).filter(category => RULEBOOK_CATEGORIES[category].checked));
    #files: Partial<Record<BookCode, File>> = {};
    /** What the last import found, shown under the tables until the window closes. */
    #report = '';

    protected override async _renderHTML(): Promise<HTMLElement> {
        const i18n = (key: string, data?: Record<string, string | number>) => data ? game.i18n.format(key, data) : game.i18n.localize(key);
        const categories = Object.keys(RULEBOOK_CATEGORIES) as RulebookCategory[];
        const books = RedesignRulebook.books(categories);
        const needed = () => RedesignRulebook.books(categories.filter(category => this.#chosen.has(category)));
        const files = () => Object.fromEntries(needed().filter(book => this.#files[book]).map(book => [book, this.#files[book]])) as Partial<Record<BookCode, File>>;
        // headings in capitals as names: "BRUTE FORCE" Brute Force
        const named = (heading: string) => heading.toLowerCase().replace(/(^|[\s/(-])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
        const stateText = (category: RulebookCategory) => {
            const status = RedesignRulebook.status(category);
            if (!status.imported) return i18n('SR5.Redesign.Rulebook.None');
            const date = new Date(status.importedAt).toLocaleDateString();
            // per book only where there are more (actions)
            if (status.books.length < 2) return i18n('SR5.Redesign.Rulebook.StatusOne', { count: status.count, total: status.total, date });
            const perBook = status.books.map(book => `${book.book} ${book.count}/${book.total}`).join(', ');
            return i18n('SR5.Redesign.Rulebook.Status', { count: status.count, total: status.total, books: perBook, date });
        };
        const usedBy = (book: BookCode) => categories.filter(category => RedesignRulebook.books([category]).includes(book))
            .map(category => i18n(RULEBOOK_CATEGORIES[category].label)).join(', ');
        const bookText = (book: BookCode) => {
            const status = RedesignRulebook.bookStatus(book);
            const held = status.count ? i18n('SR5.Redesign.Rulebook.InWorld', { count: status.count }) : i18n('SR5.Redesign.Rulebook.NotInWorld');
            return `${i18n('SR5.Redesign.Rulebook.BookFor', { categories: usedBy(book) })} · ${held}`;
        };
        const show = i18n('SR5.Redesign.Rulebook.Show');
        const remove = i18n('SR5.Redesign.Rulebook.Remove');
        const root = document.createElement('div');
        root.className = 'sr5-rulebook-body';
        root.innerHTML = `
            <p class="sr5-rulebook-intro">${escape(i18n('SR5.Redesign.Rulebook.Intro'))}</p>
            <section class="sr5-rulebook-table" aria-labelledby="sr5-rulebook-what">
                <header class="sr5-rulebook-head"><span id="sr5-rulebook-what">${escape(i18n('SR5.Redesign.Rulebook.WhatToImport'))}</span><span class="sr5-rulebook-head-show">${escape(show)}</span></header>
                ${categories.map(category => {
                    const status = RedesignRulebook.status(category);
                    const label = i18n(RULEBOOK_CATEGORIES[category].label);
                    return `
                <div class="sr5-rulebook-row category" data-category="${category}">
                    <label class="sr5-rulebook-check"><input type="checkbox" name="import-${category}"${this.#chosen.has(category) ? ' checked' : ''}>
                        <span class="sr5-rulebook-text"><span class="sr5-rulebook-name">${escape(label)}</span><span class="sr5-rulebook-state">${escape(stateText(category))}</span></span></label>
                    <button type="button" class="sr5-rulebook-switch" data-step="show" data-category="${category}" aria-pressed="${status.enabled}"${status.imported ? '' : ' disabled'}
                        data-tooltip="${escape(i18n('SR5.Redesign.Rulebook.ShowHint'))}" aria-label="${escape(`${show}: ${label}`)}"><i class="fas ${status.enabled ? 'fa-toggle-on' : 'fa-toggle-off'}" aria-hidden="true"></i></button>
                    <button type="button" class="sr5-rulebook-icon" data-step="remove" data-category="${category}"${status.imported ? '' : ' disabled'}
                        data-tooltip="${escape(remove)}" aria-label="${escape(`${remove}: ${label}`)}"><i class="fas fa-trash" aria-hidden="true"></i></button>
                </div>`;
                }).join('')}
            </section>
            <div class="sr5-rulebook-group">
                <section class="sr5-rulebook-table" aria-labelledby="sr5-rulebook-books">
                    <header class="sr5-rulebook-head"><span id="sr5-rulebook-books">${escape(i18n('SR5.Redesign.Rulebook.Books'))}</span></header>
                    ${books.map(book => {
                        const file = this.#files[book];
                        const title = RedesignRulebook.title(book);
                        return `
                    <div class="sr5-rulebook-row book" data-book="${book}">
                        <span class="sr5-rulebook-text"><span class="sr5-rulebook-name">${escape(title)} <span class="sr5-rulebook-code">${book}</span></span><span class="sr5-rulebook-state">${escape(bookText(book))}</span></span>
                        ${file ? `
                        <span class="sr5-rulebook-file" data-tooltip="${escape(file.name)}"><i class="fas fa-file-pdf" aria-hidden="true"></i><span>${escape(file.name)}</span></span>
                        <button type="button" class="sr5-rulebook-icon" data-step="clear" data-book="${book}" data-tooltip="${escape(i18n('SR5.Redesign.Rulebook.ClearFile'))}" aria-label="${escape(`${i18n('SR5.Redesign.Rulebook.ClearFile')}: ${title}`)}"><i class="fas fa-xmark" aria-hidden="true"></i></button>` : `
                        <label class="sr5-rulebook-pick"><input type="file" class="sr-only" name="file-${book}" accept="application/pdf,.pdf" aria-label="${escape(`${i18n('SR5.Redesign.Rulebook.ChoosePdf')}: ${title}`)}"><i class="fas fa-file-arrow-up" aria-hidden="true"></i> ${escape(i18n('SR5.Redesign.Rulebook.ChoosePdf'))}</label>`}
                    </div>`;
                    }).join('')}
                </section>
                <p class="sr5-rulebook-note">${escape(i18n('SR5.Redesign.Rulebook.KeepNote'))}</p>
            </div>
            <div class="sr5-rulebook-progress" aria-live="polite"${this.#report ? '' : ' hidden'}><div class="sr5-rulebook-bar" hidden><span></span></div><p class="sr5-rulebook-report">${this.#report}</p></div>
            <footer class="sheet-footer">
                <button type="button" class="sr5-button sr5-cancel" data-step="close"><i class="fas fa-xmark" aria-hidden="true"></i> ${escape(i18n('Close'))}</button>
                <button type="button" class="sr5-button sr5-submit" data-step="import" disabled><i class="fas fa-file-import" aria-hidden="true"></i> ${escape(i18n('SR5.Redesign.Rulebook.Import'))}</button>
            </footer>`;
        const progress = root.querySelector<HTMLElement>('.sr5-rulebook-progress')!;
        const bar = progress.querySelector<HTMLElement>('.sr5-rulebook-bar')!;
        const report = progress.querySelector<HTMLElement>('.sr5-rulebook-report')!;
        const importButton = root.querySelector<HTMLButtonElement>('[data-step="import"]')!;
        const ready = () => {
            // a book no chosen category is in has nothing to give: left out of the list (skills alone: the Core rulebook)
            for (const book of books) {
                const off = !needed().includes(book);
                const row = root.querySelector<HTMLElement>(`[data-book="${book}"]`);
                if (row) row.hidden = off;
                for (const control of root.querySelectorAll<HTMLInputElement | HTMLButtonElement>(`[data-book="${book}"] :is(input, button)`)) control.disabled = off;
            }
            importButton.disabled = !Object.keys(files()).length;
        };
        ready();
        for (const category of categories) {
            root.querySelector<HTMLInputElement>(`[name="import-${category}"]`)?.addEventListener('change', event => {
                if ((event.currentTarget as HTMLInputElement).checked) this.#chosen.add(category); else this.#chosen.delete(category);
                ready();
            });
        }
        for (const input of root.querySelectorAll<HTMLInputElement>('input[type="file"]')) {
            input.addEventListener('change', () => {
                const book = input.name.replace('file-', '') as BookCode;
                const file = input.files?.[0];
                if (file) this.#files[book] = file;
                void this.render();
            });
        }
        for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step="clear"]')) {
            button.addEventListener('click', () => {
                delete this.#files[button.dataset.book as BookCode];
                void this.render();
            });
        }
        root.querySelector('[data-step="close"]')?.addEventListener('click', () => void this.close());
        importButton.addEventListener('click', async () => {
            const given = files();
            if (!Object.keys(given).length) return;
            for (const control of root.querySelectorAll<HTMLInputElement | HTMLButtonElement>('input, button:not([data-step="close"])')) control.disabled = true;
            progress.hidden = false;
            bar.hidden = false;
            try {
                const result = await RedesignRulebook.import(given, categories.filter(category => this.#chosen.has(category)), (done, total, book) => {
                    bar.style.setProperty('--done', `${total ? done / total * 100 : 100}%`);
                    report.textContent = i18n('SR5.Redesign.Rulebook.Reading', { book: RedesignRulebook.title(book), done, total });
                });
                // per book what it gave: found of looked for, the headings not found, or that it was not the book
                this.#report = (Object.keys(given) as BookCode[]).map(book => {
                    const found = result.found[book] ?? { count: 0, total: 0 };
                    if (result.empty.includes(book)) return `<span class="warn"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${escape(i18n('SR5.Redesign.Rulebook.NotThisBook', { file: given[book]!.name, book: RedesignRulebook.title(book) }))}</span>`;
                    const missing = result.missing[book]?.length ? ` ${escape(i18n('SR5.Redesign.Rulebook.Missing', { names: result.missing[book]!.map(named).join(', ') }))}` : '';
                    return `<span${missing ? ' class="warn"' : ''}><i class="fas ${missing ? 'fa-triangle-exclamation' : 'fa-check'}" aria-hidden="true"></i> ${escape(i18n('SR5.Redesign.Rulebook.Found', { book: RedesignRulebook.title(book), count: found.count, total: found.total }))}${missing}</span>`;
                }).join('');
                this.#files = {};
            } catch (error) {
                console.error('SR5 Redesign | rulebook import', error);
                this.#report = `<span class="warn"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> ${escape(i18n('SR5.Redesign.Rulebook.NotPdf'))}</span>`;
            }
            await this.render();
        });
        for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step="show"]')) {
            button.addEventListener('click', async () => {
                await RedesignRulebook.setEnabled(button.dataset.category as RulebookCategory, button.getAttribute('aria-pressed') !== 'true');
                void this.render();
            });
        }
        for (const button of root.querySelectorAll<HTMLButtonElement>('[data-step="remove"]')) {
            button.addEventListener('click', async () => {
                const category = button.dataset.category as RulebookCategory;
                // the text comes back only from the PDFs: asked first, No the default (as the sheet's removals)
                const confirmed = await foundry.applications.api.DialogV2.confirm({
                    classes: ['sr5v2', 'sr5-redesign-app', 'redesign-dialog', ...[...this.element.classList].filter(name => /^theme-|^themed$/.test(name))],
                    position: { width: 400 },
                    window: { title: remove },
                    content: `<p>${escape(i18n('SR5.Redesign.Rulebook.RemoveConfirm', { category: i18n(RULEBOOK_CATEGORIES[category].label) }))}</p>`,
                    yes: { label: i18n('SR5.Redesign.Rulebook.RemoveYes') },
                    no: { label: i18n('Cancel'), default: true },
                    rejectClose: false,
                });
                if (confirmed !== true) return;
                await RedesignRulebook.remove(category);
                void this.render();
            });
        }
        return root;
    }

    protected override _onClose(options: object): void {
        super._onClose(options as never);
        this.#report = '';
        this.#files = {};
    }

    protected override _replaceHTML(result: HTMLElement, content: HTMLElement): void {
        content.replaceChildren(result);
    }
}
