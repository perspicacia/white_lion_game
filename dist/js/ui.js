(function (root) {
  'use strict';

  class GameUI {
    constructor(engine) {
      this.engine = engine;
      this.ready = document.querySelector('#ready-overlay');
      this.pause = document.querySelector('#pause-overlay');
      this.result = document.querySelector('#result-overlay');
      this.toast = document.querySelector('#toast');
      this.bossHud = document.querySelector('#boss-hud');
      this.toastTimer = 0;
      this.lastMode = '';
    }

    announce(message) {
      const node = document.querySelector('#announcer');
      node.textContent = '';
      root.setTimeout(() => { node.textContent = message; }, 20);
    }

    showToast(message) {
      this.toast.textContent = message;
      this.toast.hidden = false;
      root.clearTimeout(this.toastTimer);
      this.toastTimer = root.setTimeout(() => { this.toast.hidden = true; }, 1700);
    }

    showResult(kind, snapshot) {
      const victory = kind === 'victory';
      document.querySelector('#result-kicker').textContent = victory ? 'ALL CLEAR' : 'STAGE CLEAR';
      document.querySelector('#result-title').textContent = victory ? '밀림을 되찾았어요!' : `${snapshot.stageName} 돌파!`;
      document.querySelector('#result-copy').textContent = victory ? '거대 곰을 물리치고 세 개의 스테이지를 모두 완주했습니다.' : '체력을 회복하고 다음 스테이지로 출발하세요.';
      document.querySelector('#result-score').textContent = `SCORE ${String(snapshot.score).padStart(6, '0')}`;
      document.querySelector('#result-action').textContent = victory ? '한 번 더 달리기' : '다음 스테이지';
      document.querySelector('#result-action').dataset.action = victory ? 'title' : 'next';
      this.result.hidden = false;
    }

    onEvent(type, snapshot, detail = {}) {
      if (type === 'start' || type === 'stage-start') {
        this.ready.hidden = true;
        this.pause.hidden = true;
        this.result.hidden = true;
        document.querySelector('#game').focus({ preventScroll: true });
        this.announce(type === 'start' ? '모험을 시작합니다.' : `${snapshot.stageName} 시작`);
      } else if (type === 'pause') {
        this.pause.hidden = false;
        this.announce('게임이 일시정지되었습니다.');
      } else if (type === 'resume') {
        this.pause.hidden = true;
        document.querySelector('#game').focus({ preventScroll: true });
        this.announce('게임을 계속합니다.');
      } else if (type === 'title' || type === 'ready') {
        this.ready.hidden = false;
        this.pause.hidden = true;
        this.result.hidden = true;
        this.bossHud.hidden = true;
        this.announce('불꽃 또는 서리의 힘을 선택하세요.');
      } else if (type === 'stage-clear') {
        this.showResult('stage-clear', snapshot);
        this.announce(`${snapshot.stageName} 스테이지를 통과했습니다.`);
      } else if (type === 'victory') {
        this.showResult('victory', snapshot);
        this.announce('세 개의 스테이지를 모두 완주했습니다.');
      } else if (type === 'checkpoint') {
        this.showToast(`체크포인트 ${snapshot.checkpoint} m 저장`);
        this.announce(`${snapshot.checkpoint} 미터 체크포인트를 저장했습니다.`);
      } else if (type === 'hit') {
        this.showToast(`피격! 체력 ${snapshot.hp}칸`);
        this.announce(`피격. 체력이 ${snapshot.hp}칸 남았습니다.`);
      } else if (type === 'respawn') {
        this.showToast(`체크포인트 ${snapshot.checkpoint} m에서 다시 출발`);
        this.announce('체력이 모두 소진되어 최근 체크포인트에서 다시 출발합니다.');
      } else if (type === 'coin') {
        this.showToast(`코인 +${detail.points}`);
      } else if (type === 'food') {
        this.showToast(`치킨 +${detail.points} · 체력 회복`);
      } else if (type === 'steak') {
        this.showToast(`스테이크 +${detail.points} · 체력 회복`);
      } else if (type === 'boss-start') {
        this.bossHud.hidden = false;
        this.showToast('거대 곰 출현! 충격파를 점프로 피하세요');
        this.announce('최종 보스 거대 곰이 나타났습니다. 충격파는 점프로 피하고 공격하세요.');
      } else if (type === 'boss-defeated') {
        this.showToast('거대 곰이 서서히 사라집니다');
        this.announce('거대 곰을 물리쳤습니다.');
      }
      this.render(snapshot);
    }

    render(snapshot) {
      document.querySelector('#stage-name').textContent = `STAGE ${String(snapshot.stage + 1).padStart(2, '0')} · ${snapshot.stageName}`;
      document.querySelector('#element-label').textContent = snapshot.element === 'fire' ? '불꽃의 힘' : '서리의 힘';
      document.querySelector('#score').textContent = String(snapshot.score).padStart(6, '0');
      document.querySelector('#distance').textContent = `${snapshot.distance} m`;
      document.querySelector('#length').textContent = `${snapshot.length} m`;
      const hearts = Array.from({ length: snapshot.maxHp }, (_, index) => index < snapshot.hp ? '♥' : '♡').join(' ');
      const health = document.querySelector('#health');
      health.textContent = hearts;
      health.setAttribute('aria-label', `체력 ${snapshot.hp} / ${snapshot.maxHp}`);
      const progress = Math.max(0, Math.min(100, snapshot.distance / snapshot.length * 100));
      document.querySelector('#progress-fill').style.width = `${progress}%`;
      document.querySelector('#checkpoint-marker').style.left = `${Math.max(0, Math.min(100, snapshot.checkpoint / snapshot.length * 100))}%`;
      const active = ['running', 'boss-fight'].includes(snapshot.mode);
      document.querySelector('#pause-button').disabled = !active;
      document.querySelector('#end-button').disabled = !active && snapshot.mode !== 'paused';
      document.querySelector('#run-status').textContent = ({ ready: 'READY', running: 'RUNNING', paused: 'PAUSED', dying: 'RETRY', 'boss-fight': 'BOSS BATTLE', 'boss-defeated': 'BOSS DOWN', 'stage-clear': 'STAGE CLEAR', won: 'ALL CLEAR' })[snapshot.mode] || snapshot.mode.toUpperCase();
      this.bossHud.hidden = !['boss-fight', 'boss-defeated'].includes(snapshot.mode);
      document.querySelector('#boss-hp-fill').style.width = `${snapshot.bossHp / snapshot.bossMaxHp * 100}%`;
      document.querySelector('#boss-hp-text').textContent = `${snapshot.bossHp} / ${snapshot.bossMaxHp}`;
      document.querySelectorAll('[data-stage-card]').forEach((card) => card.classList.toggle('current', Number(card.dataset.stageCard) === snapshot.stage));
      this.lastMode = snapshot.mode;
    }
  }

  root.WhiteLionUI = { GameUI };
})(window);
