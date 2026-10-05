import * as THREE from 'three';
import { PHOTOS } from './data/photos.js';

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
// Frame-rate independent smoothing: move `current` toward `target` at rate `k` per second
export const damp = (current, target, k, dt) => lerp(current, target, 1 - Math.exp(-k * dt));
export const dampAngle = (current, target, k, dt) => {
  let d = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-k * dt));
};

export const ease = {
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  outBack: (t, s = 1.7) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
};

// Small deterministic random so the world looks the same on every visit
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- Photos ---------- */
export const photoInfo = (file) => PHOTOS[file] || null;
// Pick the smallest version at least `minWidth` wide
export function photoSrc(file, minWidth = 960) {
  const info = PHOTOS[file];
  if (!info) return null;
  return (info.srcset.find(([, w]) => w >= minWidth) || info.srcset[info.srcset.length - 1])[0];
}

/* ---------- Canvas textures ---------- */
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let glowTex;
export function glowTexture() {
  glowTex ||= canvasTexture(128, 128, (g, w) => {
    const r = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,.55)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, w, w);
  });
  return glowTex;
}

// A pastel stand-in when a photo is missing
export function placeholderTexture(label = 'photo coming soon') {
  return canvasTexture(384, 512, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, w, h);
    lg.addColorStop(0, '#fadbe2'); lg.addColorStop(1, '#dccdf4');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(75,52,69,.55)';
    g.font = '600 64px Fredoka, sans-serif'; g.textAlign = 'center';
    g.fillText('♡', w / 2, h / 2 - 10);
    g.font = '500 40px Caveat, cursive';
    g.fillText(label, w / 2, h / 2 + 50);
  });
}

export const heartShape = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.12, -0.55, 0.15);
  s.bezierCurveTo(-0.55, 0.42, -0.2, 0.52, 0, 0.28);
  s.bezierCurveTo(0.2, 0.52, 0.55, 0.42, 0.55, 0.15);
  s.bezierCurveTo(0.55, -0.12, 0.15, -0.35, 0, -0.5);
  return s;
};

/* ---------- Cleanup ---------- */
export function disposeObject(root) {
  root.traverse((o) => {
    o.geometry?.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      for (const k in m) if (m[k]?.isTexture) m[k].dispose();
      m.uniforms && Object.values(m.uniforms).forEach((u) => u.value?.isTexture && u.value.dispose());
      m.dispose();
    });
    o.dispose?.();
  });
}
