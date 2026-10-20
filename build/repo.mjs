// npm run build: the module into dist/sr5-redesign, with this repository's layout (build.mjs reads its paths from the
// environment). SR5_REPO ('owner/name', set by the workflow) adds the GitHub links to module.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist/sr5-redesign');
const { version } = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const system = fs.readdirSync(root).find(name => /^system-\d+\.\d+\.\d+$/.test(name));

fs.rmSync(path.join(root, 'dist'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const file of ['README.md', 'CHANGELOG.md', 'LICENSE']) fs.copyFileSync(path.join(root, file), path.join(out, file));
Object.assign(process.env, {
    SR5_ROOT: root,
    SR5_FORK: path.join(root, 'fork'),
    SR5_STOCK: path.join(root, system),
    SR5_MODULE_OUT: out,
    SR5_RU_OUT: '',
    SR5_NODE_ROOT: root,
    SR5_INPUTS_FILE: path.join(root, 'dist/inputs.txt'),
});
process.argv[2] = version;
await import('./build.mjs');
