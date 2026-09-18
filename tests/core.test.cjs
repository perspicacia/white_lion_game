const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, STAGES, GROUND, PLAYER_X, ITEM_Y, BOSS_MAX_HP } = require('../dist/js/core.js');

function advance(engine, seconds, before = () => {}) {
  const frames = Math.ceil(seconds * 120);
  for (let frame = 0; frame < frames; frame += 1) {
    before(engine, frame);
    engine.update(1 / 120);
  }
}

test('starts at stage 1 with five life and faster autorun', () => {
  const engine = new Engine();
  engine.start('fire');
  engine.entities = [];
  engine.collectibles = [];
  advance(engine, 1);
  assert.equal(engine.hp, 5);
  assert.equal(engine.stage, 0);
  assert.ok(engine.world >= 294 && engine.world <= 296);
  assert.equal(engine.element, 'fire');
});

test('accepts exactly two jumps and resets the count on landing', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  engine.collectibles = [];
  assert.equal(engine.jump(), true);
  advance(engine, 0.08);
  assert.equal(engine.jump(), true);
  assert.equal(engine.jump(), false);
  assert.equal(engine.jumpsUsed, 2);
  advance(engine, 1.2);
  assert.equal(engine.playerY, GROUND);
  assert.equal(engine.jumpsUsed, 0);
  assert.equal(engine.jump(), true);
});

test('fire and ice produce identical game mechanics', () => {
  const fire = new Engine();
  const ice = new Engine();
  fire.start('fire');
  ice.start('ice');
  for (const engine of [fire, ice]) {
    engine.entities = [];
    engine.collectibles = [];
  }
  for (let frame = 0; frame < 10000; frame += 1) {
    for (const engine of [fire, ice]) {
      if (frame % 151 === 0) engine.jump();
      if (frame % 79 === 0) engine.attack();
      engine.update(1 / 120);
    }
    for (const key of ['stage', 'hp', 'score', 'world', 'playerY', 'vy', 'mode', 'checkpoint']) {
      assert.equal(fire[key], ice[key], `${key} differs at frame ${frame}`);
    }
  }
});

test('one accepted hit removes one life without resetting distance', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  engine.collectibles = [];
  advance(engine, 2);
  const before = engine.world;
  assert.equal(engine.damage('rock'), true);
  assert.equal(engine.hp, 4);
  assert.equal(engine.mode, 'running');
  assert.equal(engine.damage('rock'), false);
  assert.equal(engine.hp, 4);
  assert.ok(engine.world >= before);
});

test('only zero life respawns at the latest checkpoint with its score', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  engine.collectibles = [];
  engine.world = 2001;
  engine.score = 350;
  engine.update(1 / 120);
  assert.equal(engine.checkpoint, 2000);
  assert.equal(engine.checkpointScore, 350);
  engine.score = 900;
  for (let hit = 0; hit < 5; hit += 1) {
    engine.invulnerable = 0;
    engine.damage('test');
  }
  assert.equal(engine.mode, 'dying');
  assert.equal(engine.hp, 0);
  advance(engine, 1.2);
  assert.equal(engine.mode, 'running');
  assert.equal(engine.hp, 5);
  assert.ok(engine.world >= 2000 && engine.world < 2030);
  assert.equal(engine.score, 350);
});

test('pause freezes distance, physics, cooldowns and boss timers', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  engine.collectibles = [];
  engine.jump();
  advance(engine, 0.1);
  engine.pause();
  const before = JSON.stringify({ world: engine.world, y: engine.playerY, vy: engine.vy, cooldown: engine.attackCooldown, boss: engine.boss.attackTimer });
  advance(engine, 3);
  const after = JSON.stringify({ world: engine.world, y: engine.playerY, vy: engine.vy, cooldown: engine.attackCooldown, boss: engine.boss.attackTimer });
  assert.equal(after, before);
  assert.equal(engine.jump(), false);
  assert.equal(engine.attack(), false);
});

