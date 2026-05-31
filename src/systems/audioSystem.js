

let audioContext = null;

export function getAudioContext() { return audioContext; }

export function ensureAudio(soundEnabled) {
  if (!soundEnabled || document.hidden) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") {
    try {
      audioContext.resume().catch(() => {});
    } catch {}
  }
}

export function registerAudioUnlockHandlers(soundEnabledRef) {
  const isSoundEnabled = typeof soundEnabledRef === "function"
    ? soundEnabledRef
    : () => Boolean(soundEnabledRef);
  const unlock = () => ensureAudio(isSoundEnabled());
  ["pointerdown", "touchstart", "click", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, unlock, { passive: true });
  });
}

export function suspendAudio() {
  resetAudioContext();
}

export function resumeAudio(soundEnabled) {
  ensureAudio(soundEnabled);
}

export function resetAudioContext() {
  if (!audioContext) return;
  const ctx = audioContext;
  audioContext = null;
  if (ctx.state !== "closed") {
    try {
      ctx.close().catch(() => {});
    } catch {}
  }
}

const SOUND_PARAMS = {
  click:   { freq: 300, duration: 0.18, harsh: false },
  crit:    { freq: 480, duration: 0.18, harsh: false },
  jackpot: { freq: 660, duration: 0.32, harsh: false },
  buy:     { freq: 400, duration: 0.18, harsh: false },
  deny:    { freq: 180, duration: 0.18, harsh: true  },
  save:    { freq: 540, duration: 0.18, harsh: false },
  evolve:  { freq: 720, duration: 0.32, harsh: false },
  event:   { freq: 560, duration: 0.18, harsh: false },
};

export function playSound(type, soundEnabled) {
  if (!soundEnabled || document.hidden) return;
  ensureAudio(soundEnabled);
  if (!audioContext) return;
  if (audioContext.state !== "running") return;

  const { freq: base, duration, harsh: isHarsh } = SOUND_PARAMS[type] || SOUND_PARAMS.click;

  const osc    = audioContext.createOscillator();
  const gain   = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  filter.type            = "lowpass";
  filter.frequency.value = isHarsh ? 900 : 2200;
  filter.Q.value         = 0.7;

  osc.type = isHarsh ? "sine" : "triangle";
  osc.frequency.setValueAtTime(base, audioContext.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    Math.max(80, base * 0.62),
    audioContext.currentTime + duration
  );

  const peak = isHarsh ? 0.045 : 0.065;
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(peak, audioContext.currentTime + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  osc.start();
  osc.stop(audioContext.currentTime + duration + 0.04);
}
