const test = require('node:test');
const assert = require('node:assert/strict');
const { Engine, STAGES, GROUND, PLAYER_X, ITEM_Y, BOSS_MAX_HP, BOSS_LANES, COIN_ARC_INTERVAL, isEnemy } = require('../dist/js/core.js');

function advance(engine, seconds, before = () => {}) {
  const frames = Math.ceil(seconds * 120);
  for (let frame = 0; frame < frames; frame += 1) {
    before(engine, frame);
    engine.update(1 / 120);
  }
}

test('bear advances and retreats safely, pauses, resets on respawn and fades in place', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  engine.beginBoss();
  engine.invulnerable = 100;
  const home = engine.boss.x;
  advance(engine, 2.4, () => {
    assert.ok(engine.boss.x >= 560 && engine.boss.x <= 704);
    assert.equal(engine.boss.y, GROUND);
  });
  assert.ok(home - engine.boss.x > 140);
  // The rendered bear begins 92px left of its collision rectangle.
  assert.ok(engine.boss.x - 92 - (PLAYER_X + 68) > 240);
  engine.pause();
  const pausedX = engine.boss.x;
  advance(engine, 1);
  assert.equal(engine.boss.x, pausedX);
  engine.resume();
  advance(engine, 2.4);
  assert.ok(Math.abs(engine.boss.x - home) < 0.01);
  advance(engine, 1);
  engine.respawn();
  assert.equal(engine.boss.x, home);
  assert.equal(engine.boss.movementTime, 0);
  assert.equal(engine.boss.active, false);
  assert.equal(engine.world, 0);
  engine.beginBoss();
  advance(engine, 1);
  engine.boss.hp = 0.5;
  engine.projectiles.push({ ...engine.bossRect(), vx: 0, life: 1 });
  engine.update(1 / 120);
  assert.equal(engine.mode, 'boss-defeated');
  const defeatedX = engine.boss.x;
  advance(engine, 2.1);
  assert.equal(engine.boss.x, defeatedX);
  assert.equal(engine.boss.y, GROUND);
  assert.equal(engine.mode, 'won');
});

test('stages have distinct obstacles that damage on contact, resist attacks and can be jumped', () => {
  const expected = [['sandstone', 'cactus', 'dune'], ['altar', 'spears', 'pillar'], ['log', 'thorns', 'roots']];
  expected.forEach((types, stage) => {
    const engine = new Engine();
    engine.start();
    engine.stage = stage;
    engine.setupStage();
    const obstacles = engine.entities.filter(e => !isEnemy(e.type));
    assert.deepEqual([...new Set(obstacles.map(e => e.type))].sort(), [...types].sort());
    for (const type of types) {
      const sample = obstacles.find(e => e.type === type);
      engine.collectibles = [];
      engine.entities = [{ ...sample, worldX: 0, removed: false, hit: false }];
      engine.world = 0;
      engine.playerY = GROUND;
      engine.hp = 5;
      engine.invulnerable = 0;
      engine.projectiles = [{ ...engine.entityRect(engine.entities[0]), life: 1 }];
      engine.updateWorldCollisions();
      assert.equal(engine.hp, 4, type);
      assert.equal(engine.entities[0].removed, false, type);
      engine.entities[0].hit = false;
      engine.invulnerable = 0;
      engine.playerY = GROUND - 120;
      engine.updateWorldCollisions();
      assert.equal(engine.hp, 4, type + ' cleared by jumping');
    }
  });
});

