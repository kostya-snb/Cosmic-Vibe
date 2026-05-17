let audioCtx = null;
let currentBpm = 120;
let currentPitchOffset = 0;
let bgmIntervalId = null;

const AudioEngine = {
  getState: () => ({ isPaused: false, isGameOver: false, currentPhase: 0, PHASES: { SHOP: 4 } }),

  initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.startBattleMusic();
  },

  startBattleMusic() {
    if (bgmIntervalId) clearInterval(bgmIntervalId);
    currentBpm = 120;
    currentPitchOffset = 0;

    bgmIntervalId = setInterval(() => {
      const state = this.getState();
      if (state.isPaused || state.isGameOver || state.currentPhase === state.PHASES.SHOP) return;
      const time = audioCtx.currentTime;

      // Kick Drum
      const kickOsc = audioCtx.createOscillator();
      const kickGain = audioCtx.createGain();
      kickOsc.type = 'sine';
      kickOsc.frequency.setValueAtTime(150 * Math.pow(2, currentPitchOffset), time);
      kickOsc.frequency.exponentialRampToValueAtTime(0.01, time + 0.1);
      kickGain.gain.setValueAtTime(0.5, time);
      kickGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
      kickOsc.connect(kickGain);
      kickGain.connect(audioCtx.destination);
      kickOsc.start(time);
      kickOsc.stop(time + 0.1);

      // Bass Synth (off-beat)
      setTimeout(() => {
        const state2 = this.getState();
        if (state2.isPaused || state2.isGameOver || state2.currentPhase === state2.PHASES.SHOP) return;
        const bassOsc = audioCtx.createOscillator();
        const bassGain = audioCtx.createGain();
        bassOsc.type = 'sawtooth';
        bassOsc.frequency.setValueAtTime(65 * Math.pow(2, currentPitchOffset), audioCtx.currentTime);
        bassGain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        bassGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        bassOsc.connect(bassGain);
        bassGain.connect(audioCtx.destination);
        bassOsc.start(audioCtx.currentTime);
        bassOsc.stop(audioCtx.currentTime + 0.2);
      }, (60000 / currentBpm) / 2); // off-beat based on current BPM
    }, 60000 / currentBpm);
  },

  setBossTransitionMusic() {
    if (audioCtx) {
      currentPitchOffset = -1; // Drop octave
      currentBpm = 156; // +30%
      this.startBattleMusic();
    }
  },

  startShopMusic() {
    if (bgmIntervalId) clearInterval(bgmIntervalId);
    // Minimal atmospheric ambient
    bgmIntervalId = setInterval(() => {
      const state = this.getState();
      if (state.currentPhase !== state.PHASES.SHOP) return;
      const time = audioCtx.currentTime;

      const padOsc = audioCtx.createOscillator();
      const padGain = audioCtx.createGain();
      padOsc.type = 'sine';
      padOsc.frequency.setValueAtTime(220 + Math.random() * 50, time);

      padGain.gain.setValueAtTime(0, time);
      padGain.gain.linearRampToValueAtTime(0.05, time + 1);
      padGain.gain.linearRampToValueAtTime(0, time + 4);

      padOsc.connect(padGain);
      padGain.connect(audioCtx.destination);
      padOsc.start(time);
      padOsc.stop(time + 4);
    }, 3000);
  },

  playLootSound() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(2000, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  },

  playPew() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(800, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  },

  playBoom() {
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  },

  resumeContext() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }
};

export { AudioEngine };
