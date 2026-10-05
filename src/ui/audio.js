import { CONFIG } from '../config.js';
import { createForestMusic } from './music.js';

// Background music + soft sound effects.
// By default the music is the built-in generated "magical forest" track (src/ui/music.js).
// Set CONFIG.music to a file in /public/audio to use your own track instead; if it fails to load,
// the built-in music plays. CONFIG.chime works the same way for the memory-open sound.
export function createAudio() {
  let ctx = null, chimeBuf = null, forest = null, started = false;
  let muted = false;
  try { muted = localStorage.getItem('hb-muted') === '1'; } catch {}

  let file = null; // HTMLAudioElement when a music file is configured
  if (CONFIG.music) {
    file = new Audio();
    file.loop = true;
    file.preload = 'none';
    file.volume = CONFIG.musicVolume;
    file.addEventListener('error', () => { file = null; if (started && !muted) startMusic(); }, { once: true });
  }

  function ensureCtx() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    if (CONFIG.chime) {
      fetch(CONFIG.chime)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => { chimeBuf = buf; })
        .catch(() => {});
    }
    return ctx;
  }

  function startMusic() {
    if (file) {
      if (!file.src) file.src = CONFIG.music;
      file.play().catch(() => {});
      return;
    }
    if (!ensureCtx()) return;
    forest ||= createForestMusic(ctx, CONFIG.musicVolume);
    forest.start();
  }
  function stopMusic() {
    file?.pause();
    forest?.stop();
  }

  // Pause everything while the tab is in the background
  function onVisibility() {
    if (!ctx) return;
    if (document.hidden) { ctx.suspend(); file?.pause(); }
    else { ctx.resume(); if (started && !muted && file) file.play().catch(() => {}); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function tone(freq, start, dur, gain = 0.08, type = 'sine') {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(g).connect(ctx.destination);
    o.start(start); o.stop(start + dur + 0.05);
  }
  const play = (notes, gap, dur, gain) => {
    if (muted || !ensureCtx()) return;
    ctx.resume?.();
    const t = ctx.currentTime + 0.02;
    notes.forEach((f, i) => { tone(f, t + i * gap, dur, gain); tone(f * 2, t + i * gap, dur * 0.6, gain * 0.25, 'triangle'); });
  };

  return {
    get muted() { return muted; },
    // call from a user gesture (Start button) so browsers allow sound
    unlock() {
      ensureCtx()?.resume?.();
      started = true;
      if (!muted) startMusic();
    },
    setMuted(v) {
      muted = v;
      try { localStorage.setItem('hb-muted', v ? '1' : '0'); } catch {}
      if (v) stopMusic();
      else if (started) { ensureCtx()?.resume?.(); startMusic(); }
    },
    chime() {
      if (muted || !ensureCtx()) return;
      if (chimeBuf) {
        const s = ctx.createBufferSource(), g = ctx.createGain();
        g.gain.value = 0.6; s.buffer = chimeBuf; s.connect(g).connect(ctx.destination); s.start();
      } else play([1046.5, 1318.5, 1568], 0.07, 0.9, 0.06);
    },
    close() { play([1318.5, 1046.5], 0.06, 0.4, 0.035); },
    found() { play([1568, 2093], 0.09, 0.7, 0.04); },
    // cute two-tone car horn
    beep() {
      if (muted || !ensureCtx()) return;
      const t = ctx.currentTime + 0.02;
      [0, 0.22].forEach((d) => { tone(740, t + d, 0.16, 0.05, 'square'); tone(932, t + d, 0.16, 0.03, 'square'); });
    },
    // a soft keyboard tick
    tick() {
      if (muted || !ensureCtx()) return;
      tone(1800 + Math.random() * 900, ctx.currentTime + 0.005, 0.035, 0.012, 'triangle');
    },
    celebrate() { play([523.25, 659.25, 783.99, 1046.5, 1318.5, 1568, 2093], 0.09, 1.1, 0.05); },
    puff() {
      if (muted || !ensureCtx()) return;
      // short breathy noise for blowing out candles
      const len = ctx.sampleRate * 0.5, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.25;
      s.buffer = buf; s.connect(f).connect(g).connect(ctx.destination); s.start();
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      stopMusic();
      forest?.dispose();
      if (file) file.src = '';
      ctx?.close();
    },
  };
}