test('ground running cannot collect apex items, but a timed jump can', () => {
  const walking = new Engine();
  walking.start();
  walking.entities = [];
  walking.collectibles = [{ id: 'coin', type: 'coin', worldX: 160, y: ITEM_Y, w: 28, h: 28, collected: false }];
  advance(walking, 0.7);
  assert.equal(walking.collectibles[0].collected, false);

  const jumping = new Engine();
  jumping.start();
  jumping.entities = [];
  jumping.collectibles = [{ id: 'coin', type: 'coin', worldX: 160, y: ITEM_Y, w: 28, h: 28, collected: false }];
  jumping.jump();
  advance(jumping, 0.7);
  assert.equal(jumping.collectibles[0].collected, true);
  assert.equal(jumping.score, 50);
});

test('coin intervals generate three-coin arcs while healing foods stay single and alternate', () => {
  for (let stage = 0; stage < 3; stage += 1) {
    const engine = new Engine();
    engine.stage = stage;
    engine.setupStage();

    const coinGroups = new Map();
    for (const item of engine.collectibles.filter(({ type }) => type === 'coin')) {
      const groupId = item.id.split('-').slice(0, 3).join('-');
      const group = coinGroups.get(groupId) || [];
      group.push(item);
      coinGroups.set(groupId, group);
    }

    assert.ok(coinGroups.size > 0);
    for (const group of coinGroups.values()) {
      assert.equal(group.length, 3);
      assert.deepEqual(group.map(({ y }) => y).sort((a, b) => a - b), [ITEM_Y, ITEM_Y + 10, ITEM_Y + 10]);
      assert.equal(Math.max(...group.map(({ worldX }) => worldX)) - Math.min(...group.map(({ worldX }) => worldX)), 68);
    }
    const foods = engine.collectibles.filter(({ type }) => type === 'food' || type === 'steak');
    assert.ok(foods.some(({ type }) => type === 'food'));
    assert.ok(foods.some(({ type }) => type === 'steak'));
    assert.ok(foods.every(({ id }) => id.split('-').length === 3));
    for (let index = 1; index < foods.length; index += 1) assert.notEqual(foods[index].type, foods[index - 1].type);
  }
});

test('chicken and steak grant the same score and healing', () => {
  for (const type of ['food', 'steak']) {
    let pickup = null;
    const engine = new Engine((event) => { if (event === type) pickup = event; });
    engine.start();
    engine.entities = [];
    engine.hp = 4;
    engine.collectibles = [{ id: type, type, worldX: 0, y: 350, w: 28, h: 28, collected: false }];
    engine.updateWorldCollisions();
    assert.equal(engine.score, 120);
    assert.equal(engine.hp, 5);
    assert.equal(pickup, type);
  }
});

test('attacks defeat enemies but never remove solid obstacles', () => {
  const enemy = new Engine();
  enemy.start('ice');
  enemy.collectibles = [];
  enemy.entities = [{ id: 'h', type: 'hyena', worldX: 260, w: 92, h: 72, removed: false, hit: false }];
  enemy.attack();
  advance(enemy, 0.45);
  assert.equal(enemy.entities[0].removed, true);
  assert.equal(enemy.score, 140);

  const rock = new Engine();
  rock.start();
  rock.collectibles = [];
  rock.entities = [{ id: 'r', type: 'rock', worldX: 260, w: 52, h: 48, removed: false, hit: false }];
  rock.attack();
  advance(rock, 0.45);
  assert.equal(rock.entities[0].removed, false);
});

test('stage thresholds clear stages 1 and 2 and increase speed', () => {
  assert.ok(STAGES[0].speed < STAGES[1].speed && STAGES[1].speed < STAGES[2].speed);
  const engine = new Engine();
  engine.start();
  for (let stage = 0; stage < 2; stage += 1) {
    engine.entities = [];
    engine.collectibles = [];
    engine.world = STAGES[stage].length * 10 - 1;
    engine.update(1 / 60);
    assert.equal(engine.mode, 'stage-clear');
    assert.equal(engine.stage, stage);
    assert.equal(engine.nextStage(), true);
  }
  assert.equal(engine.stage, 2);
  assert.equal(engine.mode, 'running');
});

