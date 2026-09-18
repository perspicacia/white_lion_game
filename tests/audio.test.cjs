const test = require('node:test');
const assert = require('node:assert/strict');

class FakeAudioContext {
  constructor() {
    this.state = 'suspended';
    this.sampleRate = 100;
    this.currentTime = 0;
    this.destination = {};
    this.resumeCount = 0;
  }

  createGain() {
    return {
      gain: {
        value: 0,
        setTargetAtTime() {},
      },
      connect() { return this; },
    };
  }

  createBuffer(channels, length) {
    return { getChannelData: () => new Float32Array(length) };
  }

  async resume() {
    this.resumeCount += 1;
    this.state = 'running';
  }
}

let nextTimer = 0;
const clearedTimers = [];
const timerDelays = [];
global.window = {
  AudioContext: FakeAudioContext,
  setInterval: (callback, delay) => { timerDelays.push(delay); nextTimer += 1; return nextTimer; },
  clearInterval: (timer) => { clearedTimers.push(timer); },
};
require('../dist/js/audio.js');
const { AudioSystem } = global.window.WhiteLionAudio;

test('audio context is resumed and the heroic background mix stays audible', async () => {
  const audio = new AudioSystem();
  assert.equal(await audio.ensure(), true);
  assert.equal(audio.context.state, 'running');
  assert.equal(audio.context.resumeCount, 1);
  assert.equal(audio.music.gain.value, 0.44);
});

test('background music restarts with a fresh timer after pause', async () => {
  const audio = new AudioSystem();
  await audio.ensure();
  const musicCalls = [];
  audio.tone = (frequency, duration, options) => { musicCalls.push(options); };
  audio.noise = (duration, options) => { musicCalls.push(options); };

  audio.startMusic();
  const firstTimer = audio.musicTimer;
  assert.ok(firstTimer > 0);
  assert.ok(musicCalls.length >= 5);
  assert.ok(musicCalls.every(({ output }) => output === audio.music));
  audio.pauseMusic();
  assert.equal(audio.musicTimer, 0);
  assert.ok(clearedTimers.includes(firstTimer));

  audio.startMusic();
  assert.ok(audio.musicTimer > firstTimer);
  assert.equal(audio.active, true);
});

test('each stage uses a distinct theme and stage changes restart from the first beat', async () => {
  const audio = new AudioSystem();
  await audio.ensure();
  const outputs = [];
  audio.tone = (frequency, duration, options) => { outputs.push(options.output); };
  audio.noise = (duration, options) => { outputs.push(options.output); };

  audio.startMusic(0, true);
  const desertTimer = audio.musicTimer;
  assert.equal(timerDelays.at(-1), 125);
  audio.step = 17;
  audio.startMusic(1);
  const templeTimer = audio.musicTimer;
  assert.ok(templeTimer > desertTimer);
  assert.ok(clearedTimers.includes(desertTimer));
  assert.equal(timerDelays.at(-1), 136);
  assert.equal(audio.musicStage, 1);
  assert.equal(audio.step, 1);

  audio.startMusic(2);
  assert.ok(audio.musicTimer > templeTimer);
  assert.equal(timerDelays.at(-1), 111);
  assert.equal(audio.musicStage, 2);
  assert.equal(audio.step, 1);
  assert.ok(outputs.every((output) => output === audio.music));
});

test('steak pickup has a distinct low bite sound', async () => {
  const audio = new AudioSystem();
  await audio.ensure();
  const calls = [];
  audio.tone = (...args) => calls.push(['tone', ...args]);
  audio.noise = (...args) => calls.push(['noise', ...args]);
  audio.play('steak');
  assert.equal(calls.filter(([type]) => type === 'tone').length, 2);
  assert.equal(calls.filter(([type]) => type === 'noise').length, 1);
  assert.ok(calls[0][1] < 400);
});
