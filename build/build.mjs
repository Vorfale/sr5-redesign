// Builds modules/sr5-redesign (the SR5 Redesign sheet as a standalone module) from the fork branch lab/sheet-redesign,
// for the released Shadowrun 5e system (src/sr5-stock-<version>, a worktree of the release tag).
//
//   node build.mjs [moduleVersion]
//
// What goes into the module:
//   scripts/sheet.mjs   the fork's SR5CharacterSheetRedesign + SR5RichTooltip, bundled with esbuild. System pieces the
//                       running system exposes (documents, CONFIG.SR5, the character sheet) come from it at runtime;
//                       the small utilities it does not expose (SheetFlow, SkillRules, Helpers...) are bundled from the
//                       release sources, so they match the installed system. The bundle runs inside an 'init' hook,
//                       after the system registered its sheets.
//   templates/          the sheet's templates; templates/system/ holds the fork's list rows, item properties, source icon
//                       and the karma / nuyen / reputation managers (system templates the redesign changed), with the
//                       data paths of the release where 0.38 moved them; used by this sheet and its apps only.
//   styles/sheet.css    the sheet's stylesheet, the apps' one and the fork's changes to the system's own stylesheets
//                       (module-extra.scss), loaded into the system's CSS layer (module.json) so the cascade is the same
//                       as in the fork; fonts/ with the Latin faces and the Cyrillic fallbacks.
//   lang/en.json        SR5.Redesign.* and the other keys the sheet uses that the release does not have.
//
// Paths default to this workspace; the public source repository (scripts/export-public-repo.mjs) runs the same script
// with its own layout through the environment:
//   SR5_ROOT         base for the recorded input paths            SR5_FORK, SR5_STOCK   the fork and the release sources
//   SR5_MODULE_OUT   the module folder written                    SR5_RU_OUT            the Russian module ('' = none)
//   SR5_NODE_ROOT    where esbuild and sass are installed         SR5_INPUTS_FILE       the record of what went in
//   SR5_REPO         'owner/name' on GitHub: adds the url, manifest, download, bugs, readme and changelog links
//   SR5_MEDIA        the screenshots the manifest lists (default: media/ next to this script)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const env = process.env;
const BUILD = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.resolve(env.SR5_LAB ?? path.join(BUILD, '../..')); // the workspace: modules/sr5-redesign-build/..
const ROOT = path.resolve(env.SR5_ROOT ?? LAB);
const FORK = path.resolve(env.SR5_FORK ?? path.join(LAB, 'src/SR5-FoundryVTT'));
const STOCK = path.resolve(env.SR5_STOCK ?? path.join(LAB, 'src/sr5-stock-0.37.8'));
const MOD = path.resolve(env.SR5_MODULE_OUT ?? path.join(LAB, 'modules/sr5-redesign'));
const RU = env.SR5_RU_OUT === '' ? null : path.resolve(env.SR5_RU_OUT ?? path.join(LAB, 'modules/sr5-ru'));
const INPUTS_FILE = path.resolve(env.SR5_INPUTS_FILE ?? path.join(BUILD, 'bundle-inputs.txt'));
const REPO = env.SR5_REPO || null;
/** The screenshots the manifest lists (with SR5_REPO): file in media/, media type, caption. */
const MEDIA = [
    ['character-skills.png', 'cover', 'Character sheet: attributes and limits, the combat sidebar, skills with their pools.'],
    ['character-inventory-card.png', 'screenshot', 'Inventory with search, filters and sorting, and the hover card of an item.'],
    ['character-light.png', 'screenshot', 'The character sheet in the light theme.'],
    ['vehicle.png', 'screenshot', 'Vehicle and drone sheet: driver, control mode, damage and Matrix condition, skills, modification slots.'],
];
const MEDIA_DIR = path.resolve(env.SR5_MEDIA ?? path.join(BUILD, 'media'));
for (const [file] of MEDIA) if (!fs.existsSync(path.join(MEDIA_DIR, file))) throw new Error(`missing screenshot ${file} in ${MEDIA_DIR}`);
const MODULE_ID = 'sr5-redesign';
const MODULE_PATH = `modules/${MODULE_ID}/templates`;
const SYSTEM_V2 = 'systems/shadowrun5e/dist/templates/v2';

const require = createRequire(path.join(path.resolve(env.SR5_NODE_ROOT ?? FORK), 'package.json'));
const esbuild = require('esbuild');
const sass = require('sass');