test('every stage run is about thirty seconds longer than the previous course', () => {
  const previousMeters = [800, 1000, 1050];
  STAGES.forEach((stage, index) => {
    const newMeters = index === 2 ? stage.bossStart : stage.length;
    const addedSeconds = (newMeters - previousMeters[index]) * 10 / stage.speed;
    assert.ok(addedSeconds >= 29.9 && addedSeconds <= 30.1);
  });
});

test('giant bear requires twenty successful attacks', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  assert.equal(BOSS_MAX_HP, 20);
  assert.equal(engine.boss.hp, 20);
  assert.equal(engine.boss.maxHp, 20);
});

test('giant bear fires a straight projectile toward the lion body center', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  engine.mode = 'boss-fight';
  engine.boss.active = true;
  engine.boss.attackTimer = 0;
  const player = engine.playerRect();
  engine.updateBoss(1 / 120);
  assert.equal(engine.enemyProjectiles.length, 1);
  const shot = engine.enemyProjectiles[0];
  const startX = shot.x;
  const startY = shot.y;
  const fromX = shot.x + shot.w / 2;
  const fromY = shot.y + shot.h / 2;
  const targetX = player.x + player.w / 2;
  const targetY = player.y + player.h / 2;
  assert.ok(shot.y < GROUND - 80);
  assert.ok(Math.abs(Math.hypot(shot.vx, shot.vy) - 430) < 0.001);
  assert.ok(Math.abs((targetX - fromX) * shot.vy - (targetY - fromY) * shot.vx) < 0.001);
  const originalVelocity = [shot.vx, shot.vy];
  engine.playerY = GROUND - 140;
  engine.updateProjectiles(0.1);
  assert.ok(Math.abs(shot.x - (startX + shot.vx * 0.1)) < 0.001);
  assert.ok(Math.abs(shot.y - (startY + shot.vy * 0.1)) < 0.001);
  assert.deepEqual([shot.vx, shot.vy], originalVelocity);
  engine.playerY = GROUND;
  for (let frame = 0; frame < 240 && engine.hp === 5; frame += 1) engine.updateProjectiles(1 / 120);
  assert.equal(engine.hp, 4);
});

test('giant bear stays far away, keeps ground position and fades without falling', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  engine.world = STAGES[2].bossStart * 10 - 1;
  engine.update(1 / 60);
  assert.equal(engine.mode, 'boss-fight');
  assert.ok(engine.boss.x - (PLAYER_X + 68) > 150);
  const groundY = engine.boss.y;
  engine.boss.hp = 1;
  const rect = engine.bossRect();
  engine.projectiles = [{ x: rect.x + 10, y: rect.y + 20, w: 36, h: 22, vx: 0, life: 1, element: 'fire' }];
  engine.update(1 / 120);
  assert.equal(engine.mode, 'boss-defeated');
  assert.equal(engine.boss.y, groundY);
  const alpha = engine.boss.opacity;
  advance(engine, 0.5);
  assert.equal(engine.boss.y, groundY);
  assert.ok(engine.boss.opacity < alpha);
  advance(engine, 1.6);
  assert.equal(engine.mode, 'won');
  assert.equal(engine.boss.y, groundY);
  assert.equal(engine.boss.opacity, 0);
});

test('restart from pause returns to element selection and clears run state', () => {
  const engine = new Engine();
  engine.start('ice');
  engine.entities = [];
  engine.collectibles = [];
  advance(engine, 2);
  engine.score = 700;
  engine.pause();
  engine.returnToTitle();
  assert.equal(engine.mode, 'ready');
  assert.equal(engine.stage, 0);
  assert.equal(engine.world, 0);
  assert.equal(engine.score, 0);
  assert.equal(engine.hp, 5);
});

test('invalid frame times cannot corrupt the simulation', () => {
  const engine = new Engine();
  engine.start();
  const before = engine.snapshot();
  for (const value of [NaN, Infinity, -1, 0]) engine.update(value);
  assert.deepEqual(engine.snapshot(), before);
});
