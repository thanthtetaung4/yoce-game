import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ZONE_COUNT } from './zones.js';
import { clamp, rng } from '../utils.js';

const SAMPLES = 2600;
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // north (-z), east, south, west

// A little hedge maze. One main route winds from the edge of the maze to the birthday plaza in its heart;
// short dead ends branch off it (the memories hide at the end of some of them).
// Positions along the main route are written as u (0 = start, 1 = the cake).
export function createPath({ nooks = [] } = {}) {
  const C = CONFIG.mazeCell;
  const hw = CONFIG.pathHalfWidth;
  const face = hw + 0.35;     // where the hedges start, measured from the middle of a corridor
  const reach = hw + 0.15;    // how far from the middle she can walk
  const target = Math.round((ZONE_COUNT * CONFIG.zoneLength - 2 * C) / C) + 1; // cells on the main route
  const N = 2 * Math.round(Math.sqrt(target * 2.4) / 2) + 1; // grid size (odd, so the plaza sits in the middle)
  const M = (N - 1) / 2;
  const half = (N * C) / 2;
  const key = (i, j) => i * N + j;
  const inGrid = (i, j) => i >= 0 && j >= 0 && i < N && j < N;
  const inPlaza = (i, j) => Math.abs(i - M) <= 1 && Math.abs(j - M) <= 1;
  const centre = (i, j, out = new THREE.Vector3()) => out.set((i - M) * C, 0, (j - M) * C);

  /* ---------- Main route: carve a maze, keep the way from the start to the plaza ---------- */
  function carve(seed) {
    const rand = rng(seed);
    const parent = new Map();
    const start = [M, N - 1];
    const seen = new Set([key(...start)]);
    const stack = [{ c: start, d: 0 }];
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [i, j] = top.c;
      const opts = [];
      for (let d = 0; d < 4; d++) {
        const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
        if (inGrid(ni, nj) && !inPlaza(ni, nj) && !seen.has(key(ni, nj))) opts.push(d);
      }
      if (!opts.length) { stack.pop(); continue; }
      // a bias toward going straight gives longer corridors between the turns
      const d = opts.includes(top.d) && rand() < 0.55 ? top.d : opts[Math.floor(rand() * opts.length)];
      const n = [i + DIRS[d][0], j + DIRS[d][1]];
      seen.add(key(...n));
      parent.set(key(...n), [i, j]);
      stack.push({ c: n, d });
    }
    // enter the plaza from the north, east or west, whichever gives the closest length
    let best = null;
    for (const e of [[M, M - 2], [M + 1 + 1, M], [M - 2, M]]) {
      const r = [e];
      for (let c = e; parent.has(key(...c));) { c = parent.get(key(...c)); r.unshift(c); }
      if (!best || Math.abs(r.length - target) < Math.abs(best.length - target)) best = r;
    }
    let turns = 0;
    for (let k = 2; k < best.length; k++) {
      if (best[k][0] - best[k - 1][0] !== best[k - 1][0] - best[k - 2][0] || best[k][1] - best[k - 1][1] !== best[k - 1][1] - best[k - 2][1]) turns++;
    }
    return { route: best, score: Math.abs(best.length - target) * 4 + Math.abs(turns / best.length - 0.3) * 20 };
  }
  // try a handful of layouts (deterministic, so the maze is the same on every visit) and keep the best fit
  let route = null;
  for (let s = 1, bestScore = Infinity; s <= 120; s++) {
    const r = carve(s);
    if (r.score < bestScore) { bestScore = r.score; route = r.route; }
  }

  // grid cells: type 'route' | 'spur' | 'plaza' | null (solid hedge), open = [n, e, s, w]
  const cells = [];
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    cells[key(i, j)] = { i, j, type: inPlaza(i, j) ? 'plaza' : null, open: [false, false, false, false], u: 0 };
  }
  const cellAt = (i, j) => (inGrid(i, j) ? cells[key(i, j)] : null);
  const dirTo = (a, b) => DIRS.findIndex(([dx, dz]) => a.i + dx === b.i && a.j + dz === b.j);
  const link = (a, b) => { const d = dirTo(a, b); a.open[d] = true; b.open[(d + 2) % 4] = true; };
  const routeCells = route.map(([i, j]) => cellAt(i, j));
  routeCells.forEach((c, k) => { c.type = 'route'; c.k = k; if (k) link(routeCells[k - 1], c); });
  const entry = routeCells[routeCells.length - 1];
  const entryDir = dirTo(entry, cellAt(entry.i + Math.sign(M - entry.i), entry.j + Math.sign(M - entry.j)));
  entry.open[entryDir] = true;

  /* ---------- The curve through the corridors, with rounded corners ---------- */
  const P = routeCells.map((c) => centre(c.i, c.j));
  P.push(new THREE.Vector3(0, 0, 0)); // the cake, in the middle of the plaza
  const R = 3;
  const way = [P[0].clone()];
  const _q = new THREE.Vector3();
  for (let k = 1; k < P.length - 1; k++) {
    const a = _q.subVectors(P[k], P[k - 1]).normalize().clone();
    const b = new THREE.Vector3().subVectors(P[k + 1], P[k]).normalize();
    if (a.dot(b) > 0.99) continue;
    // quadratic bezier from just before the corner to just after it
    const p0 = P[k].clone().addScaledVector(a, -R), p2 = P[k].clone().addScaledVector(b, R);
    for (let t = 0; t <= 1.0001; t += 1 / 8) {
      way.push(new THREE.Vector3()
        .addScaledVector(p0, (1 - t) * (1 - t)).addScaledVector(P[k], 2 * t * (1 - t)).addScaledVector(p2, t * t));
    }
  }
  way.push(P[P.length - 1].clone());
  const pts = [way[0]];
  for (let k = 1; k < way.length; k++) {
    const a = pts[pts.length - 1], b = way[k];
    const n = Math.ceil(a.distanceTo(b) / 1.5);
    for (let s = 1; s <= n; s++) pts.push(a.clone().lerp(b, s / n));
  }
  const curve = new THREE.CatmullRomCurve3(pts.filter((p, k) => !k || p.distanceTo(pts[k - 1]) > 0.05), false, 'centripetal');
  curve.arcLengthDivisions = 4000;
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

  // Closest point to `p`, searching around a previous index hint (the player moves continuously,
  // and the hint stops it jumping to a different corridor on the other side of a hedge)
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

  const uOfZone = (zone, at = 0) => (zone + at) / ZONE_COUNT;
  routeCells.forEach((c) => { c.u = nearest(centre(c.i, c.j)).u; });
  cells.forEach((c) => { if (c.type === 'plaza') c.u = 1; });

  /* ---------- Dead ends: memory nooks first, then a few that lead nowhere ---------- */
  const lastSpurU = uOfZone(ZONE_COUNT - 1); // keep the birthday stretch clean
  const free = (i, j) => cellAt(i, j)?.type === null;
  function dig(from, d, depth, rand) {
    const cellsDug = [];
    let cur = from;
    for (let s = 0; s < depth; s++) {
      const n = cellAt(cur.i + DIRS[d][0], cur.j + DIRS[d][1]);
      if (!n || n.type !== null) break;
      n.type = 'spur'; n.u = from.u;
      link(cur, n);
      cellsDug.push(n);
      cur = n;
      // sometimes turn a corner on the way in
      if (rand && rand() < 0.4) {
        const turns = [(d + 1) % 4, (d + 3) % 4].filter((t) => free(cur.i + DIRS[t][0], cur.j + DIRS[t][1]));
        if (turns.length) d = turns[Math.floor(rand() * turns.length)];
      }
    }
    return cellsDug.length ? { cell: cur, from, dir: dirTo(cellsDug.length > 1 ? cellsDug[cellsDug.length - 2] : from, cur) } : null;
  }
  const nookOut = nooks.map(() => null);
  nooks.map((u, i) => ({ u, i })).sort((a, b) => a.u - b.u).forEach(({ u, i }) => {
    const options = routeCells
      .filter((c) => c.k > 0 && c.u < lastSpurU && Math.abs(c.u - u) * total < 14)
      .sort((a, b) => Math.abs(a.u - u) - Math.abs(b.u - u));
    for (const c of options) {
      // prefer a nook two cells deep, so it feels like a proper little detour
      const dirs = [0, 1, 2, 3].filter((d) => free(c.i + DIRS[d][0], c.j + DIRS[d][1]))
        .sort((a, b) => free(c.i + 2 * DIRS[b][0], c.j + 2 * DIRS[b][1]) - free(c.i + 2 * DIRS[a][0], c.j + 2 * DIRS[a][1]));
      if (!dirs.length) continue;
      const end = dig(c, dirs[0], 2, null);
      const p = centre(end.cell.i, end.cell.j).addScaledVector(new THREE.Vector3(DIRS[end.dir][0], 0, DIRS[end.dir][1]), 1.4);
      nookOut[i] = { pos: p, dir: end.dir, cell: end.cell, u: c.u };
      return;
    }
  });
  const deadEnds = [];
  {
    const rand = rng(7);
    routeCells.forEach((c) => {
      if (c.k < 2 || c.u >= lastSpurU || rand() > 0.42) return;
      const dirs = [0, 1, 2, 3].filter((d) => free(c.i + DIRS[d][0], c.j + DIRS[d][1]));
      if (!dirs.length) return;
      const end = dig(c, dirs[Math.floor(rand() * dirs.length)], 1 + Math.floor(rand() * 3), rand);
      if (end) deadEnds.push({ pos: centre(end.cell.i, end.cell.j).addScaledVector(new THREE.Vector3(DIRS[end.dir][0], 0, DIRS[end.dir][1]), 1.2), dir: end.dir, u: c.u });
    });
  }

  // every hedge cell takes its colours from the nearest corridor
  {
    let frontier = cells.filter((c) => c.type);
    const done = new Set(frontier);
    while (frontier.length) {
      const next = [];
      for (const c of frontier) for (const [dx, dz] of DIRS) {
        const n = cellAt(c.i + dx, c.j + dz);
        if (n && !done.has(n)) { n.u = c.u; done.add(n); next.push(n); }
      }
      frontier = next;
    }
  }

  /* ---------- Walkable area: rectangles per cell (the middle square plus an arm per open side) ---------- */
  const plazaHalf = 1.5 * C - (C / 2 - face); // hedge ring around the plaza is as thick as the others
  function cellRects(c, h) {
    if (!c.type || c.type === 'plaza') return [];
    const { x, z } = centre(c.i, c.j, _q);
    const out = [{ x0: x - h, x1: x + h, z0: z - h, z1: z + h }];
    if (c.open[0]) out.push({ x0: x - h, x1: x + h, z0: z - C / 2, z1: z });
    if (c.open[1]) out.push({ x0: x, x1: x + C / 2, z0: z - h, z1: z + h });
    if (c.open[2]) out.push({ x0: x - h, x1: x + h, z0: z, z1: z + C / 2 });
    if (c.open[3]) out.push({ x0: x - C / 2, x1: x, z0: z - h, z1: z + h });
    return out;
  }
  // the way in through the plaza hedge: from the entry cell's middle into the plaza
  const entryRect = (h) => {
    const { x, z } = centre(entry.i, entry.j, _q);
    return { x0: Math.min(x, 0) - h, x1: Math.max(x, 0) + h, z0: Math.min(z, 0) - h, z1: Math.max(z, 0) + h };
  };
  const walk = cells.map((c) => cellRects(c, reach));
  const plazaRect = { x0: -plazaHalf + 0.2, x1: plazaHalf - 0.2, z0: -plazaHalf + 0.2, z1: plazaHalf - 0.2 };
  cells.forEach((c, k) => { if (c.type === 'plaza') walk[k].push(plazaRect, entryRect(reach)); });
  walk[key(entry.i, entry.j)].push(entryRect(reach));

  const cellOf = (x, z) => [Math.round(x / C) + M, Math.round(z / C) + M];
  const inside = (r, x, z, m = 0) => x >= r.x0 - m && x <= r.x1 + m && z >= r.z0 - m && z <= r.z1 + m;
  // is (x, z) on the floor? `margin` > 0 is more forgiving, < 0 stricter
  function walkable(x, z, margin = 0) {
    // stricter: the floor must reach |margin| further in every direction (shrinking each rectangle
    // instead would open gaps at the seams between cells)
    if (margin < 0) return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([a, b]) => walkable(x + a * margin, z + b * margin));
    const [i, j] = cellOf(x, z);
    if (!inGrid(i, j)) return false;
    return walk[key(i, j)].some((r) => inside(r, x, z, margin));
  }
  // push a point back onto the floor (to the closest walkable spot nearby)
  function keepInside(p) {
    if (walkable(p.x, p.z)) return p;
    const [ci, cj] = cellOf(p.x, p.z);
    let bx = p.x, bz = p.z, bd = Infinity;
    for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
      if (!inGrid(i, j)) continue;
      for (const r of walk[key(i, j)]) {
        const x = clamp(p.x, r.x0, r.x1), z = clamp(p.z, r.z0, r.z1);
        const d = (x - p.x) ** 2 + (z - p.z) ** 2;
        if (d < bd) { bd = d; bx = x; bz = z; }
      }
    }
    if (bd < Infinity) { p.x = bx; p.z = bz; }
    return p;
  }

  /* ---------- Hedge blocks (everything that isn't floor), as boxes ---------- */
  const hedges = [];
  const box = (x0, x1, z0, z1, u) => hedges.push({ x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, u });
  const e = C / 2;
  cells.forEach((c) => {
    if (c.type === 'plaza') return;
    const { x, z } = centre(c.i, c.j, _q);
    if (!c.type) { box(x - e, x + e, z - e, z + e, c.u); return; }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      box(Math.min(x + sx * face, x + sx * e), Math.max(x + sx * face, x + sx * e), Math.min(z + sz * face, z + sz * e), Math.max(z + sz * face, z + sz * e), c.u);
    }
    if (!c.open[0]) box(x - face, x + face, z - e, z - face, c.u);
    if (!c.open[1]) box(x + face, x + e, z - face, z + face, c.u);
    if (!c.open[2]) box(x - face, x + face, z + face, z + e, c.u);
    if (!c.open[3]) box(x - e, x - face, z - face, z + face, c.u);
  });
  // the ring around the plaza, with a gap where the route comes in
  {
    const o = 1.5 * C, t = o - plazaHalf;
    for (let d = 0; d < 4; d++) {
      const [dx, dz] = DIRS[d];
      const segs = d === entryDir ? [[-o, -face], [face, o]] : [[-o, o]];
      for (const [a, b] of segs) {
        if (dx === 0) box(a, b, dz < 0 ? -o : o - t, dz < 0 ? -o + t : o, 1);
        else box(dx < 0 ? -o : o - t, dx < 0 ? -o + t : o, a, b, 1);
      }
    }
  }

  // the gate sits in the gap of the plaza hedge; the finale starts once she's inside the clearing
  const gateU = 1 - (plazaHalf + 0.6) / total;
  return {
    curve, total, samples: { pos, tan, right, count: SAMPLES },
    frameAt, placeAt, nearest, uOfZone,
    zoneAt: (u) => clamp(Math.floor(u * ZONE_COUNT), 0, ZONE_COUNT - 1),
    gateU,
    finaleU: 1 - 8 / total,
    endU: 1,
    nooks: nookOut,
    maze: {
      cell: C, size: N, half, face, plazaHalf, hedgeHeight: CONFIG.hedgeHeight,
      cells, deadEnds, hedges,
      walkable, keepInside,
      // floor rectangles at a given half-width (for drawing the paths)
      floorRects: (h) => [...cells.flatMap((c) => cellRects(c, h)), entryRect(h)],
      // u of the corridor that owns this spot (hedge cells borrow their nearest corridor's)
      cellU(x, z) {
        const [i, j] = cellOf(x, z);
        return cells[key(clamp(i, 0, N - 1), clamp(j, 0, N - 1))].u;
      },
      cellCentre: (c, out) => centre(c.i, c.j, out),
    },
  };
}
