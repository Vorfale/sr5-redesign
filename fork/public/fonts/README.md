# Fonts

Fonts used by the SR5 Redesign sheet, all under the SIL Open Font License 1.1. Each folder holds the font's own
`OFL.txt` next to it.

The fonts are the original release files from the Google Fonts repository, https://github.com/google/fonts, at commit
`47d54ca1ebb14fd864695f1d39dc734f39017c33` (path `ofl/<family>/`), packed into WOFF2 without any change. Not subset,
not renamed, no glyph or table altered:
- every table of the original TrueType file is stored in the WOFF2 byte for byte, with the null transform for `glyf`
  and `loca` and no transform for any other table; only the whole is Brotli-compressed;
- the WOFF2 files hold no extended metadata or private data.

The OFL FAQ (2.2.1) lets a WOFF2 packed this way keep the font's name, Reserved Font Names included. To check a file,
unpack it with any WOFF2 decoder and compare its tables with the original TTF from the commit above; its SHA-256 is
listed below.

| Folder | Font | Copyright | Reserved Font Name | Upstream |
|---|---|---|---|---|
| `orbitron` | Orbitron, variable weight | 2018 The Orbitron Project Authors | "Orbitron" | https://github.com/theleagueof/orbitron |
| `barlow-condensed` | Barlow Condensed Regular, SemiBold, Bold | 2017 The Barlow Project Authors | none | https://github.com/jpt/barlow |
| `marcellus` | Marcellus Regular | 2012 Brian J. Bonislawsky DBA Astigmatic (AOETI) | "Marcellus" | https://fonts.google.com/specimen/Marcellus |
| `days-one` | Days One Regular | 2011 Jovanny Lemonad | "Days One" | https://github.com/googlefonts/daysone |
| `sofia-sans-condensed` | Sofia Sans Condensed, variable weight | 2019 The Sofia Sans Project Authors | none | https://github.com/lettersoup/Sofia-Sans |
| `forum` | Forum Regular | 2011 Denis Masharov | "Forum" | https://github.com/librefonts/forum |

How the sheet uses them:
- Orbitron (headings), Barlow Condensed (labels) and Marcellus (prose) have no Cyrillic letters, in their full
  releases either. For Cyrillic only, the stylesheet loads Days One, Sofia Sans Condensed and Forum under the same CSS
  families (`unicode-range`), so Russian text keeps a similar look. The fonts stay as released; only the stylesheet
  combines them.
- Headings fall back to Barlow Condensed for the few characters Orbitron lacks (« » · ^ ¥ ≥ ≤ ∞). Anything else comes
  from Foundry's or the system's fonts.
- The CSS family names (`SR5 Head`, `SR5 Label`, `SR5 Label Readable`, `SR5 Prose`) describe roles and do not use any
  Reserved Font Name.

SHA-256 of the original TrueType files (google/fonts, commit above):

```
f42db2dd16e642258e35782916eceb1dcdbea06fb958d77ad71dc5963587e8fd  ofl/orbitron/Orbitron[wght].ttf
583cec5da3b84bc4dc7c9c72e2a565c94d34e431518b19d7e250b7830ad5f996  ofl/barlowcondensed/BarlowCondensed-Regular.ttf
7b619d14bc2327509a9ef32b0890f709626f7ecc9ff61191c2a4314c5499d2d9  ofl/barlowcondensed/BarlowCondensed-SemiBold.ttf
e476562ec9c1e16cf16475895b511f08c804f438cc9a9f80a44ea50a0eeb5b65  ofl/barlowcondensed/BarlowCondensed-Bold.ttf
1cf0cd10b17d35e852729962cc1ffaffed94514895972458345e2df34abb2f81  ofl/marcellus/Marcellus-Regular.ttf
7b5a0e6d88696e43e95f6320613908e53d36ad854b4a18e4a1b8d1c19fdbf1fe  ofl/daysone/DaysOne-Regular.ttf
3282c4e1a09d14e91c5fdb10aadee93048d017fa00f857f43fdcc29c989221fd  ofl/sofiasanscondensed/SofiaSansCondensed[wght].ttf
5c9fbe9c4ce76d0269f5088d921d57e58082fd9c28433eacb6de95baf938adf8  ofl/forum/Forum-Regular.ttf
```
