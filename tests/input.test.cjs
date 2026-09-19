const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const main = fs.readFileSync(path.join(__dirname, '..', 'dist', 'js', 'main.js'), 'utf8');

test('focused game prevents browser scrolling before ignoring repeated gameplay keys', () => {
  assert.match(main, /const gameplayKeys = \['Space', 'ArrowUp', 'KeyW', 'KeyX', 'KeyJ'\]/);
  assert.match(main, /const gameHasFocus = document\.activeElement === document\.querySelector\('#game'\)/);

  const preventDefaultAt = main.indexOf('if (gameHasFocus && gameplayKeys.includes(event.code)) event.preventDefault();');
  const repeatGuardAt = main.indexOf('if (event.repeat) return;');
  assert.ok(preventDefaultAt >= 0);
  assert.ok(repeatGuardAt > preventDefaultAt);
});
