# Where these files come from

The repository holds everything SR5 Redesign 0.3.58 is built from; `npm install && npm run build` writes the module to
`dist/sr5-redesign`.

| Folder | Source |
|---|---|
| `fork/` | our fork of [SR5-FoundryVTT](https://github.com/SR5-FoundryVTT/SR5-FoundryVTT) (branch `lab/sheet-redesign`, commit `ad5c3d12f789e026c2f9ac09bdf5a28342ce2c8e`; the fork itself is not published): the sheet, its templates, stylesheets, fonts and strings, at their paths in that repository. Comments there sometimes name our own notes or tracker items (`notes/...`, `b066`); those are not part of this repository |
| `system-0.37.8/` | SR5-FoundryVTT, release tag `0.37.8` (`36ac2644cb263e91a4130f6dba306cbbb258d810`): the system code the module bundles, so it matches the installed system; `system.json` carries the release's version number (the tag's file says 0.37.0: upstream stamps it when releasing) |
| `build/` | the build: `build.mjs` (esbuild and sass), `entry.ts`, `shims/` (stand-ins for the system pieces the running system provides), `module-extra.scss` |

Only the files the build reads are here; both source repositories are GPL-3.0, as is this one (`LICENSE`).
