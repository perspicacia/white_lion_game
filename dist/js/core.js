(function (root) {
  'use strict';

  const GROUND = 396;
  const PLAYER_X = 146;
  const PLAYER_W = 68;
  const PLAYER_H = 54;
  const MAX_HP = 5;
  const BOSS_MAX_HP = 26;
  const JUMP_VELOCITY = -720;
  const GRAVITY = 1800;
  const ITEM_Y = 214;
  const COIN_ARC_INTERVAL = 0.95;
  const BOSS_LANES = { low: GROUND - 12, middle: GROUND - 112, high: GROUND - 212 };
  const BOSS_PATTERNS = [['middle'], ['low'], ['high'], ['low', 'high']];
  const BOSS_RAGE_PATTERNS = [['low', 'middle'], ['middle', 'high'], ['low', 'high']];

  const STAGES = [
    { id: 1, name: '황금빛 사막', length: 1685, speed: 295, background: 'desert' },
    { id: 2, name: '붉은 신전', length: 2035, speed: 345, background: 'temple' },
    { id: 3, name: '태양의 밀림', length: 2420, bossStart: 2220, speed: 390, background: 'jungle' }
  ];

  const ENTITY_SIZE = {
    sandstone: { w: 54, h: 44 },
    cactus: { w: 48, h: 62 },
    dune: { w: 82, h: 32 },
    altar: { w: 74, h: 42 },
    spears: { w: 64, h: 60 },
    pillar: { w: 50, h: 72 },
    log: { w: 90, h: 40 },
    thorns: { w: 76, h: 52 },
    roots: { w: 64, h: 66 },
    rock: { w: 52, h: 48 },
    ledge: { w: 72, h: 30 },
    spikes: { w: 68, h: 26 },
    hyena: { w: 92, h: 72 },
    ghost: { w: 68, h: 66 },
    cobra: { w: 110, h: 76 }
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function stagePatterns(stageIndex) {
    if (stageIndex === 0) return ['sandstone', 'hyena', 'dune', 'cactus', 'hyena', 'sandstone'];
    if (stageIndex === 1) return ['altar', 'ghost', 'pillar', 'hyena', 'spears', 'ghost', 'altar'];
    return ['hyena', 'thorns', 'ghost', 'log', 'cobra', 'roots', 'ghost', 'hyena', 'cobra', 'thorns'];
  }

  function isEnemy(type) {
    return type === 'hyena' || type === 'ghost' || type === 'cobra';
  }

  function isHealingFood(type) {
    return type === 'food' || type === 'steak';
  }

  class Engine {
    constructor(onEvent = () => {}) {
      this.onEvent = onEvent;
      this.volume = 0.55;
      this.reducedMotion = false;
      this.element = 'fire';
      this.resetToTitle();
    }

    resetToTitle() {
      this.stage = 0;
      this.hp = MAX_HP;
      this.score = 0;
      this.deaths = 0;
      this.mode = 'ready';
      this.pausedFrom = 'running';
      this.setupStage();
      this.emit('ready');
    }

    setupStage() {
      this.world = 0;
      this.stageStartScore = this.score;
      this.combo = 0;
      this.runStats = { bestCombo: 0, bonus: 0, pickups: 0, enemies: 0 };
      this.playerY = GROUND;
      this.vy = 0;
      this.jumpsUsed = 0;
      this.invulnerable = 0;
      this.attackCooldown = 0;
      this.attackTimer = 0;
      this.time = 0;
      this.deadTimer = 0;
      this.entities = this.makeEntities();
      this.collectibles = this.makeCollectibles();
      this.projectiles = [];
      this.enemyProjectiles = [];
      this.particles = [];
      this.boss = {
        active: false,
        hp: BOSS_MAX_HP,
        maxHp: BOSS_MAX_HP,
        x: 704,
        movementTime: 0,
        y: GROUND,
        attackTimer: 1.8,
        recovery: 0,
        attackCount: 0,
        enraged: false,
        opacity: 1,
        fadeTimer: 0
      };
    }

    makeEntities() {
      const cfg = STAGES[this.stage];
      const types = stagePatterns(this.stage);
      const stopMeters = this.stage === 2 ? cfg.bossStart - 70 : cfg.length - 45;
      const spacing = [560, 490, 430][this.stage];
      const entities = [];
      for (let i = 0, worldX = 1050; worldX < stopMeters * 10; i += 1, worldX += spacing + (i % 3) * 68) {
        const type = types[i % types.length];
        const size = ENTITY_SIZE[type];
        entities.push({ id: `e-${this.stage}-${i}`, type, worldX, w: size.w, h: size.h, removed: false, hit: false });
      }
      return entities;
    }

    makeCollectibles() {
      const cfg = STAGES[this.stage];
      const stopMeters = this.stage === 2 ? cfg.bossStart - 35 : cfg.length - 25;
      const items = [];
      for (let group = 0, start = 480; start < stopMeters * 10; group += 1) {
        const arcs = group % 3 === 2 ? 3 : 2;
        const foodSlot = group % 5 === 4;
        const straightLine = group % 2 === 1;
        const bigCoinSlot = group % 6 === 5;
        // Alternate jump-shaped arches with horizontal ribbons. Both remain airborne.
        for (let arc = 0; arc < arcs; arc += 1) {
          for (let coin = 0; coin < 7; coin += 1) {
            const t = 0.1 + coin * 0.1;
            const food = foodSlot && arc === arcs - 1 && coin === 3;
            const bigCoin = !food && bigCoinSlot && arc === arcs - 1 && coin === 3;
            const type = food ? (Math.floor(group / 5) % 2 === 0 ? 'food' : 'steak') : bigCoin ? 'bigcoin' : 'coin';
            const size = bigCoin ? 40 : 28;
            const worldX = start + cfg.speed * (arc * COIN_ARC_INTERVAL + t) + PLAYER_W / 2 - size / 2;
            if (worldX + size >= stopMeters * 10) continue;
            const pathY = straightLine ? ITEM_Y + 34 : Math.max(ITEM_Y, GROUND + JUMP_VELOCITY * t + GRAVITY * t * t / 2 - 43);
            items.push({
              id: `c-${this.stage}-${group}-${arc * 7 + coin}`,
              type,
              pattern: straightLine ? 'line' : 'arc',
              worldX,
              y: pathY - (size - 28) / 2,
              w: size, h: size, collected: false
            });
          }
        }
        start += cfg.speed * (arcs * COIN_ARC_INTERVAL + 0.3);
      }
      return items;
    }

    start(element = this.element) {
      this.element = element === 'ice' ? 'ice' : 'fire';
      this.stage = 0;
      this.hp = MAX_HP;
      this.score = 0;
      this.deaths = 0;
      this.setupStage();
      this.mode = 'running';
      this.emit('start');
    }

    returnToTitle() {
      this.resetToTitle();
      this.emit('title');
    }

    pause() {
      if (this.mode !== 'running' && this.mode !== 'boss-fight') return false;
      this.pausedFrom = this.mode;
      this.mode = 'paused';
      this.emit('pause');
      return true;
    }

    resume() {
      if (this.mode !== 'paused') return false;
      this.mode = this.pausedFrom;
      this.emit('resume');
      return true;
    }

    jump() {
      if (this.mode !== 'running' && this.mode !== 'boss-fight') return false;
      if (this.jumpsUsed >= 2) return false;
      this.vy = this.jumpsUsed === 0 ? JUMP_VELOCITY : JUMP_VELOCITY * 0.92;
      this.jumpsUsed += 1;
      this.emit(this.jumpsUsed === 2 ? 'double-jump' : 'jump');
      return true;
    }

    attack() {
      if ((this.mode !== 'running' && this.mode !== 'boss-fight') || this.attackCooldown > 0) return false;
      this.attackCooldown = 0.3;
      this.attackTimer = 0.22;
      this.projectiles.push({
        x: PLAYER_X + 56,
        y: this.playerY - 43,
        w: 36,
        h: 22,
        vx: 690,
        life: 1.25,
        element: this.element
      });
      this.emit(this.element === 'fire' ? 'fire-attack' : 'ice-attack');
      return true;
    }

    nextStage() {
      if (this.mode !== 'stage-clear' || this.stage >= STAGES.length - 1) return false;
      this.stage += 1;
      this.hp = MAX_HP;
      this.setupStage();
      this.mode = 'running';
      this.emit('stage-start');
      return true;
    }

    playerRect() {
      return { x: PLAYER_X, y: this.playerY - PLAYER_H, w: PLAYER_W, h: PLAYER_H - 4 };
    }

    entityRect(entity) {
      const float = entity.type === 'ghost' ? 76 + Math.sin(this.time * 3.6 + entity.worldX) * 18 : 0;
      const screenX = PLAYER_X + entity.worldX - this.world;
      // The snake stays raised after it notices the lion; it does not shrink again on contact.
      // Let the whole posture unfold over the approach instead of popping upright near contact.
      const cobraRiseRaw = entity.type === 'cobra' ? clamp((860 - screenX) / 560, 0, 1) : 0;
      const cobraRise = cobraRiseRaw ** 3 * (cobraRiseRaw * (cobraRiseRaw * 6 - 15) + 10);
      const height = entity.h + cobraRise * 60;
      return {
        x: screenX,
        y: GROUND - height - float,
        w: entity.w,
        h: height
      };
    }

    collectibleRect(item) {
      return { x: PLAYER_X + item.worldX - this.world, y: item.y + Math.sin(this.time * 4 + item.worldX) * 5, w: item.w, h: item.h };
    }

    bossRect() {
      return { x: this.boss.x, y: this.boss.y - 188, w: 205, h: 188 };
    }

    emit(type, detail = {}) {
      this.onEvent(type, this.snapshot(), detail);
    }

    snapshot() {
      const cfg = STAGES[this.stage];
      return {
        mode: this.mode,
        stage: this.stage,
        stageName: cfg.name,
        hp: this.hp,
        maxHp: MAX_HP,
        distance: Math.floor(this.world / 10),
        length: cfg.length,
        score: this.score,
        combo: this.combo,
        multiplier: this.comboMultiplier(),
        runStats: { ...this.runStats },
        element: this.element,
        deaths: this.deaths,
        bossHp: this.boss.hp,
        bossMaxHp: this.boss.maxHp,
        volume: this.volume,
        reducedMotion: this.reducedMotion,
        jumpsRemaining: 2 - this.jumpsUsed
      };
    }

    comboMultiplier() {
      return this.combo >= 10 ? 3 : this.combo >= 5 ? 2 : 1;
    }

    reward(basePoints, category) {
      const previousMultiplier = this.comboMultiplier();
      this.combo += 1;
      const multiplier = this.comboMultiplier();
      const points = basePoints * multiplier;
      this.score += points;
      this.runStats.bestCombo = Math.max(this.runStats.bestCombo, this.combo);
      this.runStats.bonus += points - basePoints;
      this.runStats[category] += 1;
      if (multiplier > previousMultiplier) this.emit('combo-up', { multiplier });
      return points;
    }

    burst(x, y, color, count = 10) {
      if (this.reducedMotion) return;
      for (let i = 0; i < count; i += 1) {
        const angle = (Math.PI * 2 * i) / count + (i % 2) * 0.2;
        this.particles.push({ x, y, vx: Math.cos(angle) * (80 + i * 6), vy: Math.sin(angle) * 90 - 50, life: 0.5, size: 3 + (i % 3), color });
      }
    }

    damage(source = 'collision') {
      if ((this.mode !== 'running' && this.mode !== 'boss-fight') || this.invulnerable > 0) return false;
      this.hp -= 1;
      this.combo = 0;
      this.invulnerable = 1.25;
      this.burst(PLAYER_X + 34, this.playerY - 32, '#fff2b2', 12);
      this.emit('hit', { source });
      if (this.hp <= 0) {
        this.hp = 0;
        this.pausedFrom = this.mode;
        this.mode = 'dying';
        this.deadTimer = 1.1;
        this.deaths += 1;
        this.emit('knockout', { source });
      }
      return true;
    }

    respawn() {
      // Discard this failed stage's rewards so retries cannot farm the same ribbon.
      this.score = this.stageStartScore;
      this.setupStage();
      this.hp = MAX_HP;
      this.invulnerable = 2;
      this.mode = 'running';
      this.emit('respawn');
    }

    updatePlayer(dt) {
      this.vy += GRAVITY * dt;
      this.playerY += this.vy * dt;
      if (this.playerY >= GROUND) {
        this.playerY = GROUND;
        this.vy = 0;
        this.jumpsUsed = 0;
      }
    }

    updateParticles(dt) {
      for (const particle of this.particles) {
        particle.life -= dt;
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        particle.vy += 280 * dt;
      }
      this.particles = this.particles.filter((particle) => particle.life > 0);
    }

    updateProjectiles(dt) {
      for (const projectile of this.projectiles) {
        projectile.x += projectile.vx * dt;
        projectile.life -= dt;
      }
      this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0 && projectile.x < 1020);
      for (const projectile of this.enemyProjectiles) {
        projectile.x += projectile.vx * dt;
        projectile.y += projectile.vy * dt;
        projectile.life -= dt;
        if (!projectile.hit && overlaps(this.playerRect(), projectile)) {
          projectile.hit = true;
          this.damage('boss-wave');
        }
      }
      this.enemyProjectiles = this.enemyProjectiles.filter((projectile) => projectile.life > 0 && projectile.x > -100 && !projectile.hit);
    }

    updateWorldCollisions() {
      const player = this.playerRect();
      for (const item of this.collectibles) {
        if (item.collected) continue;
        const rect = this.collectibleRect(item);
        if (overlaps(player, rect)) {
          item.collected = true;
          const healingFood = isHealingFood(item.type);
          const points = this.reward(healingFood ? 120 : item.type === 'bigcoin' ? 250 : 50, 'pickups');
          if (healingFood) this.hp = Math.min(MAX_HP, this.hp + 1);
          const burstColor = item.type === 'steak' ? '#e85b43' : healingFood ? '#ff7f66' : '#ffd44d';
          this.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, burstColor, item.type === 'bigcoin' ? 14 : 8);
          this.emit(healingFood ? item.type : item.type === 'bigcoin' ? 'bigcoin' : 'coin', { points });
        }
      }

      for (const entity of this.entities) {
        if (entity.removed) continue;
        const rect = this.entityRect(entity);
        if (rect.x > 1050 || rect.x + rect.w < -80) continue;
        if (isEnemy(entity.type)) {
          for (const projectile of this.projectiles) {
            if (projectile.life <= 0 || !overlaps(projectile, rect)) continue;
            projectile.life = 0;
            entity.removed = true;
            const enemyPoints = { hyena: 140, ghost: 180, cobra: 220 };
            const points = this.reward(enemyPoints[entity.type], 'enemies');
            this.burst(rect.x + rect.w / 2, rect.y + rect.h / 2, this.element === 'fire' ? '#ff7b32' : '#7de7ff', 14);
            this.emit('enemy-defeated', { enemy: entity.type, element: this.element, points });
            break;
          }
        }
        if (!entity.removed && !entity.hit && overlaps(player, { x: rect.x + 7, y: rect.y + 6, w: rect.w - 14, h: rect.h - 7 })) {
          if (this.damage(entity.type)) entity.hit = true;
          if (this.mode === 'dying') return;
        }
      }
      this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
    }

    beginBoss() {
      const cfg = STAGES[this.stage];
      this.world = cfg.bossStart * 10;
      this.combo = 0;
      this.boss.active = true;
      this.boss.recovery = 0;
      this.boss.attackCount = 0;
      this.boss.enraged = false;
      this.boss.x = 704;
      this.boss.movementTime = 0;
      this.boss.attackTimer = 1.4;
      this.mode = 'boss-fight';
      this.emit('boss-start');
    }

    upcomingBossLanes() {
      const patterns = this.boss.hp <= this.boss.maxHp / 2 ? BOSS_RAGE_PATTERNS : BOSS_PATTERNS;
      return patterns[this.boss.attackCount % patterns.length];
    }

    updateBoss(dt) {
      // Ease forward and back while keeping the visible bear safely away from the cub.
      this.boss.movementTime += dt;
      const advance = (1 - Math.cos(this.boss.movementTime * Math.PI * 2 / 4.8)) / 2;
      this.boss.x = 704 - 144 * advance;
      const bossRect = this.bossRect();
      this.boss.enraged = this.boss.hp <= this.boss.maxHp / 2;
      this.boss.recovery = Math.max(0, this.boss.recovery - dt);
      this.boss.attackTimer -= dt;
      if (this.boss.attackTimer <= 0) {
        this.boss.attackTimer = this.boss.enraged ? 1.9 : 2.35;
        this.boss.recovery = 0.85;
        const lanes = this.upcomingBossLanes();
        this.boss.attackCount += 1;
        const w = 58;
        const h = 24;
        const x = bossRect.x + 10;
        const speed = this.boss.enraged ? 490 : 430;
        for (const lane of lanes) {
          this.enemyProjectiles.push({
            x, y: BOSS_LANES[lane] - h / 2, w, h,
            vx: -speed, vy: 0, lane, groundWave: lane === 'low', life: 2.2, hit: false
          });
        }
        this.emit('boss-attack', { lanes: [...lanes] });
      }
      for (const projectile of this.projectiles) {
        if (projectile.life <= 0 || !overlaps(projectile, bossRect)) continue;
        projectile.life = 0;
        // Guarded hits still count, but well-timed counterattacks are stronger.
        this.boss.hp -= this.boss.recovery > 0 ? 2 : 0.5;
        this.score += 120;
        this.burst(bossRect.x + 38, bossRect.y + 72, this.element === 'fire' ? '#ff823b' : '#8feaff', 16);
        this.emit('boss-hit', { hp: this.boss.hp, element: this.element });
        if (this.boss.hp <= 0) {
          this.boss.hp = 0;
          this.boss.fadeTimer = 2;
          this.mode = 'boss-defeated';
          this.enemyProjectiles = [];
          this.score += 1000;
          this.emit('boss-defeated');
          break;
        }
      }
      this.projectiles = this.projectiles.filter((projectile) => projectile.life > 0);
    }

    update(dt) {
      if (!Number.isFinite(dt) || dt <= 0) return;
      dt = Math.min(dt, 0.05);

      if (this.mode === 'dying') {
        this.deadTimer -= dt;
        this.updateParticles(dt);
        if (this.deadTimer <= 0) this.respawn();
        return;
      }

      if (this.mode === 'boss-defeated') {
        this.time += dt;
        this.updateParticles(dt);
        this.boss.fadeTimer -= dt;
        this.boss.opacity = clamp(this.boss.fadeTimer / 2, 0, 1);
        if (this.boss.fadeTimer <= 0) {
          this.boss.opacity = 0;
          this.mode = 'won';
          this.emit('victory');
        }
        return;
      }

      if (this.mode !== 'running' && this.mode !== 'boss-fight') return;

      this.time += dt;
      this.invulnerable = Math.max(0, this.invulnerable - dt);
      this.attackCooldown = Math.max(0, this.attackCooldown - dt);
      this.attackTimer = Math.max(0, this.attackTimer - dt);
      this.updatePlayer(dt);
      this.updateParticles(dt);
      this.updateProjectiles(dt);

      if (this.mode === 'running') {
        const cfg = STAGES[this.stage];
        this.world += cfg.speed * dt;
        this.updateWorldCollisions();
        if (this.mode === 'dying') return;

        if (this.stage === 2 && this.world >= cfg.bossStart * 10) {
          this.beginBoss();
        } else if (this.stage < 2 && this.world >= cfg.length * 10) {
          this.world = cfg.length * 10;
          this.score += 500;
          this.mode = 'stage-clear';
          this.emit('stage-clear');
        }
      }

      if (this.mode === 'boss-fight') this.updateBoss(dt);
    }
  }

  const api = {
    Engine,
    STAGES,
    GROUND,
    PLAYER_X,
    PLAYER_W,
    PLAYER_H,
    MAX_HP,
    BOSS_MAX_HP,
    BOSS_LANES,
    COIN_ARC_INTERVAL,
    JUMP_VELOCITY,
    GRAVITY,
    ITEM_Y,
    overlaps,
    isEnemy,
    isHealingFood
  };

  root.WhiteLionCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