const stockVersion = JSON.parse(fs.readFileSync(path.join(STOCK, 'system.json'), 'utf8')).version;
const version = process.argv[2] ?? JSON.parse(fs.readFileSync(path.join(MOD, 'module.json'), 'utf8')).version;

const read = file => fs.readFileSync(file, 'utf8');
const write = (file, text) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);

for (const dir of ['templates', 'scripts', 'styles', 'fonts', 'lang']) fs.rmSync(path.join(MOD, dir), { recursive: true, force: true });

// ---------- templates ----------
/** System template paths the module serves itself: the sheet's own templates and its copies of system templates. */
const SYSTEM_COPIES = ['list-items/', 'item-properties/', 'common/document-source-icon.hbs',
    'actor/apps/karma-manager/', 'actor/apps/nuyen-manager/', 'actor/apps/reputation-manager/'];
const rewritePaths = text => SYSTEM_COPIES.reduce(
    (out, copy) => out.replaceAll(`${SYSTEM_V2}/${copy}`, `${MODULE_PATH}/system/${copy}`),
    text.replaceAll(`${SYSTEM_V2}/actor/redesign/`, `${MODULE_PATH}/`));

/**
 * Data the fork (system 0.38) reads elsewhere than the release: 0.38 moved the computed essence from
 * technology.calculated.essence to technology.essence. Applied to every template the module ships.
 */
const DATA_PATHS = [['item.system.technology.essence', 'item.system.technology.calculated.essence']];
const mapData = text => DATA_PATHS.reduce((out, [from, to]) => out.replaceAll(from, to), text);
const prepareTemplate = text => mapData(rewritePaths(text));

const templatePaths = [];
const forkTemplates = path.join(FORK, 'src/templates/v2');
for (const file of walk(path.join(forkTemplates, 'actor/redesign'))) {
    const name = path.relative(path.join(forkTemplates, 'actor/redesign'), file);
    write(path.join(MOD, 'templates', name), prepareTemplate(read(file)));
    templatePaths.push(`${MODULE_PATH}/${name}`);
}
// system templates the fork changed, from the fork: upstream rewrote the item properties between 0.37.8 and 0.38, so
// the redesign's changes (icons, data-prop marks, formats) do not apply to the release's copies as a patch
for (const copy of SYSTEM_COPIES) {
    const source = path.join(forkTemplates, copy);
    const files = copy.endsWith('/') ? walk(source) : [source];
    for (const file of files) {
        const rel = path.relative(forkTemplates, file);
        write(path.join(MOD, 'templates/system', rel), prepareTemplate(read(file)));
        templatePaths.push(`${MODULE_PATH}/system/${rel}`);
    }
}
// a data path of the release that no shipped template reads any more means the mapping above is stale (checked where
// the release's templates are at hand; the public repository carries only the release files the build uses)
const stockTemplates = path.join(STOCK, 'src/templates/v2');
for (const [from] of fs.existsSync(stockTemplates) ? DATA_PATHS : []) {
    const stockUses = walk(stockTemplates).some(file => read(file).includes(from.replace('.essence', '.calculated.essence')));
    if (!stockUses) throw new Error(`data path mapping for ${from}: the release does not use the mapped path any more`);
}

// ---------- script ----------
const SHIMS = {
    'actor/sheets/SR5CharacterSheet': 'shims/sheet-base.ts',
    'config': 'shims/config.ts',
    'item/SR5Item': 'shims/item.ts',
    'actor/SR5Actor': 'shims/actor.ts',
    'helpers': 'shims/helpers.ts',
    'rules/SkillRules': 'shims/skill-rules.ts',
    'rules/TestRules': 'shims/test-rules.ts',
    'flows/SheetFlow': 'shims/sheet-flow.ts',
    'actor/flows/ModifierFlow': 'shims/modifier-flow.ts',
    'utils/links': 'shims/links.ts',
    'utils/dom': 'shims/dom.ts',
    'handlebars/RollAndLabelHelpers': 'shims/roll-and-label-helpers.ts',
    'tests/TestCreator': 'shims/test-creator.ts',
    'tests/SuccessTest': 'shims/success-test.ts',
    'effect/SR5ActiveEffect': 'shims/active-effect.ts',
};
// the fork's own files: the sheet, its helpers, and the small apps it opens (the fork changed them for the keyboard)
const FROM_FORK = new Set([
    'actor/sheets/SR5CharacterSheetRedesign', 'actor/sheets/SR5VehicleSheetRedesign', 'actor/sheets/SR5RichTooltip', 'actor/sheets/RedesignPool',
    'actor/sheets/RedesignRowMenu', 'actor/sheets/RedesignMatrixApps', 'actor/sheets/RedesignListControls',
    'actor/sheets/RedesignSettings',
    // rules the fork added for the sheet (b066), not in the release yet
    'rules/InitiativeRules',
    'apps/actor/KarmaManager', 'apps/actor/NuyenManager', 'apps/actor/ReputationManager',
]);
// and every module split out of the sheet (actor/sheets/redesign/*)
const fromFork = id => FROM_FORK.has(id) || id.startsWith('actor/sheets/redesign/');
const stockModule = path.join(STOCK, 'src/module');

