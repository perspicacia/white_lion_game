const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..', 'dist');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'retro-theme.css'), 'utf8');

test('retro theme loads after the base layout and bundles both Korean pixel fonts and license', () => {
  assert.ok(html.indexOf('styles.css') < html.indexOf('retro-theme.css'));
  for (const asset of ['Galmuri11.woff2', 'Galmuri11-Bold.woff2', 'OFL.md']) {
    assert.ok(fs.statSync(path.join(root, 'assets', 'fonts', asset)).size > 1000);
  }
  assert.match(theme, /font-display:\s*swap/);
});

test('every local HTML and theme asset resolves, including all three adventure-map scenes', () => {
  const assets = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(match => match[1])
    .concat([...theme.matchAll(/url\("([^"]+)"\)/g)].map(match => match[1]));
  for (const asset of assets.filter(asset => !asset.startsWith('data:') && asset !== './')) {
    assert.ok(fs.existsSync(path.join(root, asset)), `Missing ${asset}`);
  }
  assert.equal((html.match(/class="stage-preview"/g) || []).length, 3);
});

test('retro menus retain selected text and mobile touch targets', () => {
  assert.match(theme, /\.element-card b\s*\{\s*visibility:\s*hidden/);
  assert.match(theme, /\.element-card\.selected b\s*\{\s*visibility:\s*visible/);
  assert.match(theme, /\.mini-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(theme, /\.touch-controls button\s*\{[^}]*min-height:\s*58px/s);
  assert.match(html, /data-element="fire" aria-pressed="true"/);
  assert.match(html, /data-element="ice" aria-pressed="false"/);
});

test('short landscape menu keeps its start action in a two-column layout', () => {
  const landscape = theme.slice(theme.indexOf('@media (max-height: 430px)'));
  assert.match(landscape, /\.start-panel\s*\{[^}]*grid-template-columns:\s*1fr 1fr/s);
  assert.match(landscape, /\.start-panel \.primary-button\s*\{[^}]*min-height:\s*44px/s);
});
