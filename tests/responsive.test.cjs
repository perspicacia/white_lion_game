const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const styles = fs.readFileSync(path.join(__dirname, '..', 'dist', 'styles.css'), 'utf8');

test('mobile action buttons keep a 44px minimum touch target', () => {
  assert.match(styles, /\.mini-button\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.top-actions \.icon-button\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/s);
});

test('portrait mobile viewport is tall enough to expose the start action', () => {
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.viewport\s*\{[^}]*min-height:\s*460px/s);
});

test('compact hero keeps the game panel visible near the first viewport', () => {
  assert.match(styles, /\.hero\s*\{[^}]*padding:\s*20px 0 16px/s);
  assert.match(styles, /\.hero h1\s*\{[^}]*white-space:\s*nowrap;[^}]*font-size:\s*clamp\(28px, 3\.2vw, 42px\)/s);
  assert.match(styles, /@media \(max-width:\s*760px\)[\s\S]*?\.hero h1\s*\{[^}]*white-space:\s*normal/s);
  assert.match(styles, /@media \(max-width:\s*520px\)[\s\S]*?\.hero h1\s*\{[^}]*font-size:\s*clamp\(28px, 8vw, 34px\)/s);
});

test('coarse pointer and short landscape layouts expose touch controls', () => {
  assert.match(styles, /@media \(hover:\s*none\) and \(pointer:\s*coarse\)[\s\S]*?\.touch-controls\s*\{\s*display:\s*grid/s);
  assert.match(styles, /@media \(max-height:\s*430px\) and \(orientation:\s*landscape\)[\s\S]*?\.touch-controls\s*\{[^}]*display:\s*grid/s);
});
