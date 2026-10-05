import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { clamp, smoothstep } from '../utils.js';

// An enchanted pastel forest. Each month borrows its season's look (amber glow, frost, blossom, firefly glade).
// mushrooms/crystals glow; trees + pines make the forest walls on both sides of the path.
export const SEASONS = {
  autumn: {
    ground: '#e9bfd0', hedge: '#e9b3a7', skyTop: '#bba6e4', skyMid: '#f7cfd8', fog: '#e9d3e2',
    foliage: ['#f7b89a', '#f2a7bb', '#f6c48f', '#e99aa8', '#d9a3d6'],
    glow: ['#ffcf9a', '#f6a3c0', '#ffd8a8'],
    particle: { color: '#f6a98f', fall: 0.8, sway: 1.2, size: 0.3, twinkle: 0.3 },
    trees: 26, pines: 6, flowers: 18, hearts: 3, balloons: 0, lanterns: 4, mounds: 0, mushrooms: 16, crystals: 2,
  },
  winter: {
    ground: '#d8d5f4', hedge: '#e2def4', skyTop: '#a9b0e6', skyMid: '#e6def5', fog: '#ddd9f0',
    foliage: ['#ffffff', '#e9e2fa', '#d6ccf3', '#cfe4f7'],
    glow: ['#cfe8ff', '#dccbff', '#ffffff'],
    particle: { color: '#ffffff', fall: 0.6, sway: 0.5, size: 0.24, twinkle: 0.4 },
    trees: 6, pines: 26, flowers: 0, hearts: 3, balloons: 0, lanterns: 6, mounds: 14, mushrooms: 8, crystals: 12,
  },
  spring: {
    ground: '#c4e8c6', hedge: '#a8d9b2', skyTop: '#c3aeee', skyMid: '#fbd0e2', fog: '#f1d9e8',
    foliage: ['#f6b8c8', '#fadbe2', '#ffd1e3', '#f3a6c4', '#ffffff'],
    glow: ['#f6a3c0', '#ffd1e3', '#c9a8f5'],
    particle: { color: '#f8bfd0', fall: 0.5, sway: 1.5, size: 0.28, twinkle: 0.3 },
    trees: 28, pines: 4, flowers: 46, hearts: 4, balloons: 0, lanterns: 0, mounds: 0, mushrooms: 14, crystals: 2,
  },
  summer: {
    ground: '#b2e4d0', hedge: '#93d0bc', skyTop: '#a9bdee', skyMid: '#f4d9ea', fog: '#e6def0',
    foliage: ['#a9dcc9', '#c1e6b9', '#9fd3d6', '#c7b8ee', '#b8e2c2'],
    glow: ['#9fe3d6', '#fff0a6', '#c9a8f5'],
    particle: { color: '#fff1a0', fall: -0.15, sway: 0.7, size: 0.26, twinkle: 1 },
    trees: 26, pines: 6, flowers: 34, hearts: 3, balloons: 0, lanterns: 0, mounds: 0, mushrooms: 18, crystals: 3,
  },
  birthday: {
    ground: '#f0c6dc', hedge: '#e6b6d2', skyTop: '#bfa9ee', skyMid: '#ffd3e5', fog: '#efd8ea',
    foliage: ['#f6b8c8', '#dccdf4', '#fde0cf', '#c9a8f5'],
    glow: ['#f6a3c0', '#c9a8f5', '#ffd8a8', '#9fe3d6'],
    particle: { color: '#fff4c2', fall: -0.2, sway: 0.8, size: 0.26, twinkle: 1 },
    trees: 14, pines: 4, flowers: 40, hearts: 8, balloons: 0, lanterns: 6, mounds: 0, mushrooms: 10, crystals: 4,
  },
};

const seasonOf = (month) => (month === 11 || month <= 1 ? 'winter' : month <= 4 ? 'spring' : month <= 7 ? 'summer' : 'autumn');

// 12 month zones + the birthday stretch at the end
export const ZONES = (() => {
  const { year, month } = CONFIG.startMonth;
  const fmt = new Intl.DateTimeFormat('en', { month: 'long' });
  const zones = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(year, month + i, 1);
    zones.push({
      index: i,
      name: fmt.format(d),
      year: d.getFullYear(),
      label: `${fmt.format(d)} ${d.getFullYear()}`,
      season: seasonOf(d.getMonth()),
    });
  }
  zones.push({ index: 12, name: 'Birthday', year: '', label: CONFIG.birthdayLabel, season: 'birthday' });
  return zones;
})();

export const ZONE_COUNT = ZONES.length;
export const styleOf = (i) => SEASONS[ZONES[clamp(i, 0, ZONE_COUNT - 1)].season];

// Blended colours at a position along the path (u in 0..1), with soft transitions between months
const _a = new THREE.Color(), _b = new THREE.Color();
export function blendZoneColor(u, key, out) {
  const z = clamp(u * ZONE_COUNT, 0, ZONE_COUNT - 0.0001);
  const i = Math.floor(z), f = z - i;
  const w = f < 0.5 ? 0.5 - smoothstep(0, 0.5, f) * 0.5 : smoothstep(0.5, 1, f) * 0.5; // weight of neighbour
  const j = f < 0.5 ? i - 1 : i + 1;
  _a.set(styleOf(i)[key]);
  _b.set(styleOf(j)[key]);
  return out.copy(_a).lerp(_b, w);
}
