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
    beginPath() { operations.push(['beginPath']); },
    moveTo(x, y) { operations.push(['moveTo', x, y]); },
    lineTo(x, y) { operations.push(['lineTo', x, y]); },
    closePath() { operations.push(['closePath']); },
    fill() { operations.push(['fill', this.fillStyle]); },
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

test('boss draws no text banners during warning, recovery or rage', () => {
  for (const state of [{ attackTimer: 0.5 }, { recovery: 0.9 }, { enraged: true }]) {
    const { renderer, ctx } = makeRenderer();
    renderer.bear = { naturalWidth: 1000 };
    renderer.engine.mode = 'boss-fight';
    renderer.engine.boss = { active: true, opacity: 1, x: 704, attackTimer: 2, ...state };
    ctx.fillText = () => assert.fail('Boss text must stay removed');
    renderer.drawBoss();
    assert.equal(ctx.operations.filter(op => op[0] === 'drawImage').length, 1);
    assert.equal(ctx.operations.some(op => op[0] === 'fillRect'), false);
  }
});

test('boss claw and ground wave have distinct animated silhouettes', () => {
  const render = (groundWave, life) => {
    const { renderer, ctx } = makeRenderer();
    renderer.drawBossWave({ x: 400, y: 372, w: 58, h: 24, vx: -430, vy: 0, groundWave, life });
    return ctx.operations;
  };
  const claw = render(false, 2);
  const wave = render(true, 2);
  assert.notDeepEqual(claw, wave);
  assert.equal(claw.filter(op => op[0] === 'beginPath').length, 3);
  assert.equal(wave.filter(op => op[0] === 'beginPath').length, 4);
  assert.equal(wave.some(op => op[0] === 'rotate'), false);
  assert.notDeepEqual(claw, render(false, 1.9));
  assert.notDeepEqual(wave, render(true, 1.9));
});

test('all nine stage obstacles have distinct canvas drawings without enemy sprites', () => {
  const shapes = new Set();
  for (const type of ['sandstone', 'cactus', 'dune', 'altar', 'spears', 'pillar', 'log', 'thorns', 'roots']) {
    const { renderer, ctx } = makeRenderer();
    renderer.engine.entityRect = () => ({ x: 100, y: 330, w: 76, h: 66 });
    renderer.drawEntity({ type, worldX: 100 });
    assert.ok(ctx.operations.some(op => op[0] === 'fillRect'), type);
    assert.equal(ctx.operations.some(op => op[0] === 'drawImage'), false, type);
    shapes.add(JSON.stringify(ctx.operations));
  }
  assert.equal(shapes.size, 9);
});

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
