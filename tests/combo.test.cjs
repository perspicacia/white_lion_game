const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, GROUND } = require('../dist/js/core.js');

function coin(engine) {
  engine.collectibles = [{ type: 'coin', worldX: engine.world, y: GROUND - 40, w: 28, h: 28, collected: false }];
  engine.updateWorldCollisions();
}

test('real pickups grow a capped combo with equal fire and ice rewards', () => {
  for (const element of ['fire', 'ice']) {
    const milestones = [];
    const engine = new Engine((type, snapshot, detail) => {
      if (type === 'combo-up') milestones.push(detail.multiplier);
    });
    engine.start(element);
    engine.entities = [];
    for (let i = 0; i < 4; i++) coin(engine);
    assert.equal(engine.score, 200);
    coin(engine);
    assert.equal(engine.score, 300);
    for (let i = 0; i < 5; i++) coin(engine);
    assert.equal(engine.comboMultiplier(), 3);
    assert.equal(engine.score, 850);
    assert.deepEqual(milestones, [2, 3]);
    assert.deepEqual(engine.runStats, { bestCombo: 10, bonus: 350, pickups: 10, enemies: 0 });
    engine.updateWorldCollisions();
    assert.equal(engine.combo, 10, 'the same pickup cannot count twice');
    engine.invulnerable = 1;
    engine.damage();
    assert.equal(engine.combo, 10, 'ignored damage must not reset combo');
    engine.invulnerable = 0;
    engine.damage();
    assert.equal(engine.combo, 0);
    assert.equal(engine.runStats.bestCombo, 10);
    coin(engine);
    assert.equal(engine.score, 900);
  }
});

test('enemy hits count once, pause preserves combo and restart clears it', () => {
  const engine = new Engine();
  engine.start();
  engine.collectibles = [];
  engine.entities = [{ type: 'hyena', worldX: 300, w: 92, h: 72, removed: false }];
  engine.projectiles = [{ ...engine.entityRect(engine.entities[0]), life: 1, vx: 0 }];
  engine.updateWorldCollisions();
  engine.updateWorldCollisions();
  assert.equal(engine.combo, 1);
  assert.equal(engine.runStats.enemies, 1);
  engine.pause();
  engine.update(0.05);
  assert.equal(engine.combo, 1);
  engine.resume();
  assert.equal(engine.combo, 1);
  engine.returnToTitle();
  assert.equal(engine.combo, 0);
  assert.equal(engine.runStats.enemies, 0);
});

test('checkpoint rewinds stats with score; next stage and boss reset combo', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  for (let i = 0; i < 6; i++) coin(engine);
  engine.world = 5001;
  engine.collectibles = [];
  engine.update(0.01);
  const saved = { ...engine.runStats };
  const savedScore = engine.score;
  coin(engine);
  engine.respawn();
  assert.equal(engine.combo, 0);
  assert.equal(engine.score, savedScore);
  assert.deepEqual(engine.runStats, saved);
  engine.runStats.bonus += 1;
  assert.equal(engine.checkpointStats.bonus, saved.bonus, 'checkpoint is not aliased');
  engine.mode = 'stage-clear';
  engine.nextStage();
  assert.equal(engine.combo, 0);
  assert.equal(engine.runStats.bestCombo, 0);
  engine.stage = 2;
  engine.setupStage();
  engine.entities = [];
  for (let i = 0; i < 5; i++) coin(engine);
  engine.beginBoss();
  assert.equal(engine.combo, 0);
  assert.equal(engine.runStats.bestCombo, 5);
  assert.equal(engine.checkpointStats.bestCombo, 5);
});
