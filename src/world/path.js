import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ZONE_COUNT } from './zones.js';
import { clamp } from '../utils.js';

const SAMPLES = 2600;

// One long, gently winding path. Positions along it are written as u (0 = start, 1 = the cake).
export function createPath() {
  const length = ZONE_COUNT * CONFIG.zoneLength;
  const step = 15;
  const count = Math.ceil(length / step) + 1;
  const finaleStart = (ZONE_COUNT - 1) * CONFIG.zoneLength;
  const pts = [];
  let lastX = 0;
  for (let i = 0; i < count; i++) {
    const z = -i * step;
    let x = 7 * Math.sin(i * 0.5) + 2.5 * Math.sin(i * 1.27 + 1);
    if (i === 0) x = 0;
    if (-z >= finaleStart + step) x = lastX; // straight run into the birthday plaza
    else lastX = x;
    pts.push(new THREE.Vector3(x, 0, z));
  }
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  curve.arcLengthDivisions = 2000;
  const total = curve.getLength();

  // Pre-sampled points for fast nearest-point lookups
  const pos = [], tan = [], right = [];
  for (let i = 0; i < SAMPLES; i++) {
    const u = i / (SAMPLES - 1);
    const p = curve.getPointAt(u);
    const t = curve.getTangentAt(u).setY(0).normalize();
    pos.push(p); tan.push(t);
    right.push(new THREE.Vector3(-t.z, 0, t.x));
  }

  const frameAt = (u, out = {}) => {
    const f = clamp(u, 0, 1) * (SAMPLES - 1);
    const i = Math.min(SAMPLES - 2, Math.floor(f)), k = f - i;
    out.pos = (out.pos || new THREE.Vector3()).lerpVectors(pos[i], pos[i + 1], k);
    out.tan = (out.tan || new THREE.Vector3()).lerpVectors(tan[i], tan[i + 1], k).normalize();
    out.right = (out.right || new THREE.Vector3()).set(-out.tan.z, 0, out.tan.x);
    return out;
  };

  // A point beside the path: u along it, `side` metres to the right (negative = left), `y` up
  const placeAt = (u, side = 0, y = 0, out = new THREE.Vector3()) => {
    const f = frameAt(u);
    return out.copy(f.pos).addScaledVector(f.right, side).setY(y);
  };

  // Closest point to `p`, searching around a previous index hint (the player moves continuously)
  const _d = new THREE.Vector3();
  function nearest(p, hint = -1) {
    let best = 0, bestD = Infinity;
    const lo = hint < 0 ? 0 : Math.max(0, hint - 80);
    const hi = hint < 0 ? SAMPLES - 1 : Math.min(SAMPLES - 1, hint + 80);
    const stride = hint < 0 ? 4 : 1;
    for (let i = lo; i <= hi; i += stride) {
      const dx = p.x - pos[i].x, dz = p.z - pos[i].z;
      const d = dx * dx + dz * dz;
      if (d < bestD) { bestD = d; best = i; }
    }
    if (stride > 1) return nearest(p, best);
    _d.subVectors(p, pos[best]);
    return {
      index: best,
      u: best / (SAMPLES - 1),
      lateral: _d.x * right[best].x + _d.z * right[best].z,
      point: pos[best],
      right: right[best],
      tan: tan[best],
    };
  }

  // Approximate path x for a given world z (the path always heads toward -z)
  function xAtZ(z) {
    const f = clamp(-z / -pos[SAMPLES - 1].z, 0, 1) * (SAMPLES - 1);
    let i = Math.floor(f);
    // the curve isn't exactly linear in z, so walk to the right sample
    while (i > 0 && pos[i].z < z) i--;
    while (i < SAMPLES - 2 && pos[i + 1].z > z) i++;
    const a = pos[i], b = pos[Math.min(SAMPLES - 1, i + 1)];
    const k = a.z === b.z ? 0 : clamp((z - a.z) / (b.z - a.z), 0, 1);
    return a.x + (b.x - a.x) * k;
  }

  const uOfZone = (zone, at = 0) => (zone + at) / ZONE_COUNT;

  return {
    curve, total, samples: { pos, tan, right, count: SAMPLES },
    frameAt, placeAt, nearest, xAtZ, uOfZone,
    zoneAt: (u) => clamp(Math.floor(u * ZONE_COUNT), 0, ZONE_COUNT - 1),
    gateU: uOfZone(ZONE_COUNT - 1, 0.04),
    endU: 1,
  };
}