const resolver = {
    name: 'sr5-redesign-resolver',
    setup(build) {
        // 'stock/...' always means the release's own file (the shims extend those), 'fork/...' the fork's
        build.onResolve({ filter: /^stock\// }, args => build.resolve(`./${args.path.slice('stock/'.length)}`, {
            resolveDir: path.join(STOCK, 'src'), kind: args.kind, pluginData: { skip: true },
        }));
        build.onResolve({ filter: /^fork\// }, args => ({ path: path.join(FORK, 'src', `${args.path.slice('fork/'.length)}.ts`) }));
        build.onResolve({ filter: /.*/ }, async args => {
            if (args.pluginData?.skip || args.kind === 'entry-point') return undefined;
            // which module of the system is meant: '@/module/x' or a relative import inside the system sources
            let id;
            if (args.path.startsWith('@/module/')) id = args.path.slice('@/module/'.length);
            // some release files import by the tsconfig base ('src/module/...'), which would resolve into the fork
            else if (args.path.startsWith('src/module/')) id = args.path.slice('src/module/'.length);
            else if (args.path.startsWith('.')) {
                const abs = path.resolve(args.resolveDir, args.path);
                for (const root of [stockModule, path.join(FORK, 'src/module')]) {
                    if (abs.startsWith(root + path.sep)) id = path.relative(root, abs);
                }
            }
            if (id === undefined) return undefined;
            id = id.replace(/\.(ts|js)$/, '');
            if (SHIMS[id]) return { path: path.join(BUILD, SHIMS[id]) };
            if (fromFork(id)) return { path: path.join(FORK, 'src/module', `${id}.ts`) };
            return build.resolve(`./${id}`, { resolveDir: stockModule, kind: args.kind, pluginData: { skip: true } });
        });
        // the tooltip names its template directly
        build.onLoad({ filter: /SR5RichTooltip\.ts$/ }, args => ({ contents: rewritePaths(read(args.path)), loader: 'ts' }));
        // a fork file that imports another fork file by a relative path (RedesignPool, RedesignRowMenu)
        build.onResolve({ filter: /^\.\.?\// }, args => {
            if (!args.importer.startsWith(path.join(FORK, 'src/module') + path.sep) || args.pluginData?.skip) return undefined;
            const id = path.relative(path.join(FORK, 'src/module'), path.resolve(args.resolveDir, args.path)).replace(/\.(ts|js)$/, '');
            if (SHIMS[id]) return { path: path.join(BUILD, SHIMS[id]) };
            if (fromFork(id)) return { path: path.join(FORK, 'src/module', `${id}.ts`) };
            return build.resolve(`./${id}`, { resolveDir: stockModule, kind: args.kind, pluginData: { skip: true } });
        });
    },
};

const result = await esbuild.build({
    entryPoints: [path.join(BUILD, 'entry.ts')],
    bundle: true,
    format: 'iife',
    target: 'es2022',
    keepNames: true, // the sheet id is built from the class name
    write: false,
    metafile: true,
    tsconfig: path.join(FORK, 'tsconfig.json'),
    absWorkingDir: ROOT, // the source paths in the bundle's comments are relative to it
    define: { MODULE_TEMPLATE_PATHS: JSON.stringify(templatePaths), SYSTEM_CHARACTER_SHEET: 'systemCharacterSheet' },
    plugins: [resolver],
    logLevel: 'warning',
});
const inputs = Object.keys(result.metafile.inputs).map(file => path.relative(ROOT, path.resolve(file)));

// ---------- notices ----------
// GPL-3.0 section 5(a): the work says it was modified, and when (the version's date in CHANGELOG.md; none for a build
// between versions). The npm packages bundled into the script keep their copyright and license (Apache-2.0 section 4
// for Fuse.js): THIRD-PARTY-NOTICES.md, and a line in the script's header.
const changelogFile = path.join(MOD, 'CHANGELOG.md');
const versionDate = fs.existsSync(changelogFile)
    ? read(changelogFile).match(new RegExp(`^## \\[${version.replaceAll('.', '\\.')}\\] - (\\d{4}-\\d{2}-\\d{2})`, 'm'))?.[1] ?? null
    : null;
const systemAuthors = JSON.parse(read(path.join(STOCK, 'system.json'))).authors.map(author => author.name).join(', ');
const bundledPackages = [...new Set(Object.keys(result.metafile.inputs)
    .map(file => path.resolve(file).match(/^(.*\/node_modules\/((?:@[^/]+\/)?[^/]+))\//))
    .filter(Boolean).map(match => match[1]))].sort().map(dir => {
        const pkg = JSON.parse(read(path.join(dir, 'package.json')));
        const bundledFile = Object.keys(result.metafile.inputs).map(file => path.resolve(file)).find(file => file.startsWith(dir + path.sep));
        const copyright = read(bundledFile).match(/Copyright[^\n*]*/)?.[0].trim() ?? `Copyright the ${pkg.name} authors`;
        const licenseFile = fs.readdirSync(dir).find(name => /^licen[cs]e(\.(md|txt))?$/i.test(name));
        const noticeFile = fs.readdirSync(dir).find(name => /^notice(\.(md|txt))?$/i.test(name));
        if (!licenseFile) throw new Error(`${pkg.name} ships no license file`);
        return { name: pkg.name, version: pkg.version, license: pkg.license, copyright, homepage: pkg.homepage,
            licenseText: read(path.join(dir, licenseFile)), noticeText: noticeFile ? read(path.join(dir, noticeFile)) : null };
    });
const SOURCE_URL = 'https://github.com/Vorfale/sr5-redesign';
const header = `/**
 * SR5 Redesign ${version}: an alternative character sheet for the Shadowrun 5e system (built for system ${stockVersion}).
 * Generated by ${path.relative(ROOT, BUILD)}/build.mjs from the SR5-FoundryVTT fork (branch lab/sheet-redesign).
 * Source code: ${SOURCE_URL}
 *
 * Copyright (C) 2026 Ravefale. This program is free software: you can redistribute it and/or modify it under the terms
 * of the GNU General Public License version 3 (LICENSE). It comes WITHOUT ANY WARRANTY.
 * Contains code from the Shadowrun 5e system for Foundry VTT (https://github.com/SR5-FoundryVTT/SR5-FoundryVTT),
 * copyright its authors (${systemAuthors} and contributors), GPL-3.0; modified for this module${versionDate ? `, last on ${versionDate}` : ''}.
${bundledPackages.map(pkg => ` * Bundles ${pkg.name} ${pkg.version}, ${pkg.copyright}, ${pkg.license} (THIRD-PARTY-NOTICES.md).`).join('\n')}
 */
`;
const bundle = result.outputFiles[0].text;
write(path.join(MOD, 'THIRD-PARTY-NOTICES.md'), `# Third-party code in SR5 Redesign

\`scripts/sheet.mjs\` bundles these packages unchanged. Each keeps its own license, given in full below.

${bundledPackages.map(pkg => `## ${pkg.name} ${pkg.version}

${pkg.copyright}. License: ${pkg.license}.${pkg.homepage ? ` ${pkg.homepage}` : ''}
${pkg.noticeText ? `\n### NOTICE\n\n\`\`\`\n${pkg.noticeText.trim()}\n\`\`\`\n` : ''}
\`\`\`
${pkg.licenseText.trim()}
\`\`\`
`).join('\n')}`);
write(path.join(MOD, 'scripts/sheet.mjs'), `${header}
// Foundry queues sheet registrations made during 'init' and fills CONFIG.Actor.sheetClasses only just before 'ready',
// and the system does not expose its character sheet class: catch the class when the system registers it (the system's
// scripts load before this one, its 'init' runs before ours), then hand registerSheet back untouched.
const DocumentSheetConfig = foundry.applications.apps.DocumentSheetConfig;
const registerSheet = DocumentSheetConfig.registerSheet;
let systemCharacterSheet = null;
DocumentSheetConfig.registerSheet = function (documentClass, scope, sheetClass, options) {
    if (scope === 'shadowrun5e' && sheetClass?.name === 'SR5CharacterSheet') systemCharacterSheet = sheetClass;
    return registerSheet.call(this, documentClass, scope, sheetClass, options);
};

Hooks.once('init', () => {
    DocumentSheetConfig.registerSheet = registerSheet;
    if (game.system.id !== 'shadowrun5e') return;
    if (!systemCharacterSheet) {
        console.error('${MODULE_ID} | the Shadowrun 5e character sheet was not registered; SR5 Redesign is not available.');
        return;
    }
    if (!game.system.version.startsWith('${stockVersion.split('.').slice(0, 2).join('.')}.')) {
        console.warn(\`${MODULE_ID} | built for Shadowrun 5e ${stockVersion}, running on \${game.system.version}.\`);
    }
    try {
${bundle.split('\n').map(line => line ? `        ${line}` : line).join('\n')}
    } catch (error) {
        console.error('${MODULE_ID} | failed to set up the sheet', error);
    }
});
`);

// ---------- styles and fonts ----------
// one stylesheet: the sheet, the apps it opens (redesign-apps.scss uses actor-redesign, emitted once) and the fork's
// changes to the system's own stylesheets (module-extra.scss)
const compiled = sass.compileString(`@use 'actor-redesign';\n@use 'redesign-apps';\n@use 'module-extra';\n`, {
    url: pathToFileURL(path.join(BUILD, 'sheet.scss')),
    loadPaths: [path.join(FORK, 'src/css'), BUILD],
    style: 'expanded',
    sourceMap: false,
});
const styleInputs = compiled.loadedUrls.filter(url => url.protocol === 'file:' && !url.pathname.endsWith('/sheet.scss'))
    .map(url => path.relative(ROOT, fileURLToPath(url)));
// the record of what went in: the script's sources, then the stylesheets
write(INPUTS_FILE, `${[...inputs, ...styleInputs].join('\n')}\n`);
const css = compiled.css.replace(/url\((['"]?)fonts\//g, 'url($1../fonts/')
    // the system's own pictures (the fork's stylesheet sits in dist/, next to them): taken from the installed system
    .replace(/url\((['"]?)assets\//g, 'url($1../../../systems/shadowrun5e/dist/assets/');
const systemAssets = [...css.matchAll(/url\(\s*['"]?\.\.\/\.\.\/\.\.\/systems\/shadowrun5e\/dist\/assets\/([^'")]+)['"]?\s*\)/g)].map(match => match[1]);
for (const asset of systemAssets) {
    if (!fs.existsSync(path.join(STOCK, 'public/assets', asset))) throw new Error(`the release has no assets/${asset}`);
}
// anything else relative would resolve against the module's styles/ folder, where nothing but the fonts is
const strayUrls = [...css.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map(match => match[1])
    .filter(url => !/^(data:|https?:|\/|#|\.\.\/fonts\/|\.\.\/\.\.\/\.\.\/systems\/)/.test(url));
if (strayUrls.length) throw new Error(`URLs with nothing behind them in the module: ${strayUrls.join(', ')}`);
const fontUrls = [...css.matchAll(/url\(\s*['"]?([^'")]+\.(?:woff2?|ttf|otf))['"]?\s*\)/g)].map(match => match[1]);
const unrewritten = fontUrls.filter(url => !url.startsWith('../fonts/'));
if (unrewritten.length) throw new Error(`font URLs not rewritten: ${unrewritten.join(', ')}`);
write(path.join(MOD, 'styles/sheet.css'), css);
fs.cpSync(path.join(FORK, 'public/fonts'), path.join(MOD, 'fonts'), { recursive: true });
for (const url of fontUrls) {
    if (!fs.existsSync(path.join(MOD, 'styles', url))) throw new Error(`missing font file ${url}`);
}

// ---------- language ----------
const forkEn = JSON.parse(read(path.join(FORK, 'public/locale/en/config.json')));
const stockEn = JSON.parse(read(path.join(STOCK, 'public/locale/en/config.json')));
const get = (object, key) => key.split('.').reduce((node, part) => node?.[part], object);
const set = (object, key, value) => {
    const parts = key.split('.');
    const last = parts.pop();
    let node = object;
    for (const part of parts) node = node[part] ??= {};
    node[last] = value;
};
const lang = { SR5: { Redesign: forkEn.SR5.Redesign } };
const sources = [
    ...walk(path.join(MOD, 'templates')),
    ...[...FROM_FORK].map(id => path.join(FORK, 'src/module', `${id}.ts`)),
    ...walk(path.join(BUILD, 'shims')),
    path.join(BUILD, 'entry.ts'),
];
const added = [];
for (const file of sources) {
    for (const [key] of read(file).matchAll(/SR5\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*/g)) {
        if (get(stockEn, key) !== undefined || get(lang, key) !== undefined) continue;
        const value = get(forkEn, key);
        if (typeof value === 'string' || (value && typeof value === 'object')) { set(lang, key, value); added.push(key); }
    }
}
write(path.join(MOD, 'lang/en.json'), `${JSON.stringify(lang, null, 4)}\n`);

// ---------- manifest ----------
const manifest = {
    id: MODULE_ID,
    title: 'SR5 Redesign',
    description: 'Alternative Shadowrun 5e character sheet: limits in the header, a combat sidebar with condition monitors and quick rolls, skills with dice pools and filters, list search and filters, rich item and attribute cards, karma and nuyen in a footer; and a vehicle and drone sheet in the same look. Dark and light themes.',
    version,
    authors: [{ name: 'Ravefale' }],
    ...(REPO ? {
        url: `https://github.com/${REPO}`,
        manifest: `https://github.com/${REPO}/releases/latest/download/module.json`,
        download: `https://github.com/${REPO}/releases/download/v${version}/module.zip`,
        bugs: `https://github.com/${REPO}/issues`,
        readme: `https://github.com/${REPO}/blob/main/README.md`,
        changelog: `https://github.com/${REPO}/blob/main/CHANGELOG.md`,
        // screenshots in the repository's media/ folder (modules/sr5-redesign-build/media here), at this version's tag
        media: MEDIA.map(([file, type, caption]) => ({ type, url: `https://raw.githubusercontent.com/${REPO}/v${version}/media/${file}`, caption })),
    } : {}),
    compatibility: { minimum: '14', verified: '14.369' },
    relationships: {
        systems: [{ id: 'shadowrun5e', type: 'system', compatibility: { minimum: '0.37.0', verified: stockVersion } }],
    },
    esmodules: ['scripts/sheet.mjs'],
    // the system's layer: the sheet's rules meet the system's in the same cascade as in the fork
    styles: [{ src: 'styles/sheet.css', layer: 'system' }],
    languages: [{ lang: 'en', name: 'English', path: 'lang/en.json' }],
    license: 'LICENSE',
};
write(path.join(MOD, 'module.json'), `${JSON.stringify(manifest, null, 4)}\n`);

console.log(`sr5-redesign ${version} for shadowrun5e ${stockVersion}: ${templatePaths.length} templates, ` +
    `${inputs.length} bundled sources, ${(bundle.length / 1024).toFixed(0)} KB script, ${(css.length / 1024).toFixed(0)} KB css; ` +
    `extra locale keys: ${added.join(', ') || 'none'}`);

// ---------- Russian, a separate module (sr5-ru): a draft translation of the system and the sheet ----------
// Kept out of sr5-redesign on purpose; the fork's ru locale (system strings and SR5.Redesign.*) as one language file.
if (RU) {
    fs.rmSync(RU, { recursive: true, force: true });
    write(path.join(RU, 'lang/ru.json'), read(path.join(FORK, 'public/locale/ru/config.json')));
    write(path.join(RU, 'module.json'), `${JSON.stringify({
        id: 'sr5-ru',
        title: 'SR5 Russian (draft)',
        description: 'Draft Russian translation of the Shadowrun 5e system and the SR5 Redesign sheet. Choose Russian as the client language in Foundry. Strings missing here stay in English.',
        version,
        authors: [{ name: 'Ravefale' }],
        compatibility: { minimum: '14', verified: '14.369' },
        relationships: { systems: [{ id: 'shadowrun5e', type: 'system', compatibility: { minimum: '0.37.0' } }] },
        languages: [{ lang: 'ru', name: 'Русский', path: 'lang/ru.json' }],
        license: 'LICENSE',
    }, null, 4)}\n`);
    fs.copyFileSync(path.join(MOD, 'LICENSE'), path.join(RU, 'LICENSE'));
    console.log(`sr5-ru ${version}: ${Object.keys(JSON.parse(read(path.join(RU, 'lang/ru.json'))).SR5).length} SR5 groups`);
}