test('stage 3 adds a cobra that rises near the lion and awards its own attack score', () => {
  const enemySets = [
    ['hyena'],
    ['ghost', 'hyena'],
    ['cobra', 'ghost', 'hyena']
  ];
  enemySets.forEach((expected, stage) => {
    const engine = new Engine();
    engine.start();
    engine.stage = stage;
    engine.setupStage();
    assert.deepEqual([...new Set(engine.entities.filter(entity => isEnemy(entity.type)).map(entity => entity.type))].sort(), expected);
  });

  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  const cobra = engine.entities.find(entity => entity.type === 'cobra');
  engine.world = cobra.worldX - 784;
  const low = engine.entityRect(cobra);
  engine.world = cobra.worldX - 564;
  const early = engine.entityRect(cobra);
  engine.world = cobra.worldX - 434;
  const rising = engine.entityRect(cobra);
  engine.world = cobra.worldX - 304;
  const late = engine.entityRect(cobra);
  engine.world = cobra.worldX - 134;
  const raised = engine.entityRect(cobra);
  assert.equal(low.h, 76);
  assert.ok(low.h < early.h && early.h < rising.h && rising.h < late.h && late.h < raised.h);
  assert.equal(raised.h, 136);
  assert.equal(low.y + low.h, GROUND);
  assert.ok(Math.abs(rising.y + rising.h - GROUND) < 1e-8);
  assert.equal(raised.y + raised.h, GROUND);
  engine.world = cobra.worldX - 68;
  assert.equal(engine.entityRect(cobra).h, raised.h, 'cobra stays raised near the lion');
  engine.world = cobra.worldX - 134;

  engine.collectibles = [];
  engine.entities = [cobra];
  engine.projectiles = [{ ...raised, life: 1 }];
  engine.updateWorldCollisions();
  assert.equal(cobra.removed, true);
  assert.equal(engine.score, 220);
  assert.equal(engine.runStats.enemies, 1);
});

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
    for (const key of ['stage', 'hp', 'score', 'world', 'playerY', 'vy', 'mode']) {
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

test('zero life restarts the current stage and preserves only previous-stage score', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  engine.collectibles = [];
  engine.stage = 1;
  engine.score = 350;
  engine.setupStage();
  engine.entities = [];
  engine.collectibles = [];
  engine.world = 5001;
  engine.update(1 / 120);
  assert.equal('checkpoint' in engine.snapshot(), false);
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
  assert.equal(engine.stage, 1);
  assert.ok(engine.world >= 0 && engine.world < 40);
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

test('long ribbons alternate arc and straight patterns, stay airborne and alternate healing food', () => {
  for (let stage = 0; stage < 3; stage += 1) {
    const engine = new Engine();
    engine.stage = stage;
    engine.setupStage();

    const coinGroups = new Map();
    for (const item of engine.collectibles) {
      const groupId = item.id.split('-').slice(0, 3).join('-');
      const group = coinGroups.get(groupId) || [];
      group.push(item);
      coinGroups.set(groupId, group);
    }

    assert.ok(coinGroups.size > 10);
    const completeGroups = [...coinGroups.values()].slice(0, -1);
    for (const group of completeGroups) {
      assert.ok([14, 21].includes(group.length));
      assert.ok(group.filter(item => item.type === 'coin').length >= 13);
      assert.ok(group.every(item => item.y + item.h / 2 >= ITEM_Y + 14 && item.y + item.h + 5 < GROUND - 54));
      assert.ok(group.at(-1).worldX - group[0].worldX > 400);
    }
    const patterns = completeGroups.map(group => group[0].pattern);
    assert.deepEqual(patterns.slice(0, 6), ['arc', 'line', 'arc', 'line', 'arc', 'line']);
    for (const group of completeGroups.filter(group => group[0].pattern === 'line')) {
      assert.equal(new Set(group.map(item => item.y + item.h / 2)).size, 1);
    }
    for (const group of completeGroups.filter(group => group[0].pattern === 'arc')) {
      assert.ok(new Set(group.map(item => item.y + item.h / 2)).size > 3);
    }
    assert.ok(engine.collectibles.filter(item => item.type === 'coin').length > 300);
    assert.equal(new Set(engine.collectibles.map(item => item.id)).size, engine.collectibles.length);
    assert.ok(engine.collectibles.every(item => item.worldX + 28 < (stage === 2 ? STAGES[stage].bossStart - 35 : STAGES[stage].length - 25) * 10));
    const foods = engine.collectibles.filter(({ type }) => type === 'food' || type === 'steak');
    assert.ok(foods.some(({ type }) => type === 'food'));
    assert.ok(foods.some(({ type }) => type === 'steak'));
    assert.ok(foods.every(item => item.y + item.h / 2 >= ITEM_Y + 14 && item.y + item.h / 2 <= ITEM_Y + 48));
    for (let index = 1; index < foods.length; index += 1) assert.notEqual(foods[index].type, foods[index - 1].type);
  }
});

test('rare golden big coins are larger and worth five regular coins', () => {
  const engine = new Engine();
  engine.start();
  const groups = new Map();
  for (const item of engine.collectibles) {
    const group = Number(item.id.split('-')[2]);
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(item);
  }
  const bigCoins = engine.collectibles.filter(item => item.type === 'bigcoin');
  assert.ok(bigCoins.length > 0);
  assert.ok(bigCoins.length < engine.collectibles.filter(item => item.type === 'coin').length / 50);
  assert.ok(bigCoins.every(item => item.w === 40 && item.h === 40));
  for (const [group, items] of groups) {
    assert.equal(items.filter(item => item.type === 'bigcoin').length, group % 6 === 5 ? 1 : 0);
  }
  engine.entities = [];
  const target = bigCoins[0];
  engine.world = target.worldX;
  engine.playerY = target.y + target.h + 45;
  engine.collectibles = [target];
  engine.updateWorldCollisions();
  assert.equal(target.collected, true);
  assert.equal(engine.score, 250);
});

test('consecutive timed jumps can collect an entire ribbon in every stage', () => {
  for (let stage = 0; stage < 3; stage++) {
    const engine = new Engine();
    engine.start();
    engine.stage = stage;
    engine.setupStage();
    engine.entities = [];
    engine.collectibles = engine.collectibles.filter(item => item.id.startsWith(`c-${stage}-0-`));
    engine.world = 480;
    engine.jump();
    let secondJump = false;
    advance(engine, 1.8, () => {
      if (!secondJump && engine.time >= COIN_ARC_INTERVAL) {
        engine.jump();
        secondJump = true;
      }
    });
    assert.equal(engine.collectibles.filter(item => item.collected).length, 14, `stage ${stage + 1}`);
  }
});

test('a well-timed double jump can collect a full straight ribbon', () => {
  const engine = new Engine();
  engine.start();
  engine.entities = [];
  const line = engine.collectibles.filter(item => item.id.startsWith('c-0-1-'));
  engine.collectibles = line;
  engine.world = line[0].worldX - STAGES[0].speed * 0.1;
  engine.jump();
  advance(engine, 1.8, (_engine, frame) => {
    if (frame === Math.round(0.9 * 120)) engine.jump();
  });
  assert.equal(line.length, 14);
  assert.equal(line.filter(item => item.collected).length, 14);
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

test('boss telegraphs, alternates rage attacks, rewards counters and resets phases', () => {
  for (const element of ['fire', 'ice']) {
    const engine = new Engine();
    engine.start(element);
    engine.stage = 2;
    engine.setupStage();
    engine.beginBoss();
    engine.updateBoss(0.7);
    assert.ok(engine.boss.attackTimer <= 0.8);
    assert.equal(engine.enemyProjectiles.length, 0);
    engine.projectiles = [{ ...engine.bossRect(), life: 1, vx: 0 }];
    engine.updateBoss(0.01);
    assert.equal(engine.boss.hp, 25.5);
    engine.boss.attackTimer = 0;
    engine.projectiles = [{ ...engine.bossRect(), life: 1, vx: 0 }];
    engine.updateBoss(0.01);
    assert.equal(engine.boss.hp, 23.5);
    assert.equal(engine.boss.recovery, 0.85);
    assert.equal(engine.boss.attackTimer, 2.35);
    engine.boss.hp = 13;
    engine.boss.attackCount = 0;
    engine.boss.attackTimer = 0;
    engine.updateBoss(0.01);
    assert.equal(engine.boss.enraged, true);
    const wave = engine.enemyProjectiles.find(shot => shot.groundWave);
    assert.equal(wave.groundWave, true);
    assert.equal(wave.y + wave.h, GROUND);
    assert.equal(wave.vy, 0);
    assert.equal(wave.vx, -490);
    assert.equal(engine.boss.attackTimer, 1.9);
    engine.enemyProjectiles = [{ ...wave, x: PLAYER_X, hit: false }];
    engine.playerY = GROUND - 100;
    engine.updateProjectiles(0.001);
    assert.equal(engine.hp, 5);
    engine.playerY = GROUND;
    engine.updateProjectiles(0.001);
    assert.equal(engine.hp, 4);
    engine.boss.attackTimer = 0;
    engine.updateBoss(0.01);
    assert.equal(engine.enemyProjectiles.at(-1).groundWave, false);
    engine.respawn();
    assert.equal(engine.boss.enraged, false);
    assert.equal(engine.boss.recovery, 0);
    assert.equal(engine.boss.attackCount, 0);
    assert.equal(engine.boss.hp, 26);
  }
});

test('giant bear has thirty percent more health', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  assert.equal(BOSS_MAX_HP, 26);
  assert.equal(engine.boss.hp, 26);
  assert.equal(engine.boss.maxHp, 26);
});

test('bear fires at all three distinct heights without steering shots back toward the ground', () => {
  const engine = new Engine();
  engine.start();
  engine.stage = 2;
  engine.setupStage();
  engine.mode = 'boss-fight';
  engine.boss.active = true;
  engine.boss.attackTimer = 0;
  const seen = new Set();
  for (let volley = 0; volley < 4; volley++) {
    const preview = [...engine.upcomingBossLanes()];
    engine.enemyProjectiles = [];
    engine.boss.attackTimer = 0;
    engine.updateBoss(1 / 120);
    assert.deepEqual(engine.enemyProjectiles.map(shot => shot.lane), preview);
    assert.ok(preview.length < 3, 'never block every lane');
    for (const shot of engine.enemyProjectiles) {
      seen.add(shot.lane);
      assert.equal(shot.y + shot.h / 2, BOSS_LANES[shot.lane]);
      assert.equal(shot.vx, -430);
      assert.equal(shot.vy, 0);
      const y = shot.y;
      engine.playerY = GROUND;
      engine.updateProjectiles(0.05);
      assert.equal(shot.y, y);
    }
  }
  assert.equal(seen.size, 3);
  engine.boss.hp = 13;
  for (let volley = 0; volley < 3; volley++) {
    engine.enemyProjectiles = [];
    engine.boss.attackTimer = 0;
    engine.updateBoss(0.01);
    assert.equal(engine.enemyProjectiles.length, 2);
    assert.ok(engine.enemyProjectiles.every(shot => shot.vx === -490));
  }
});

test('each boss lane damages its matching height; boss defeat on death is not a checkpoint', () => {
  for (const [lane, center] of Object.entries(BOSS_LANES)) {
    const engine = new Engine();
    engine.start();
    engine.stage = 2;
    engine.score = 900;
    engine.setupStage();
    engine.beginBoss();
    engine.enemyProjectiles = [{ x: PLAYER_X, y: center - 12, w: 58, h: 24, vx: 0, vy: 0, life: 2, hit: false, lane }];
    engine.playerY = lane === 'low' ? GROUND : center + 29;
    engine.updateProjectiles(0.01);
    assert.equal(engine.hp, 4, lane);
    engine.score = 1800;
    engine.hp = 1;
    engine.invulnerable = 0;
    engine.damage('test');
    advance(engine, 1.2);
    assert.equal(engine.stage, 2);
    assert.equal(engine.mode, 'running');
    assert.ok(engine.world < 50);
    assert.equal(engine.score, 900);
    assert.equal(engine.boss.active, false);
    assert.equal(engine.boss.hp, BOSS_MAX_HP);
    assert.equal(engine.enemyProjectiles.length, 0);
  }
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
  engine.boss.hp = 0.5;
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
