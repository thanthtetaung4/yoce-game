import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { ZONES, ZONE_COUNT, blendZoneColor } from './zones.js';
import { canvasTexture, heartShape, smoothstep, clamp, ease } from '../utils.js';

// Ground, the path itself, month signposts, the birthday gate and the plaza.
export function createWorld(path) {
  const group = new THREE.Group();
  const hw = CONFIG.pathHalfWidth;
  const end = path.frameAt(1);
  const zEnd = end.pos.z;

  /* ---------- Ground: one big plane, tinted per month, rolling gently away from the path ---------- */
  {
    const len = -zEnd + 160, width = 240;
    const geo = new THREE.PlaneGeometry(width, len, 60, Math.round(len / 3));
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, zEnd / 2);
    const p = geo.attributes.position;
    const colors = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const dist = Math.abs(x - path.xAtZ(z));
      const hills = Math.sin(x * 0.11 + z * 0.05) * 1.3 + Math.sin(x * 0.05 - z * 0.13) * 1.6 + Math.sin(x * 0.31 + z * 0.27) * 0.25;
      // Keep the area around the plaza flat
      const plaza = smoothstep(10, 16, Math.hypot(x - end.pos.x, z - end.pos.z));
      p.setY(i, (hills + 1.4) * smoothstep(hw + 3, hw + 16, dist) * plaza - 0.02);
      const u = clamp(-z / -zEnd, 0, 1);
      blendZoneColor(u, 'ground', c);
      const n = 1 + (Math.sin(x * 1.7) * Math.cos(z * 1.3)) * 0.035;
      colors.set([c.r * n, c.g * n, c.b * n], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    group.add(ground);
  }

  /* ---------- Path ribbon (cream centre, blush edges) + a soft curb ---------- */
  function ribbon(half, y, inner, outer) {
    const { pos, right, count } = path.samples;
    const step = 2, rows = Math.floor((count - 1) / step) + 1;
    const verts = [], cols = [], idx = [];
    const ci = new THREE.Color(inner), co = new THREE.Color(outer);
    for (let r = 0; r < rows; r++) {
      const i = Math.min(count - 1, r * step);
      for (const s of [-1, 0, 1]) {
        verts.push(pos[i].x + right[i].x * half * s, y, pos[i].z + right[i].z * half * s);
        const cc = s === 0 ? ci : co;
        cols.push(cc.r, cc.g, cc.b);
      }
      if (r > 0) {
        const a = (r - 1) * 3, b = r * 3;
        idx.push(a, a + 1, b, a + 1, b + 1, b, a + 1, a + 2, b + 1, a + 2, b + 2, b + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  }
  group.add(ribbon(hw + 0.45, 0.02, '#f6c9d3', '#f3b9c8'));
  group.add(ribbon(hw, 0.04, '#fff6ef', '#fde2e3'));

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

  /* ---------- Birthday plaza ---------- */
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
    const u = path.uOfZone(i, i === 0 ? 0.03 : 0.015);
    const f = path.frameAt(u);
    sign.position.copy(f.pos).addScaledVector(f.right, -(hw + 1.2));
    // face back toward someone walking up the path, angled slightly toward the centre
    const d = f.tan.clone().negate().addScaledVector(f.right, 0.45);
    sign.rotation.y = Math.atan2(d.x, d.z);
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
    const span = hw + 0.5;
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
