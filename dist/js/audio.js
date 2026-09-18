(function (root) {
  'use strict';

  class AudioSystem {
    constructor() {
      this.context = null;
      this.master = null;
      this.music = null;
      this.volume = 0.55;
      this.muted = false;
      this.musicTimer = 0;
      this.musicStage = -1;
      this.step = 0;
      this.active = false;
      this.noiseBuffer = null;
    }

    async ensure() {
      if (!this.context) {
        const Context = root.AudioContext || root.webkitAudioContext;
        if (!Context) return false;
        this.context = new Context();
        this.master = this.context.createGain();
        this.music = this.context.createGain();
        this.music.gain.value = 0.44;
        this.music.connect(this.master);
        this.master.connect(this.context.destination);
        this.makeNoiseBuffer();
        this.applyVolume();
      }
      if (this.context.state === 'closed') return false;
      if (this.context.state !== 'running') {
        try {
          await this.context.resume();
        } catch (error) {
          return false;
        }
      }
      return this.context.state === 'running';
    }

    makeNoiseBuffer() {
      const length = Math.floor(this.context.sampleRate * 0.35);
      this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    }

    applyVolume() {
      if (!this.master || !this.context) return;
      const value = this.muted ? 0 : this.volume;
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.018);
    }

    setVolume(value) {
      this.volume = Math.max(0, Math.min(1, Number(value) || 0));
      this.applyVolume();
    }

    setMuted(muted) {
      this.muted = Boolean(muted);
      this.applyVolume();
    }

    tone(frequency, duration, options = {}) {
      if (!this.context || !this.master) return;
      const time = this.context.currentTime + (options.delay || 0);
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = options.type || 'square';
      oscillator.frequency.setValueAtTime(Math.max(20, frequency), time);
      if (options.to) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.to), time + duration);
      gain.gain.setValueAtTime(0.0001, time);
      gain.gain.exponentialRampToValueAtTime(options.gain || 0.08, time + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(gain).connect(options.output || this.master);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.02);
    }

    noise(duration, options = {}) {
      if (!this.context || !this.master || !this.noiseBuffer) return;
      const time = this.context.currentTime + (options.delay || 0);
      const source = this.context.createBufferSource();
      const filter = this.context.createBiquadFilter();
      const gain = this.context.createGain();
      source.buffer = this.noiseBuffer;
      filter.type = options.filter || 'bandpass';
      filter.frequency.setValueAtTime(options.frequency || 1500, time);
      if (options.to) filter.frequency.exponentialRampToValueAtTime(options.to, time + duration);
      filter.Q.value = options.q || 1.2;
      gain.gain.setValueAtTime(options.gain || 0.05, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter).connect(gain).connect(options.output || this.master);
      source.start(time);
      source.stop(time + duration + 0.02);
    }

    startMusic(stage = 0, restart = false) {
      const nextStage = Math.max(0, Math.min(2, Number(stage) || 0));
      const changed = nextStage !== this.musicStage;
      if ((changed || restart) && this.musicTimer) {
        root.clearInterval(this.musicTimer);
        this.musicTimer = 0;
      }
      if (changed || restart) this.step = 0;
      this.musicStage = nextStage;
      this.active = true;
      if (this.musicTimer) return;
      const themes = [
        {
          interval: 125, melodyRoot: 293.66, bassRoot: 73.42,
          melody: [0,null,3,5,7,null,8,7,5,3,2,null,0,2,3,null,5,null,7,8,11,null,8,7,5,7,3,null,2,0,-1,null,0,3,5,null,7,8,11,null,12,11,8,7,5,null,3,2,0,null,5,3,2,0,-1,null,0,2,3,5,7,5,3,null],
          bass: [0,0,-2,-5,0,-7,-5,-2,0,3,-2,-5,0,-7,-2,-1], pulse: [0,7,3,7,0,8,5,7],
          drums: [0,3,6,8,11,14], accents: [4,12], kind: 'desert'
        },
        {
          interval: 136, melodyRoot: 261.63, bassRoot: 65.41,
          melody: [0,null,3,7,8,7,3,2,0,3,7,11,12,11,8,7,5,null,8,12,15,12,11,8,7,5,3,2,0,-1,0,null,0,7,8,11,12,15,12,11,8,7,5,3,2,3,7,null,8,12,15,14,12,11,8,7,5,3,2,-1,0,null,0,null],
          bass: [0,0,7,3,0,-1,3,7,0,8,7,3,0,-1,7,0], pulse: [0,7,12,15,12,7,3,11],
          drums: [0,4,8,12,14,15], accents: [2,6,10], kind: 'temple'
        },
        {
          interval: 111, melodyRoot: 329.63, bassRoot: 82.41,
          melody: [0,null,3,5,7,5,3,null,0,3,null,7,10,7,5,3,5,7,10,12,10,7,5,null,3,5,7,3,0,-2,0,null,0,3,5,7,null,10,12,10,7,5,3,5,7,null,10,7,12,10,7,5,3,0,3,5,7,10,7,5,3,-2,0,null],
          bass: [0,0,3,5,0,7,5,3,0,10,7,5,3,0,-2,0], pulse: [0,7,3,10,5,12,7,3],
          drums: [0,3,5,8,10,13,15], accents: [2,6,9,14], kind: 'jungle'
        }
      ];
      const theme = themes[nextStage];
      const drumSteps = new Set(theme.drums);
      const accentSteps = new Set(theme.accents);
      const tick = () => {
        if (!this.active || !this.context || this.context.state !== 'running') return;
        const loopStep = this.step % 64;
        const barStep = loopStep % 16;
        const melodyNote = theme.melody[loopStep];
        if (melodyNote !== null) {
          const frequency = theme.melodyRoot * Math.pow(2, melodyNote / 12);
          const leadLength = theme.kind === 'jungle' ? 0.1 : 0.17;
          this.tone(frequency, leadLength, { type: theme.kind === 'jungle' ? 'triangle' : 'square', gain: 0.027, output: this.music });
          this.tone(frequency * 2, 0.09, { type: theme.kind === 'temple' ? 'sine' : 'triangle', gain: theme.kind === 'temple' ? 0.012 : 0.009, output: this.music });
        }
        if (loopStep % 2 === 0) {
          const pulseNote = theme.pulse[(loopStep / 2) % theme.pulse.length];
          this.tone(theme.bassRoot * 2 * Math.pow(2, pulseNote / 12), 0.105, { type: theme.kind === 'temple' ? 'square' : 'triangle', gain: 0.021, output: this.music });
        }
        if (loopStep % 4 === 0) {
          const bassNote = theme.bass[Math.floor(loopStep / 4)];
          const bassFrequency = theme.bassRoot * Math.pow(2, bassNote / 12);
          this.tone(bassFrequency, theme.kind === 'jungle' ? 0.18 : 0.36, { type: theme.kind === 'jungle' ? 'triangle' : 'sawtooth', gain: 0.035, output: this.music });
          if (theme.kind !== 'jungle') this.tone(bassFrequency / 2, 0.4, { type: 'triangle', gain: 0.028, output: this.music });
        }
        if (drumSteps.has(barStep)) {
          const strong = barStep === 0 || barStep === 8;
          this.tone(strong ? 118 : theme.kind === 'temple' ? 92 : 102, 0.11, { to: strong ? 44 : 52, type: 'sine', gain: strong ? 0.062 : 0.043, output: this.music });
          this.noise(0.05, { filter: 'lowpass', frequency: theme.kind === 'temple' ? 150 : 210, q: 1.1, gain: strong ? 0.032 : 0.021, output: this.music });
        }
        if (accentSteps.has(barStep)) {
          const wood = theme.kind === 'jungle';
          this.noise(wood ? 0.035 : 0.075, { filter: 'bandpass', frequency: wood ? 1900 : 1050, q: 2.8, gain: 0.028, output: this.music });
          this.tone(wood ? 780 : 196, wood ? 0.055 : 0.09, { to: wood ? 510 : 148, type: 'square', gain: 0.018, output: this.music });
        }
        if (barStep % 2 === 1) {
          this.noise(0.028, { filter: 'highpass', frequency: barStep === 15 ? 5200 : 4100, q: 0.75, gain: barStep === 15 ? 0.016 : 0.01, output: this.music });
        }
        if (barStep === 0) {
          const drone = theme.kind === 'desert' ? (loopStep < 32 ? 146.83 : 130.81) : theme.bassRoot * (theme.kind === 'temple' ? 2 : 1);
          this.tone(drone, 0.72, { type: 'sine', gain: 0.013, output: this.music });
        }
        this.step += 1;
      };
      tick();
      this.musicTimer = root.setInterval(tick, theme.interval);
    }

    pauseMusic() {
      this.active = false;
      if (this.musicTimer) {
        root.clearInterval(this.musicTimer);
        this.musicTimer = 0;
      }
    }

    play(type, detail = {}) {
      if (!this.context || this.muted) return;
      switch (type) {
        case 'jump':
          this.tone(340, 0.13, { to: 650, type: 'square', gain: 0.07 });
          break;
        case 'double-jump':
          this.tone(520, 0.14, { to: 920, type: 'triangle', gain: 0.075 });
          this.tone(780, 0.1, { type: 'square', gain: 0.035, delay: 0.04 });
          break;
        case 'coin':
          this.tone(880, 0.08, { type: 'square', gain: 0.06 });
          this.tone(1320, 0.12, { type: 'square', gain: 0.05, delay: 0.06 });
          break;
        case 'food':
          this.tone(392, 0.1, { type: 'triangle', gain: 0.065 });
          this.tone(523, 0.12, { type: 'triangle', gain: 0.06, delay: 0.07 });
          this.tone(659, 0.16, { type: 'triangle', gain: 0.05, delay: 0.14 });
          break;
        case 'steak':
          this.tone(330, 0.07, { to: 220, type: 'square', gain: 0.055 });
          this.tone(196, 0.11, { to: 145, type: 'triangle', gain: 0.05, delay: 0.05 });
          this.noise(0.045, { filter: 'lowpass', frequency: 650, to: 240, gain: 0.03 });
          break;
        case 'fire-attack':
          this.noise(0.18, { filter: 'bandpass', frequency: 1200, to: 350, gain: 0.075 });
          this.tone(190, 0.16, { to: 105, type: 'sawtooth', gain: 0.05 });
          break;
        case 'ice-attack':
          this.tone(1180, 0.12, { to: 720, type: 'sine', gain: 0.065 });
          this.tone(1760, 0.17, { to: 980, type: 'triangle', gain: 0.045, delay: 0.025 });
          break;
        case 'enemy-defeated':
          if (detail.element === 'ice') {
            this.noise(0.12, { filter: 'highpass', frequency: 4600, to: 1800, gain: 0.07 });
            this.tone(1420, 0.13, { to: 430, type: 'triangle', gain: 0.06 });
          } else {
            this.noise(0.2, { filter: 'lowpass', frequency: 1500, to: 280, gain: 0.1 });
            this.tone(130, 0.17, { to: 62, type: 'sawtooth', gain: 0.07 });
          }
          break;
        case 'hit':
          this.tone(150, 0.28, { to: 58, type: 'square', gain: 0.095 });
          this.noise(0.13, { filter: 'lowpass', frequency: 700, gain: 0.075 });
          break;
        case 'checkpoint':
          [523, 659, 784].forEach((frequency, index) => this.tone(frequency, 0.18, { type: 'triangle', gain: 0.055, delay: index * 0.08 }));
          break;
        case 'boss-start':
          [110, 98, 82].forEach((frequency, index) => this.tone(frequency, 0.42, { type: 'sawtooth', gain: 0.07, delay: index * 0.16 }));
          break;
        case 'boss-attack':
          this.noise(0.22, { filter: 'lowpass', frequency: 620, to: 180, gain: 0.1 });
          break;
        case 'boss-hit':
          this.tone(220, 0.12, { to: 95, type: 'square', gain: 0.08 });
          break;
        case 'boss-defeated':
          this.noise(0.45, { filter: 'lowpass', frequency: 1500, to: 100, gain: 0.12 });
          [196, 247, 294, 392].forEach((frequency, index) => this.tone(frequency, 0.35, { type: 'triangle', gain: 0.055, delay: index * 0.12 }));
          break;
        case 'stage-clear':
        case 'victory':
          [523, 659, 784, 1047].forEach((frequency, index) => this.tone(frequency, 0.28, { type: 'triangle', gain: 0.06, delay: index * 0.09 }));
          break;
        case 'respawn':
          this.tone(260, 0.15, { to: 520, type: 'square', gain: 0.055 });
          break;
        default:
          break;
      }
    }
  }

  root.WhiteLionAudio = { AudioSystem };
})(window);
