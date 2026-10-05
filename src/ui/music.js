// "Magical forest" background music, generated live with Web Audio (no file to download).
// Slow dreamy pads in F major, a music-box melody on the pentatonic scale, a soft bass and
// the occasional wind-chime shimmer, all washed through a gentle reverb.
// Replace it with your own track by setting `music` in src/config.js.
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

const CHORDS = [
  { bass: 41, pad: [53, 57, 60, 64] }, // Fmaj7
  { bass: 38, pad: [53, 57, 60, 62] }, // Dm7
  { bass: 46, pad: [58, 62, 65, 69] }, // Bbmaj7
  { bass: 36, pad: [55, 60, 62, 64] }, // Cadd9
  { bass: 41, pad: [53, 57, 60, 64] }, // Fmaj7
  { bass: 45, pad: [57, 60, 64, 67] }, // Am7
  { bass: 46, pad: [58, 62, 65, 69] }, // Bbmaj7
  { bass: 36, pad: [55, 58, 60, 64] }, // C7sus
];
const MELODY = [72, 74, 77, 79, 81, 84, 86, 89]; // F pentatonic, music-box register
const CHORD_LEN = 5.2;  // seconds per chord
const STEP = 0.43;      // melody step

function impulse(ctx, seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

export function createForestMusic(ctx, volume = 0.35) {
  const out = ctx.createGain();
  out.gain.value = 0;
  out.connect(ctx.destination);
  const reverb = ctx.createConvolver();
  reverb.buffer = impulse(ctx, 3.8, 2.4);
  const wet = ctx.createGain(); wet.gain.value = 0.7;
  const dry = ctx.createGain(); dry.gain.value = 0.55;
  const bus = ctx.createGain();
  bus.connect(dry).connect(out);
  bus.connect(reverb).connect(wet).connect(out);
  // soften everything a touch
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass'; padFilter.frequency.value = 1100; padFilter.Q.value = 0.3;
  padFilter.connect(bus);

  let timer = 0, chordIdx = 0, nextChord = 0, nextStep = 0, nextChime = 0, note = 2, playing = false;

  function pad(freq, t, dur, gain) {
    for (const det of [-6, 6]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = freq; o.detune.value = det;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + 1.8);
      g.gain.setValueAtTime(gain, t + dur - 0.4);
      g.gain.linearRampToValueAtTime(0, t + dur + 2);
      o.connect(g).connect(padFilter);
      o.start(t); o.stop(t + dur + 2.1);
    }
  }
  function bell(freq, t, gain) {
    // music-box tone: fundamental + a few bright partials that die away fast
    [[1, 1], [2.01, 0.35], [3.98, 0.12], [5.4, 0.05]].forEach(([mul, g0], k) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq * mul;
      const d = k ? 0.6 : 1.8;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain * g0, t + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(bus);
      o.start(t); o.stop(t + d + 0.05);
    });
  }
  function bass(freq, t, dur) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    o.connect(g).connect(bus);
    o.start(t); o.stop(t + dur + 1);
  }

  function schedule() {
    const ahead = ctx.currentTime + 1.2;
    while (nextChord < ahead) {
      const c = CHORDS[chordIdx % CHORDS.length];
      c.pad.forEach((n) => pad(midi(n), nextChord, CHORD_LEN, 0.022));
      bass(midi(c.bass), nextChord, CHORD_LEN);
      chordIdx++;
      nextChord += CHORD_LEN;
    }
    while (nextStep < ahead) {
      // a wandering, mostly stepwise tune that rests often
      if (Math.random() < 0.5) {
        note = Math.max(0, Math.min(MELODY.length - 1, note + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        bell(midi(MELODY[note]), nextStep, 0.05 + Math.random() * 0.025);
        if (Math.random() < 0.18) bell(midi(MELODY[Math.max(0, note - 2)]), nextStep + 0.01, 0.03);
      }
      nextStep += STEP * (Math.random() < 0.15 ? 2 : 1);
    }
    if (nextChime < ahead) {
      // wind-chime shimmer: a quick soft run up high
      const start = Math.floor(Math.random() * 3);
      for (let i = 0; i < 5; i++) bell(midi(MELODY[Math.min(MELODY.length - 1, start + i)] + 12), nextChime + i * 0.07, 0.014);
      nextChime += 9 + Math.random() * 8;
    }
  }

  return {
    get playing() { return playing; },
    start() {
      if (playing) return;
      playing = true;
      const t = ctx.currentTime + 0.1;
      nextChord = nextStep = t;
      nextStep = t + 1.5;
      nextChime = t + 6;
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.linearRampToValueAtTime(volume, ctx.currentTime + 3);
      schedule();
      timer = setInterval(schedule, 250);
    },
    stop() {
      if (!playing) return;
      playing = false;
      clearInterval(timer);
      out.gain.cancelScheduledValues(ctx.currentTime);
      out.gain.setValueAtTime(out.gain.value, ctx.currentTime);
      out.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    },
    dispose() { clearInterval(timer); out.disconnect(); },
  };
}
