(function () {
  'use strict';

  const audio = new window.WhiteLionAudio.AudioSystem();
  let ui = null;
  const engine = new window.WhiteLionCore.Engine((type, snapshot, detail) => {
    if (ui) ui.onEvent(type, snapshot, detail);
    audio.play(type, detail);
    if (['pause', 'stage-clear', 'victory', 'title', 'knockout'].includes(type)) audio.pauseMusic();
    if (type === 'start' || type === 'stage-start') audio.startMusic(snapshot.stage, true);
    if (type === 'resume' || type === 'respawn') audio.startMusic(snapshot.stage);
  });
  ui = new window.WhiteLionUI.GameUI(engine);
  const renderer = new window.WhiteLionArt.Renderer(document.querySelector('#game'), engine);
  window.gameEngine = engine;
  let selectedElement = 'fire';
  let lastTime = performance.now();
  let hudClock = 0;

  function chooseElement(element) {
    selectedElement = element === 'ice' ? 'ice' : 'fire';
    document.querySelectorAll('.element-card').forEach((button) => {
      const selected = button.dataset.element === selectedElement;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    document.querySelector('#element-label').textContent = selectedElement === 'fire' ? '불꽃의 힘' : '서리의 힘';
  }

  async function startGame() {
    await audio.ensure();
    engine.start(selectedElement);
  }

  async function performJump() {
    await audio.ensure();
    engine.jump();
  }

  async function performAttack() {
    await audio.ensure();
    engine.attack();
  }

  async function togglePause() {
    if (engine.mode === 'paused') {
      await audio.ensure();
      engine.resume();
    } else {
      engine.pause();
    }
  }

  function returnToTitle() {
    engine.returnToTitle();
    audio.pauseMusic();
  }

  document.querySelectorAll('.element-card').forEach((button) => button.addEventListener('click', () => chooseElement(button.dataset.element)));
  document.querySelector('#start-button').addEventListener('click', startGame);
  document.querySelector('#pause-button').addEventListener('click', togglePause);
  document.querySelector('#continue-button').addEventListener('click', togglePause);
  document.querySelector('#restart-button').addEventListener('click', returnToTitle);
  document.querySelector('#end-button').addEventListener('click', returnToTitle);
  document.querySelector('#result-exit').addEventListener('click', returnToTitle);
  document.querySelector('#result-action').addEventListener('click', async (event) => {
    if (event.currentTarget.dataset.action === 'next') {
      await audio.ensure();
      engine.nextStage();
    } else {
      returnToTitle();
    }
  });

  const jumpButton = document.querySelector('#touch-jump');
  const attackButton = document.querySelector('#touch-attack');
  jumpButton.addEventListener('pointerdown', (event) => { event.preventDefault(); performJump(); });
  attackButton.addEventListener('pointerdown', (event) => { event.preventDefault(); performAttack(); });

  const settingsDialog = document.querySelector('#settings-dialog');
  document.querySelector('#settings-open').addEventListener('click', () => {
    if (engine.mode === 'running' || engine.mode === 'boss-fight') engine.pause();
    settingsDialog.showModal();
  });
  function closeSettings() { settingsDialog.close(); }
  document.querySelector('#settings-close').addEventListener('click', closeSettings);
  document.querySelector('#settings-done').addEventListener('click', closeSettings);

  const volume = document.querySelector('#volume');
  volume.addEventListener('input', () => {
    engine.volume = Number(volume.value) / 100;
    audio.setVolume(engine.volume);
    document.querySelector('#volume-value').textContent = `${volume.value}%`;
  });
  document.querySelector('#reduced-motion').addEventListener('change', (event) => { engine.reducedMotion = event.currentTarget.checked; });

  const soundToggle = document.querySelector('#sound-toggle');
  soundToggle.addEventListener('click', async () => {
    await audio.ensure();
    audio.setMuted(!audio.muted);
    soundToggle.setAttribute('aria-pressed', String(!audio.muted));
    soundToggle.setAttribute('aria-label', audio.muted ? '소리 켜기' : '소리 끄기');
    soundToggle.textContent = audio.muted ? '×' : '♪';
  });

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLElement && event.target.matches('button, input')) return;
    const gameplayKeys = ['Space', 'ArrowUp', 'KeyW', 'KeyX', 'KeyJ'];
    const gameHasFocus = document.activeElement === document.querySelector('#game');
    if (gameHasFocus && gameplayKeys.includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    if (event.code === 'Space' || event.code === 'ArrowUp' || event.code === 'KeyW') performJump();
    if (event.code === 'KeyX' || event.code === 'KeyJ') performAttack();
    if (event.code === 'KeyP') togglePause();
    if (event.code === 'Escape') {
      if (settingsDialog.open) closeSettings();
      else togglePause();
    }
    if (event.code === 'KeyM') soundToggle.click();
  }, { passive: false });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (engine.mode === 'running' || engine.mode === 'boss-fight')) engine.pause();
  });

  function frame(time) {
    const dt = Math.min(0.05, Math.max(0, (time - lastTime) / 1000));
    lastTime = time;
    engine.update(dt);
    renderer.render();
    hudClock += dt;
    if (hudClock >= 0.08) {
      hudClock = 0;
      ui.render(engine.snapshot());
    }
    requestAnimationFrame(frame);
  }

  chooseElement('fire');
  ui.render(engine.snapshot());
  renderer.render();
  requestAnimationFrame(frame);
})();
