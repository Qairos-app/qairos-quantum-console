import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('real app entry preserves wallet bundle and privacy boundaries', async () => {
  const html = await readFile('app/index.html', 'utf8');
  assert.match(html, /src\/wallet\/index\.js/);
  assert.match(html, /identityPaused/);
  assert.match(html, /ethToWei/);
  const wallet = await readFile('src/wallet/core.js', 'utf8');
  assert.match(wallet, /personal_sign/);
  assert.match(wallet, /eth_sendTransaction/);
  assert.match(wallet, /rc\.status === "0x1"/);
  assert.doesNotMatch(wallet, /process\.env/);
});
test('brand metadata belongs to Qairos', async () => {
  for (const path of ['index.html', 'app/index.html']) {
    const html = await readFile(path, 'utf8');
    assert.match(html, /__QAIROS_SITE_ORIGIN__/);
    assert.match(html, /Qairos/);
  }
});
