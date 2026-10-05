import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { ZONES, ZONE_COUNT, blendZoneColor, styleOf } from './zones.js';
import { canvasTexture, heartShape, smoothstep, ease, rng } from '../utils.js';

// Ground, the hedge maze and its floor, month signposts, the birthday gate and the plaza.
export function createWorld(path) {
  const group = new THREE.Group();
  const hw = CONFIG.pathHalfWidth;
  const end = path.frameAt(1);

  const maze = path.maze;
  const H = maze.hedgeHeight;

  /* ---------- Ground: one big plane, tinted per month, flat inside the maze and rolling hills around it ---------- */
  {
    const size = maze.half * 2 + 150;
    const seg = Math.round(size / 2.5);
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color(), cs = new THREE.Color();
    // soften the month-to-month seams by averaging a few nearby samples (wider out in the hills)
    const RING = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]];
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const out = Math.max(Math.abs(x), Math.abs(z)) - maze.half;
      const hills = Math.sin(x * 0.11 + z * 0.05) * 1.3 + Math.sin(x * 0.05 - z * 0.13) * 1.6 + Math.sin(x * 0.31 + z * 0.27) * 0.25;
      p.setY(i, (hills + 1.6) * smoothstep(3, 18, out) - 0.02);
      const r = 5 + Math.max(0, out) * 0.6;
      c.setRGB(0, 0, 0);
      RING.forEach(([a, b]) => c.add(blendZoneColor(maze.cellU(x + a * r, z + b * r), 'ground', cs)));
      c.multiplyScalar(1 / RING.length);
      const n = 1 + (Math.sin(x * 1.7) * Math.cos(z * 1.3)) * 0.035;
      colors.set([c.r * n, c.g * n, c.b * n], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    group.add(ground);
  }

  /* ---------- Maze floor (cream, with a blush border along the hedges) ---------- */
  function floor(half, y, color) {
    const verts = [], idx = [];
    maze.floorRects(half).forEach((r, k) => {
      verts.push(r.x0, y, r.z0, r.x1, y, r.z0, r.x1, y, r.z1, r.x0, y, r.z1);
      idx.push(k * 4, k * 4 + 2, k * 4 + 1, k * 4, k * 4 + 3, k * 4 + 2);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
  }
  group.add(floor(hw + 0.35, 0.02, '#f3b9c8'));
  group.add(floor(hw, 0.04, '#fff6ef'));

  /* ---------- Hedges: one box per block (darker at the roots), with leafy puffs along the tops ---------- */
  {
    const geo = new THREE.BoxGeometry(1, H, 1, 1, 2, 1).translate(0, H / 2, 0);
    const shade = [];
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const k = 0.74 + 0.26 * (geo.attributes.position.getY(i) / H);
      shade.push(k, k, k);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(shade, 3));
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), maze.hedges.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), c = new THREE.Color();
    const puffs = [];
    const rand = rng(5);
    maze.hedges.forEach((h, i) => {
      mesh.setMatrixAt(i, m.compose(v.set(h.x, 0, h.z), q, sc.set(h.w, 1, h.d)));
      blendZoneColor(h.u, 'hedge', c);
      mesh.setColorAt(i, c);
      // puffs on a loose grid over the top of the block
      const nx = Math.max(1, Math.round(h.w / 1.5)), nz = Math.max(1, Math.round(h.d / 1.5));
      for (let a = 0; a < nx; a++) for (let b = 0; b < nz; b++) {
        puffs.push({
          x: h.x - h.w / 2 + (a + 0.5) * (h.w / nx) + (rand() - 0.5) * 0.3,
          z: h.z - h.d / 2 + (b + 0.5) * (h.d / nz) + (rand() - 0.5) * 0.3,
          s: 0.55 + rand() * 0.3, u: h.u, r: rand() * 6, k: rand(),
        });
      }
    });
    group.add(mesh);
    const puffMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ flatShading: true }), puffs.length);
    const leaf = new THREE.Color();
    puffs.forEach((p, i) => {
      q.setFromAxisAngle(v.set(0, 1, 0), p.r);
      puffMesh.setMatrixAt(i, m.compose(v.set(p.x, H - 0.05, p.z), q, sc.set(p.s * 1.05, p.s * 0.6, p.s * 1.05)));
      // mostly hedge-coloured, a few blossoms in the season's foliage colours
      const st = styleOf(path.zoneAt(p.u));
      blendZoneColor(p.u, 'hedge', c).multiplyScalar(1.06);
      if (p.k < 0.22) c.lerp(leaf.set(st.foliage[Math.floor(p.k * 100) % st.foliage.length]), 0.75);
      puffMesh.setColorAt(i, c);
    });
    group.add(puffMesh);
  }

  /* ---------- Little heart footprints down the middle ---------- */
  {
    const geo = new THREE.ShapeGeometry(heartShape(), 6);
    geo.rotateX(-Math.PI / 2);
    const total = Math.floor(path.total / 3.2);
    const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#f9d0da' }), total);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(0.38, 0.38, 0.38);
    const v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < total; i++) {
      const u = (i + 0.5) / total;
      if (u > 0.985) { s.setScalar(0); }
      const f = path.frameAt(u);
      v.copy(f.pos).addScaledVector(f.right, i % 2 ? 0.35 : -0.35).setY(0.05);
      q.setFromAxisAngle(up, Math.atan2(-f.tan.x, -f.tan.z));
      mesh.setMatrixAt(i, m.compose(v, q, s));
    }
    group.add(mesh);
  }

  /* ---------- Birthday plaza (a clearing in the heart of the maze) ---------- */
  {
    const plaza = new THREE.Mesh(new THREE.CircleGeometry(8.5, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#fff6ef' }));
    plaza.position.copy(end.pos).setY(0.045);
    const ring = new THREE.Mesh(new THREE.RingGeometry(8.5, 9.1, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f3b9c8' }));
    ring.position.copy(end.pos).setY(0.03);
    group.add(plaza, ring);
    // a round pad where the walk begins, so the path doesn't just stop behind her
    const start = path.frameAt(0).pos;
    const pad = new THREE.Mesh(new THREE.CircleGeometry(hw, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#fff6ef' }));
    pad.position.copy(start).setY(0.041);
    const padRing = new THREE.Mesh(new THREE.CircleGeometry(hw + 0.45, 40).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#f6c9d3' }));
    padRing.position.copy(start).setY(0.021);
    group.add(pad, padRing);
  }

  /* ---------- Month signposts ---------- */
  const signs = [];
  const postMat = new THREE.MeshLambertMaterial({ color: '#d9a99b' });
  const postGeo = new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6).translate(0, 1.1, 0);
  const boardGeo = new THREE.BoxGeometry(2.3, 1.15, 0.1);
  const faceGeo = new THREE.PlaneGeometry(2.2, 1.05);
  ZONES.forEach((z, i) => {
    const tex = canvasTexture(512, 256, (g, w, h) => {
      g.fillStyle = PALETTE.paper; g.fillRect(0, 0, w, h);
      g.strokeStyle = PALETTE.rose; g.lineWidth = 14; g.strokeRect(7, 7, w - 14, h - 14);
      g.textAlign = 'center'; g.fillStyle = PALETTE.ink;
      g.font = `600 ${z.name.length > 8 ? 76 : 92}px Fredoka, sans-serif`;
      g.fillText(i === ZONE_COUNT - 1 ? 'Birthday' : z.name, w / 2, 128);
      g.fillStyle = PALETTE.roseDeep; g.font = '700 56px Caveat, cursive';
      g.fillText(i === ZONE_COUNT - 1 ? CONFIG.birthdayLabel : String(z.year), w / 2, 205);
    });
    const sign = new THREE.Group();
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.z = -0.14;
    const board = new THREE.Mesh(boardGeo, new THREE.MeshLambertMaterial({ color: '#f6dfe4' }));
    board.position.y = 1.85;
    const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    face.position.set(0, 1.85, 0.056);
    sign.add(post, board, face);
    // near the start of the month, beside the path, nudged along until the whole board is clear of the hedges
    const u0 = path.uOfZone(i, i === 0 ? 0.03 : 0.015);
    let placed = null;
    for (const shift of [0, 1, -1, 2, -2, 3, 4, 5, 6, 7, 8]) {
      for (const side of [-1, 1]) {
        const f = path.frameAt(u0 + shift / path.total);
        const p = f.pos.clone().addScaledVector(f.right, side * (hw - 1.15));
        // face back toward someone walking up the path, angled slightly toward the centre
        const d = f.tan.clone().negate().addScaledVector(f.right, -side * 0.3);
        const ry = Math.atan2(d.x, d.z);
        const across = new THREE.Vector3(Math.cos(ry), 0, -Math.sin(ry)); // the board's width
        const ends = [1.2, -1.2].map((k) => p.clone().addScaledVector(across, k));
        if (ends.every((q) => maze.walkable(q.x, q.z, -0.1))) { placed = { p, ry }; break; }
      }
      if (placed) break;
    }
    if (!placed) { const f = path.frameAt(u0); placed = { p: f.pos.clone().addScaledVector(f.right, -(hw - 1.15)), ry: Math.atan2(-f.tan.x, -f.tan.z) }; }
    sign.position.copy(placed.p);
    sign.rotation.y = placed.ry;
    group.add(sign);
    signs.push(sign);
  });

  /* ---------- Birthday gate: balloon arch + a ribbon that opens once every memory is found ---------- */
  const gate = new THREE.Group();
  const ribbonPivots = [];
  {
    const f = path.frameAt(path.gateU);
    gate.position.copy(f.pos);
    gate.rotation.y = Math.atan2(f.tan.x, f.tan.z);
    const span = hw + 0.55; // pillars stand at the edges of the gap in the hedge
    const pillarMat = new THREE.MeshLambertMaterial({ color: PALETTE.lavender });
    const pillarGeo = new THREE.CylinderGeometry(0.22, 0.26, 2.4, 10).translate(0, 1.2, 0);
    const ribbonMat = new THREE.MeshLambertMaterial({ color: '#f08fab' });
    for (const s of [-1, 1]) {
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.x = s * span;
      gate.add(pillar);
      // each half of the ribbon hangs from its pillar
      const pivot = new THREE.Group();
      pivot.position.set(s * span, 1.25, 0);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(span, 0.24, 0.05), ribbonMat);
      strip.position.x = -s * span / 2;
      pivot.add(strip);
      gate.add(pivot);
      ribbonPivots.push({ pivot, s });
    }
    // bow in the middle
    const bow = new THREE.Group();
    const loop = new THREE.ConeGeometry(0.28, 0.5, 8).rotateZ(Math.PI / 2).translate(0.24, 0, 0);
    const l = new THREE.Mesh(loop, ribbonMat), r = new THREE.Mesh(loop, ribbonMat);
    r.rotation.z = Math.PI;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), ribbonMat);
    bow.add(l, r, knot);
    bow.position.set(0, 1.25, 0.04);
    gate.add(bow);
    ribbonPivots.bow = bow;

    // balloon arch
    const n = 21, R = span;
    const balloon = new THREE.SphereGeometry(0.34, 12, 10);
    const arch = new THREE.InstancedMesh(balloon, new THREE.MeshLambertMaterial({ color: '#fff' }), n);
    const m = new THREE.Matrix4(), cc = new THREE.Color();
    const archColors = ['#f6b8c8', '#dccdf4', '#fde0cf', '#ffffff', '#f2a7bb'];
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (i / (n - 1));
      m.makeTranslation(Math.cos(a) * R, 2.4 + Math.sin(a) * R * 0.75, (i % 2) * 0.12);
      arch.setMatrixAt(i, m);
      arch.setColorAt(i, cc.set(archColors[i % archColors.length]));
    }
    gate.add(arch);
  }
  group.add(gate);

  let gateOpen = 0, gateTarget = 0;
  return {
    group, signs, gate,
    setGateOpen(open, instant = false) {
      gateTarget = open ? 1 : 0;
      if (instant) gateOpen = gateTarget;
    },
    update(dt) {
      gateOpen += (gateTarget - gateOpen) * Math.min(1, dt * 1.6);
      const k = ease.outCubic(gateOpen);
      ribbonPivots.forEach(({ pivot, s }) => { pivot.rotation.z = s * k * 1.45; });
      ribbonPivots.bow.scale.setScalar(Math.max(0.001, 1 - k));
    },
  };
}
