import * as THREE from 'three';
import { PALETTE } from '../config.js';
import { ease, glowTexture, heartShape, clamp, isTouch, reduceMotion } from '../utils.js';

// The birthday moment: the cake pops up, the camera frames it, confetti, then candles to blow out.
export function createEnding(path, age) {
  const end = path.frameAt(1);
  const group = new THREE.Group();
  group.position.copy(end.pos);
  group.rotation.y = Math.atan2(-end.tan.x, -end.tan.z); // local +z faces back toward the player

  /* ---------- Cake ---------- */
  const cake = new THREE.Group();
  group.add(cake);
  const mat = (c, e) => new THREE.MeshLambertMaterial({ color: c, ...e });
  const tier = (r, h, y, color) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 40), mat(color));
    m.position.y = y + h / 2;
    cake.add(m);
    // frosting rim + drips
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r - 0.02, 0.09, 8, 40), mat('#fff6f1'));
    rim.rotation.x = Math.PI / 2; rim.position.y = y + h;
    cake.add(rim);
    const drips = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.07, 0.18, 3, 6), mat('#fff6f1'), 16);
    const mm = new THREE.Matrix4();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2, len = 0.6 + ((i * 7) % 5) * 0.12;
      mm.compose(new THREE.Vector3(Math.cos(a) * r, y + h - 0.12 * len, Math.sin(a) * r), new THREE.Quaternion(), new THREE.Vector3(1, len, 1));
      drips.setMatrixAt(i, mm);
    }
    cake.add(drips);
  };
  // plate
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.0, 0.12, 40), mat('#ffffff'));
  plate.position.y = 0.06;
  cake.add(plate);
  tier(1.7, 1.0, 0.12, '#f7c6d3');
  tier(1.15, 0.8, 1.12, '#e6d8f7');
  // sprinkles
  {
    const n = 70;
    const spr = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.025, 0.08, 2, 4), new THREE.MeshLambertMaterial({ color: '#fff' }), n);
    const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color();
    const cols = ['#f27c9e', '#b9a2e6', '#f7b89a', '#ffffff', '#9fd3c7'];
    for (let i = 0; i < n; i++) {
      const top = i < 30;
      const a = i * 2.39996, r = top ? 0.25 + Math.sqrt(i / 30) * 0.8 : 1.71;
      const y = top ? 1.93 : 0.35 + ((i * 13) % 9) * 0.06;
      q.setFromEuler(new THREE.Euler(Math.PI / 2 * (i % 2), a, (i % 3) * 0.8));
      mm.compose(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
      spr.setMatrixAt(i, mm);
      spr.setColorAt(i, c.set(cols[i % cols.length]));
    }
    cake.add(spr);
  }

  /* ---------- Number candles (e.g. "2" "1"), built from rounded strokes ---------- */
  const candleMat = mat('#fdf0f4', { emissive: '#f6b8c8', emissiveIntensity: 0.25 });
  const stroke = (a, b, r = 0.085) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 10), candleMat);
    m.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0);
    m.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2;
    return m;
  };
  const DIGITS = {
    0: (g) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.085, 8, 24), candleMat); t.scale.y = 1.45; t.position.y = 0.52; g.add(t); return [0, 0.98]; },
    1: (g) => { g.add(stroke([0.05, 0.08], [0.05, 0.96]), stroke([0.05, 0.96], [-0.16, 0.8])); return [0.05, 1.05]; },
    2: (g) => {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.085, 8, 20, Math.PI * 1.22), candleMat);
      arc.position.set(0, 0.72, 0); arc.rotation.z = -0.7;
      g.add(arc, stroke([0.18, 0.56], [-0.24, 0.08]), stroke([-0.24, 0.08], [0.26, 0.08]));
      return [0, 1.05];
    },
    3: (g) => {
      [0.72, 0.3].forEach((y) => { const a = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.085, 8, 20, Math.PI * 1.5), candleMat); a.position.set(0, y, 0); a.rotation.z = -Math.PI * 0.75; g.add(a); });
      return [0, 1.02];
    },
    4: (g) => { g.add(stroke([0.12, 0.08], [0.12, 0.96]), stroke([0.12, 0.96], [-0.24, 0.36]), stroke([-0.24, 0.36], [0.26, 0.36])); return [0.12, 1.05]; },
    5: (g) => {
      g.add(stroke([0.22, 0.96], [-0.18, 0.96]), stroke([-0.18, 0.96], [-0.2, 0.6]));
      const a = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.085, 8, 20, Math.PI * 1.45), candleMat); a.position.set(0, 0.36, 0); a.rotation.z = -Math.PI * 0.62; g.add(a);
      return [0, 1.05];
    },
    6: (g) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.085, 8, 24), candleMat); t.position.y = 0.32; g.add(t, stroke([-0.22, 0.38], [0.14, 0.96])); return [0.14, 1.05]; },
    7: (g) => { g.add(stroke([-0.24, 0.96], [0.24, 0.96]), stroke([0.24, 0.96], [-0.08, 0.08])); return [-0.24, 1.05]; },
    8: (g) => { [0.72, 0.3].forEach((y, k) => { const t = new THREE.Mesh(new THREE.TorusGeometry(k ? 0.24 : 0.19, 0.085, 8, 24), candleMat); t.position.y = y; g.add(t); }); return [0, 1.02]; },
    9: (g) => { const t = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.085, 8, 24), candleMat); t.position.y = 0.72; g.add(t, stroke([0.22, 0.66], [-0.14, 0.08])); return [0, 1.05]; },
  };
  const flames = [];
  const flameGeo = new THREE.SphereGeometry(0.11, 12, 8).scale(1, 1.7, 1).translate(0, 0.17, 0);
  const flameMat = new THREE.MeshBasicMaterial({ color: '#ffd27a', toneMapped: false });
  const digits = String(age).split('');
  digits.forEach((d, i) => {
    const g = new THREE.Group();
    const [wx, wy] = (DIGITS[d] || DIGITS[0])(g);
    g.position.set((i - (digits.length - 1) / 2) * 0.75, 1.95, 0.1);
    g.scale.setScalar(0.85);
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.12, 4), mat('#6b4a55'));
    wick.position.set(wx, wy, 0);
    const flame = new THREE.Group();
    flame.position.set(wx, wy + 0.04, 0);
    flame.add(new THREE.Mesh(flameGeo, flameMat));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffcf8a', transparent: true, opacity: 0.8, depthWrite: false }));
    halo.scale.setScalar(0.9); halo.position.y = 0.18;
    flame.add(halo);
    g.add(wick, flame);
    cake.add(g);
    flames.push({ flame, out: 0, ph: i * 2.1 });
  });

  /* ---------- Balloons tied around the plaza (they float away after the wish) ---------- */
  const BN = 14;
  const balloonGeo = new THREE.SphereGeometry(0.45, 14, 10).scale(1, 1.18, 1);
  const balloons = new THREE.InstancedMesh(balloonGeo, new THREE.MeshLambertMaterial({ color: '#fff', emissive: '#fff', emissiveIntensity: 0.12 }), BN);
  balloons.frustumCulled = false;
  const bData = [];
  const bc = new THREE.Color();
  for (let i = 0; i < BN; i++) {
    const a = (i / BN) * Math.PI * 2 + 0.2;
    const r = 6.8 + (i % 3) * 0.6;
    bData.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, h: 2.8 + (i % 4) * 0.45, ph: i, vy: 0, rise: 0 });
    balloons.setColorAt(i, bc.set(PALETTE.confetti[i % PALETTE.confetti.length]));
  }
  // keep the way in clear: no balloons right in front of the player's approach
  const bKeep = bData.filter((b) => !(b.z > 1.5 && Math.abs(b.x) < 6));
  balloons.count = bKeep.length;
  group.add(balloons);
  const stringPos = new Float32Array(bKeep.length * 6);
  const strings = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#c9a3b4' }));
  strings.geometry.setAttribute('position', new THREE.BufferAttribute(stringPos, 3));
  strings.frustumCulled = false;
  group.add(strings);

  /* ---------- Confetti (instanced, simple physics) ---------- */
  const CN = isTouch || reduceMotion ? 260 : 480;
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.13, 0.08), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false }), CN);
  confetti.frustumCulled = false;
  confetti.count = 0;
  const parts = Array.from({ length: CN }, (_, i) => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: new THREE.Euler(), w: new THREE.Vector3(), life: 0 }));
  const cc = new THREE.Color();
  parts.forEach((_, i) => confetti.setColorAt(i, cc.set(PALETTE.confetti[i % PALETTE.confetti.length])));
  group.add(confetti);
  let cursor = 0;
  function burst(n, origin, spread = 1, up = 7) {
    for (let k = 0; k < n; k++) {
      const p = parts[cursor];
      cursor = (cursor + 1) % CN;
      p.p.copy(origin);
      const a = Math.random() * Math.PI * 2, s = (0.5 + Math.random()) * 3.2 * spread;
      p.v.set(Math.cos(a) * s, up * (0.6 + Math.random() * 0.6), Math.sin(a) * s);
      p.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.w.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
      p.life = 4 + Math.random() * 2;
    }
    confetti.count = CN;
  }

  /* ---------- Floating hearts after the wish ---------- */
  const HN = 18;
  const hearts = new THREE.InstancedMesh(new THREE.ShapeGeometry(heartShape(), 8), new THREE.MeshBasicMaterial({ color: '#f59ab3', side: THREE.DoubleSide, transparent: true, opacity: 0.9, toneMapped: false }), HN);
  hearts.frustumCulled = false;
  hearts.count = 0;
  const hData = Array.from({ length: HN }, (_, i) => ({ x: (Math.random() - 0.5) * 5, z: (Math.random() - 0.5) * 3, y: 0, s: 0.25 + Math.random() * 0.3, d: Math.random() * 1.5, ph: i }));
  group.add(hearts);

  // Hidden until the moment comes
  const state = { phase: 'idle', t: 0, rise: 0, wished: 0 };
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  const camFrom = new THREE.Vector3(), lookFrom = new THREE.Vector3();
  const camTo = new THREE.Vector3(), lookTo = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const standAt = new THREE.Vector3(), walkFrom = new THREE.Vector3();

  function reset() {
    state.phase = 'idle'; state.t = 0; state.rise = 0; state.wished = 0;
    cake.position.y = -3; cake.scale.setScalar(0.001); cake.visible = false;
    flames.forEach((f) => { f.out = 0; f.flame.scale.setScalar(1); });
    bKeep.forEach((b) => { b.rise = 0; b.vy = 0; });
    parts.forEach((p) => { p.life = 0; });
    confetti.count = 0;
    hearts.count = 0;
    hData.forEach((h) => { h.y = 0; });
  }
  reset();

  const local = (x, y, z, out) => group.localToWorld(out.set(x, y, z));

  return {
    group,
    get active() { return state.phase !== 'idle'; },
    reset,
    // Begin the cinematic: camera eases to a framed view, the character walks up to the cake.
    start(camera, lookTarget, playerPos) {
      state.phase = 'intro'; state.t = 0;
      cake.visible = true;
      group.updateMatrixWorld(true);
      camFrom.copy(camera.position);
      lookFrom.copy(lookTarget);
      const portrait = window.innerWidth / window.innerHeight < 0.8;
      local(portrait ? 1.6 : 2.6, portrait ? 7.5 : 5.6, portrait ? 15.5 : 12, camTo);
      local(-0.4, portrait ? -0.6 : 0.4, 0, lookTo);
      walkFrom.copy(playerPos);
      local(-2.1, 0, 2.5, standAt);
    },
    wish() {
      if (state.phase !== 'done-intro') return;
      state.phase = 'wish'; state.wished = 0;
      burst(Math.round(CN * 0.45), new THREE.Vector3(0, 2.6, 0), 1.2, 8);
      setTimeout(() => burst(Math.round(CN * 0.35), new THREE.Vector3(0, 2.6, 0), 1.6, 9), 500);
      hearts.count = HN;
    },
    // Returns events for the UI: 'card' when the closing card should appear
    update(dt, camera, player) {
      const events = [];
      const t = (state.t += dt);
      const flicker = (f) => 1 + Math.sin(t * 18 + f.ph) * 0.06 + Math.sin(t * 31 + f.ph) * 0.04;

      if (state.phase === 'intro' || state.phase === 'done-intro') {
        // camera glide
        const k = ease.inOutCubic(clamp(t / 2.8, 0, 1));
        camera.position.lerpVectors(camFrom, camTo, k);
        tmpLook.lerpVectors(lookFrom, lookTo, k);
        camera.lookAt(tmpLook);
        // character walks to the cake
        const w = ease.inOutCubic(clamp(t / 1.8, 0, 1));
        player.position.lerpVectors(walkFrom, standAt, w);
        player.object.position.copy(player.position);
        local(0, 0, 0, v);
        const face = Math.atan2(v.x - player.position.x, v.z - player.position.z);
        player.object.rotation.y = face;
        player.character.update(dt, w < 1 ? 0.7 : 0);
        // cake pops up
        const r = clamp((t - 0.9) / 1.3, 0, 1);
        cake.position.y = -3 + 3 * ease.outBack(r, 1.4);
        cake.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * ease.outBack(r, 2)));
        if (state.phase === 'intro' && t > 2.3) { burst(Math.round(CN * 0.4), new THREE.Vector3(0, 2.8, 0), 1, 7.5); events.push('burst'); }
        if (state.phase === 'intro' && t > 3.1) { state.phase = 'done-intro'; events.push('card'); }
        flames.forEach((f) => f.flame.scale.set(1, flicker(f), 1));
      }

      if (state.phase === 'wish') {
        state.wished += dt;
        flames.forEach((f) => { f.out = Math.min(1, f.out + dt * 4); f.flame.scale.setScalar(Math.max(0.0001, 1 - f.out)); });
        player.character.cheer(state.wished);
        bKeep.forEach((b, i) => { if (state.wished > 0.4 + i * 0.08) { b.vy = Math.min(2.4, b.vy + dt * 1.4); b.rise += b.vy * dt; } });
        hData.forEach((h, i) => { if (state.wished > h.d) h.y += dt * (1 + (i % 3) * 0.3); });
      }

      // balloons + strings
      bKeep.forEach((b, i) => {
        const sway = Math.sin(t * 1.2 + b.ph) * 0.12;
        v.set(b.x + sway, b.h + b.rise + Math.sin(t * 1.5 + b.ph) * 0.08, b.z);
        balloons.setMatrixAt(i, m.compose(v, q.identity(), s.setScalar(1)));
        stringPos.set([b.x, b.rise * 0.9, b.z, v.x, v.y - 0.5, v.z], i * 6);
      });
      balloons.instanceMatrix.needsUpdate = true;
      strings.geometry.attributes.position.needsUpdate = true;

      // confetti
      if (confetti.count) {
        let alive = 0;
        parts.forEach((p, i) => {
          if (p.life > 0) {
            p.life -= dt;
            p.v.y -= 9 * dt;
            p.v.multiplyScalar(1 - 1.6 * dt);
            p.v.y = Math.max(p.v.y, -1.6);
            p.p.addScaledVector(p.v, dt);
            if (p.p.y < 0.05) { p.p.y = 0.05; p.v.set(0, 0, 0); }
            p.r.x += p.w.x * dt; p.r.y += p.w.y * dt; p.r.z += p.w.z * dt;
            alive++;
            m.compose(p.p, q.setFromEuler(e.copy(p.r)), s.setScalar(p.life < 0.6 ? p.life / 0.6 : 1));
          } else m.makeScale(0, 0, 0);
          confetti.setMatrixAt(i, m);
        });
        confetti.instanceMatrix.needsUpdate = true;
        if (!alive) confetti.count = 0;
      }

      // hearts drifting up
      if (hearts.count) {
        hData.forEach((h, i) => {
          v.set(h.x + Math.sin(t + h.ph) * 0.3, 1.8 + h.y, h.z);
          const fade = h.y > 0 ? clamp(1 - h.y / 9, 0, 1) : 0;
          hearts.setMatrixAt(i, m.compose(v, q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(t * 2 + h.ph) * 0.4), s.setScalar(h.s * fade)));
        });
        hearts.instanceMatrix.needsUpdate = true;
      }
      return events;
    },
  };
}
