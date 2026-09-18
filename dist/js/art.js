(function (root) {
  'use strict';

  const ASSET = 'assets/';
  const backgrounds = [
    'stage-1-desert-bg-2026-09-10-v01.png',
    'stage-2-temple-bg-2026-09-10-v01.png',
    'stage-3-jungle-bg-2026-09-10-v01.png'
  ];

  function loadImage(source, process) {
    const image = new Image();
    image.src = ASSET + source;
    image.onload = () => process ? process(image) : image;
    return image;
  }

  function keyedCanvas(image, key) {
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      const r = pixels.data[i];
      const g = pixels.data[i + 1];
      const b = pixels.data[i + 2];
      if (key === 'gray') {
        const light = Math.max(r, g, b);
        const dark = Math.min(r, g, b);
        if (light - dark <= 9 && r >= 95 && r <= 232) pixels.data[i + 3] = 0;
      } else if (r > 205 && g < 100 && b > 165) {
        pixels.data[i + 3] = 0;
      }
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  class Renderer {
    constructor(canvas, engine) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.engine = engine;
      this.backgrounds = backgrounds.map((name) => loadImage(name));
      this.lion = null;
      this.villains = null;
      this.bear = loadImage('giant-bear-boss-spritesheet-2026-09-11-v01.png');
      loadImage('white-lion-run-spritesheet-2026-09-10-v01.png', (image) => { this.lion = keyedCanvas(image, 'gray'); });
      loadImage('villain-spritesheet-2026-09-10-v01.png', (image) => { this.villains = keyedCanvas(image, 'magenta'); });
    }

    drawBackground() {
      const { ctx, engine } = this;
      const bg = this.backgrounds[engine.stage];
      const ground = root.WhiteLionCore.GROUND;
      const travel = engine.world * (0.024 + engine.stage * 0.008);
      const tileIndex = Math.floor(travel / 960);
      const offset = -Math.floor(travel % 960);
      if (bg && bg.complete && bg.naturalWidth) {
        for (let index = 0; index < 2; index += 1) {
          const x = offset + index * 960;
          const mirrored = engine.stage === 0 && (tileIndex + index) % 2 !== 0;
          if (!mirrored) {
            ctx.drawImage(bg, x, 0, 960, ground);
          } else {
            ctx.save();
            ctx.translate(x + 960, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(bg, 0, 0, 960, ground);
            ctx.restore();
          }
        }
      } else {
        ctx.fillStyle = ['#dc9d4a', '#581c3e', '#164c35'][engine.stage];
        ctx.fillRect(0, 0, 960, ground);
      }
      ctx.fillStyle = ['rgba(255,171,54,.08)', 'rgba(45,5,39,.2)', 'rgba(1,42,27,.12)'][engine.stage];
      ctx.fillRect(0, 0, 960, ground);
      ctx.fillStyle = ['#8c4c26', '#49152e', '#153c2a'][engine.stage];
      ctx.fillRect(0, ground, 960, 84);
      ctx.fillStyle = ['#ffc35e', '#d76a4b', '#54a86b'][engine.stage];
      ctx.fillRect(0, ground, 960, 5);
      ctx.fillStyle = ['#633119', '#2c1022', '#0b281d'][engine.stage];
      for (let x = -((engine.world * 0.55) % 56); x < 960; x += 56) ctx.fillRect(x, ground + 30, 34, 5);
    }

    drawCheckpoint() {
      const { ctx, engine } = this;
      const cfg = root.WhiteLionCore.STAGES[engine.stage];
      const next = (Math.floor(engine.world / 2500) + 1) * 2500;
      const finish = engine.stage === 2 ? cfg.bossStart * 10 : cfg.length * 10;
      if (next >= finish) return;
      const x = root.WhiteLionCore.PLAYER_X + next - engine.world;
      if (x < -30 || x > 990) return;
      ctx.fillStyle = '#fff0bc';
      ctx.fillRect(x, 300, 4, 96);
      ctx.fillStyle = engine.element === 'fire' ? '#ff6b35' : '#42d8ff';
      ctx.fillRect(x + 4, 304, 44, 24);
    }

    drawCollectible(item) {
      const { ctx, engine } = this;
      const rect = engine.collectibleRect(item);
      if (rect.x < -50 || rect.x > 1010) return;
      ctx.save();
      const bob = Math.round(Math.sin(engine.time * 5 + item.worldX) * 2);
      ctx.translate(Math.round(rect.x) + 14, Math.round(rect.y) + 14 + bob);
      if (item.type === 'coin') {
        ctx.fillStyle = '#3a200f';
        ctx.fillRect(-8, -14, 16, 2);
        ctx.fillRect(-12, -12, 24, 2);
        ctx.fillRect(-14, -8, 28, 16);
        ctx.fillRect(-12, 8, 24, 4);
        ctx.fillRect(-8, 12, 16, 2);

        ctx.fillStyle = '#e28a00';
        ctx.fillRect(-10, -10, 20, 20);
        ctx.fillRect(-12, -6, 24, 12);
        ctx.fillStyle = '#ffc928';
        ctx.fillRect(-8, -10, 16, 18);
        ctx.fillRect(-10, -6, 20, 12);
        ctx.fillStyle = '#f3a90c';
        ctx.fillRect(-10, 6, 20, 2);
        ctx.fillRect(-8, 8, 16, 2);

        ctx.fillStyle = '#fff2a1';
        ctx.fillRect(-8, -8, 4, 8);
        ctx.fillRect(-6, -10, 8, 2);
        ctx.fillRect(6, -6, 2, 6);

        ctx.fillStyle = '#f29a00';
        ctx.fillRect(-1, -8, 3, 16);
        ctx.fillRect(-5, -7, 9, 3);
        ctx.fillRect(-6, -6, 3, 6);
        ctx.fillRect(-5, -1, 10, 3);
        ctx.fillRect(3, 1, 3, 6);
        ctx.fillRect(-4, 5, 9, 3);
      } else if (item.type === 'steak') {
        ctx.rotate(-0.12 + Math.sin(engine.time * 3 + item.worldX) * 0.025);
        ctx.scale(1.18, 1.18);

        ctx.fillStyle = '#3b1711';
        ctx.fillRect(-18, -12, 24, 2);
        ctx.fillRect(-22, -10, 34, 2);
        ctx.fillRect(-24, -8, 40, 14);
        ctx.fillRect(-22, 6, 38, 8);
        ctx.fillRect(-16, 14, 28, 2);
        ctx.fillStyle = '#8f3d15';
        ctx.fillRect(-20, 3, 36, 9);
        ctx.fillRect(-16, 12, 28, 2);
        ctx.fillStyle = '#c96322';
        ctx.fillRect(-17, 4, 8, 8);
        ctx.fillRect(-7, 5, 11, 8);
        ctx.fillStyle = '#ffd0a3';
        ctx.fillRect(-20, -8, 34, 4);
        ctx.fillRect(-22, -4, 38, 8);
        ctx.fillRect(-18, 4, 32, 4);
        ctx.fillStyle = '#c43f4b';
        ctx.fillRect(-17, -6, 27, 10);
        ctx.fillRect(-13, 4, 22, 2);
        ctx.fillStyle = '#ef6870';
        ctx.fillRect(-16, -5, 8, 2);
        ctx.fillRect(-18, -3, 11, 4);
        ctx.fillRect(-15, 1, 7, 2);
        ctx.fillStyle = '#e45a64';
        ctx.fillRect(-2, -6, 11, 2);
        ctx.fillRect(-4, -4, 16, 5);
        ctx.fillRect(0, 1, 11, 2);
        ctx.fillStyle = '#dc4b58';
        ctx.fillRect(-8, 1, 9, 2);
        ctx.fillRect(-6, 3, 12, 3);
        ctx.fillRect(-2, 6, 8, 1);
        ctx.fillStyle = '#9e2838';
        ctx.fillRect(-17, 2, 8, 2);
        ctx.fillRect(7, -2, 5, 4);
        ctx.fillRect(-3, 5, 7, 2);
      } else {
        ctx.rotate(-0.55 + Math.sin(engine.time * 3 + item.worldX) * 0.04);
        ctx.scale(1.16, 1.16);

        ctx.fillStyle = '#5b2417';
        ctx.fillRect(-20, -4, 20, 9);
        ctx.fillRect(-24, -8, 7, 7);
        ctx.fillRect(-24, 3, 7, 7);
        ctx.fillStyle = '#ffe8c5';
        ctx.fillRect(-20, -2, 20, 5);
        ctx.fillRect(-22, -6, 5, 5);
        ctx.fillRect(-22, 3, 5, 5);
        ctx.fillStyle = '#d9b38c';
        ctx.fillRect(-18, 2, 16, 2);

        ctx.fillStyle = '#5b2417';
        ctx.fillRect(-3, -12, 16, 24);
        ctx.fillRect(10, -10, 8, 20);
        ctx.fillRect(16, -7, 5, 14);
        ctx.fillStyle = '#d86a12';
        ctx.fillRect(-1, -10, 14, 20);
        ctx.fillRect(11, -8, 5, 16);
        ctx.fillStyle = '#f49a24';
        ctx.fillRect(1, -9, 12, 16);
        ctx.fillRect(11, -6, 5, 12);
        ctx.fillStyle = '#ffc163';
        ctx.fillRect(1, -8, 5, 10);
        ctx.fillRect(5, -9, 6, 3);
        ctx.fillStyle = '#b9540d';
        ctx.fillRect(4, 6, 8, 2);
        ctx.fillRect(13, 2, 2, 3);
      }
      ctx.restore();
    }

    drawEntity(entity) {
      const { ctx, engine } = this;
      const rect = engine.entityRect(entity);
      if (rect.x < -190 || rect.x > 1050) return;
      if (entity.type === 'rock') {
        ctx.fillStyle = '#342b38'; ctx.fillRect(rect.x, rect.y + 8, rect.w, rect.h - 8);
        ctx.fillStyle = '#7d6878'; ctx.fillRect(rect.x + 8, rect.y, 26, 12); ctx.fillRect(rect.x + 31, rect.y + 20, 13, 8);
      } else if (entity.type === 'ledge') {
        ctx.fillStyle = '#2e2130'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
        ctx.fillStyle = '#cf7f4f'; ctx.fillRect(rect.x, rect.y, rect.w, 7);
        for (let i = 8; i < rect.w; i += 18) ctx.fillRect(rect.x + i, rect.y + 13, 10, 5);
      } else if (entity.type === 'spikes') {
        ctx.fillStyle = '#e6e0c9';
        for (let i = 0; i < 4; i += 1) {
          ctx.beginPath(); ctx.moveTo(rect.x + i * 17, root.WhiteLionCore.GROUND); ctx.lineTo(rect.x + 9 + i * 17, rect.y); ctx.lineTo(rect.x + 18 + i * 17, root.WhiteLionCore.GROUND); ctx.fill();
        }
      } else if (this.villains) {
        const frame = Math.floor(engine.time * 9 + entity.worldX / 10) % 4;
        const sw = this.villains.width / 4;
        const sh = this.villains.height / 2;
        const sy = entity.type === 'ghost' ? sh : 0;
        if (entity.type === 'hyena') {
          ctx.drawImage(this.villains, frame * sw, sy, sw, sh, rect.x - 39, root.WhiteLionCore.GROUND - 147, 176, 149);
        } else {
          ctx.drawImage(this.villains, frame * sw, sy, sw, sh, rect.x - 25, rect.y - 28, 120, 120);
        }
      }
    }

    drawProjectile(projectile) {
      const { ctx, engine } = this;
      const pulse = 1 + Math.sin(engine.time * 18) * 0.12;
      ctx.save();
      ctx.translate(projectile.x, projectile.y + projectile.h / 2);
      ctx.scale(pulse, pulse);
      if (projectile.element === 'fire') {
        ctx.fillStyle = 'rgba(255,87,34,.3)'; ctx.beginPath(); ctx.ellipse(-10, 0, 36, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d93024'; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(2, -13); ctx.lineTo(22, 0); ctx.lineTo(2, 13); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ffbd3d'; ctx.beginPath(); ctx.arc(13, 0, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff0a1'; ctx.beginPath(); ctx.arc(16, -2, 4, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.strokeStyle = 'rgba(116,232,255,.42)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(18, 0); ctx.stroke();
        ctx.fillStyle = '#42d8ff';
        for (let i = 0; i < 3; i += 1) {
          ctx.save(); ctx.rotate((Math.PI * 2 * i) / 3 + engine.time * 5); ctx.fillRect(5, -3, 23, 6); ctx.restore();
        }
        ctx.fillStyle = '#e7fbff'; ctx.fillRect(-5, -5, 10, 10);
      }
      ctx.restore();
    }

    drawBossWave(projectile) {
      const { ctx } = this;
      const angle = Math.atan2(projectile.vy, projectile.vx);
      ctx.save();
      ctx.translate(projectile.x + projectile.w / 2, projectile.y + projectile.h / 2);
      ctx.rotate(angle);
      ctx.translate(-projectile.w / 2, -projectile.h / 2);
      ctx.fillStyle = 'rgba(255,183,70,.24)'; ctx.fillRect(-8, -8, projectile.w + 16, projectile.h + 16);
      ctx.fillStyle = '#4b3327';
      ctx.beginPath(); ctx.moveTo(0, projectile.h / 2); ctx.lineTo(17, 1); ctx.lineTo(31, projectile.h - 3); ctx.lineTo(43, 3); ctx.lineTo(projectile.w, projectile.h / 2); ctx.lineTo(43, projectile.h - 3); ctx.lineTo(26, projectile.h + 2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#f1b84f'; ctx.fillRect(8, projectile.h / 2 - 2, projectile.w - 16, 4);
      ctx.restore();
    }

    drawBoss() {
      const { ctx, engine } = this;
      if (!engine.boss.active || !this.bear) return;
      const frame = Math.floor(engine.time * 7) % 4;
      const sw = this.bear.naturalWidth / 4;
      ctx.save();
      ctx.globalAlpha = engine.boss.opacity;
      ctx.drawImage(this.bear, frame * sw + 8, 150, sw - 16, 370, engine.boss.x - 92, root.WhiteLionCore.GROUND - 249, 350, 246);
      ctx.restore();
    }

    drawLion() {
      const { ctx, engine } = this;
      const x = root.WhiteLionCore.PLAYER_X + 1;
      const y = engine.playerY;
      ctx.save();
      ctx.globalAlpha = engine.invulnerable > 0 && Math.floor(engine.invulnerable * 14) % 2 ? 0.32 : 1;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.ellipse(x + 30, root.WhiteLionCore.GROUND + 4, y >= root.WhiteLionCore.GROUND ? 45 : 29, 7, 0, 0, Math.PI * 2); ctx.fill();
      if (this.lion) {
        const grounded = y >= root.WhiteLionCore.GROUND - 0.1;
        const frame = grounded ? Math.floor(engine.time * 12) % 6 : engine.vy < 0 ? 2 : 5;
        const sw = this.lion.width / 3;
        const sh = this.lion.height / 2;
        ctx.drawImage(this.lion, (frame % 3) * sw, Math.floor(frame / 3) * sh, sw, sh, x - 52, y - 111, 156, 118);
      } else {
        ctx.fillStyle = '#fff5dc'; ctx.fillRect(x, y - 54, 68, 54);
      }
      ctx.restore();
    }

    drawParticles() {
      const { ctx, engine } = this;
      for (const particle of engine.particles) {
        ctx.globalAlpha = Math.max(0, particle.life * 2);
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
      }
      ctx.globalAlpha = 1;
    }

    render() {
      const { ctx, engine } = this;
      ctx.clearRect(0, 0, 960, 480);
      ctx.imageSmoothingEnabled = false;
      this.drawBackground();
      this.drawCheckpoint();
      for (const item of engine.collectibles) if (!item.collected) this.drawCollectible(item);
      for (const entity of engine.entities) if (!entity.removed) this.drawEntity(entity);
      for (const projectile of engine.enemyProjectiles) this.drawBossWave(projectile);
      this.drawBoss();
      for (const projectile of engine.projectiles) this.drawProjectile(projectile);
      this.drawLion();
      this.drawParticles();
    }
  }

  root.WhiteLionArt = { Renderer, keyedCanvas };
})(window);
