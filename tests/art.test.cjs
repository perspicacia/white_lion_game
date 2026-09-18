const test = require('node:test');
const assert = require('node:assert/strict');

class FakeImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
  }
}

function makeContext() {
  const operations = [];
  return {
    operations,
    fillStyle: '',
    save() {},
    restore() {},
    translate(x, y) { operations.push(['translate', x, y]); },
    rotate(value) { operations.push(['rotate', value]); },
    scale(x, y) { operations.push(['scale', x, y]); },
    fillRect(x, y, width, height) { operations.push(['fillRect', this.fillStyle, x, y, width, height]); },
    drawImage(...args) { operations.push(['drawImage', ...args]); },
  };
}

global.Image = FakeImage;
global.document = { createElement: () => ({}) };
global.window = { WhiteLionCore: { GROUND: 396, PLAYER_X: 146, STAGES: [] } };
require('../dist/js/art.js');
const { Renderer } = global.window.WhiteLionArt;

function makeRenderer() {
  const ctx = makeContext();
  const engine = {
    stage: 0,
    time: 0,
    world: 0,
    collectibleRect: () => ({ x: 100, y: 200, w: 28, h: 28 }),
  };
  const canvas = { getContext: () => ctx };
  return { renderer: new Renderer(canvas, engine), ctx };
}

test('coin collectible uses a stepped pixel outline, gold face, and dollar mark', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.drawCollectible({ type: 'coin', worldX: 100 });
  const colors = ctx.operations.filter(([type]) => type === 'fillRect').map(([, color]) => color);
  assert.ok(colors.includes('#3a200f'));
  assert.ok(colors.includes('#ffc928'));
  assert.ok(colors.includes('#f29a00'));
  assert.equal(ctx.operations.some(([type]) => type === 'rotate'), false);
});

test('food collectible uses a diagonal golden drumstick with a pale bone', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.drawCollectible({ type: 'food', worldX: 100 });
  const colors = ctx.operations.filter(([type]) => type === 'fillRect').map(([, color]) => color);
  assert.ok(colors.includes('#ffe8c5'));
  assert.ok(colors.includes('#f49a24'));
  assert.ok(colors.includes('#ffc163'));
  assert.ok(ctx.operations.some(([type, value]) => type === 'rotate' && value < -0.5));
  assert.deepEqual(ctx.operations.find(([type]) => type === 'scale'), ['scale', 1.16, 1.16]);
});

test('steak collectible uses a thick brown side, pale fat rim, and three red meat lobes', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.drawCollectible({ type: 'steak', worldX: 100 });
  const colors = ctx.operations.filter(([type]) => type === 'fillRect').map(([, color]) => color);
  for (const color of ['#3b1711', '#8f3d15', '#c96322', '#ffd0a3', '#c43f4b', '#ef6870', '#e45a64', '#dc4b58', '#9e2838']) assert.ok(colors.includes(color));
  assert.deepEqual(ctx.operations.find(([type]) => type === 'scale'), ['scale', 1.18, 1.18]);
  assert.ok(ctx.operations.some(([type, value]) => type === 'rotate' && value < -0.09));
});

test('desert background alternates mirrored tiles so matching edges meet', () => {
  const { renderer, ctx } = makeRenderer();
  renderer.backgrounds[0] = { complete: true, naturalWidth: 2048 };
  renderer.engine.world = 0;
  renderer.drawBackground();
  assert.equal(ctx.operations.filter(([type]) => type === 'drawImage').length, 2);
  assert.ok(ctx.operations.some(([type, x, y]) => type === 'scale' && x === -1 && y === 1));
});
