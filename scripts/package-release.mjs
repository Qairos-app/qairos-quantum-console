import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const metadata = JSON.parse(await readFile('package.json', 'utf8'));
await mkdir('release-assets', { recursive: true });
execFileSync('pnpm', ['pack', '--pack-destination', 'release-assets'], { stdio: 'inherit' });
const sums = [];
for (const name of (await readdir('release-assets')).filter(x => x.endsWith('.tgz')).sort()) {
  const hash = createHash('sha256').update(await readFile('release-assets/' + name)).digest('hex');
  sums.push(hash + '  ' + name);
}
if (!sums.length) throw new Error('No package was produced.');
await writeFile('release-assets/SHA256SUMS', sums.join('\n') + '\n');
console.log('Packaged ' + metadata.name + '@' + metadata.version);
