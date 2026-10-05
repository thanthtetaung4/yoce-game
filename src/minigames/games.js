import * as THREE from 'three';
import { glowTexture, heartShape, ease, clamp } from '../utils.js';

// The six mini-games. Each one lives in its own month of the path and shares the same shape:
//   start()                      targets appear
//   update(dt, playerPos, t, active) → how many targets were collected this frame (by walking into them)
//   clickables()                 meshes that can be clicked/tapped
//   hit(mesh) → true             when a click collected something
//   finish(instant)              the month's "after" look (sun out, lanterns lit, …)
//   reset()

// Spread targets through the month, leaving room for the rune stone at the start
const uAt = (ctx, k, n, lo = 0.22, hi = 0.92) => ctx.path.uOfZone(ctx.zone, lo + (hi - lo) * ((k + 0.5) / n));
const glowSprite = (color, scale = 1, opacity = 0.8) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
};
const dist2D = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const appear = (obj, t) => obj.scale.setScalar(Math.max(0.0001, ease.outBack(clamp(t, 0, 1), 2)));
const hitSphere = (r) => new THREE.Mesh(new THREE.SphereGeometry(r, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));

/* ---------- Clear the rain clouds (click) ---------- */
function clouds(ctx) {
  const { group, count, rand, path } = ctx;
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  const beamGeo = new THREE.CylinderGeometry(0.45, 1.1, 7, 16, 1, true).translate(0, -3.5, 0);
  const items = [];
  const DROPS = 22;
  const rainPos = new Float32Array(count * DROPS * 3).fill(-999);
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.Points(rainGeo, new THREE.PointsMaterial({ color: '#9fb3e0', size: 0.09, transparent: true, opacity: 0.8, depthWrite: false }));
  rain.frustumCulled = false;
  group.add(rain);

  for (let k = 0; k < count; k++) {
    const g = new THREE.Group();
    g.position.copy(path.placeAt(uAt(ctx, k, count), (rand() - 0.5) * 9, 3.7 + rand() * 1.1));
    const mat = new THREE.MeshLambertMaterial({ color: '#a79ab9', flatShading: true, transparent: true });
    for (let p = 0; p < 4; p++) {
      const m = new THREE.Mesh(puffGeo, mat);
      m.position.set((p - 1.5) * 0.9, (p % 2) * 0.35, (rand() - 0.5) * 0.6);
      m.scale.setScalar(p === 1 || p === 2 ? 1.1 : 0.8);
      g.add(m);
    }
    const hit = hitSphere(2.4);
    g.add(hit);
    const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: '#fff1b8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    beam.position.copy(g.position);
    group.add(g, beam);
    items.push({ g, mat, hit, beam, cleared: false, t: 0, ph: rand() * 6 });
  }
  let shown = false, spawnT = 0;
  function setVisible(v) { items.forEach((it) => { it.g.visible = v; }); rain.visible = v; }
  setVisible(false);

  return {
    start() { shown = true; spawnT = 0; setVisible(true); },
    update(dt, playerPos, t) {
      if (!shown && !items.some((i) => i.cleared)) return 0;
      spawnT += dt;
      items.forEach((it, k) => {
        if (!it.cleared) {
          appear(it.g, spawnT * 1.5 - k * 0.1);
          it.g.position.y += Math.sin(t * 0.8 + it.ph) * 0.003;
        } else {
          it.t += dt;
          it.g.scale.setScalar(1 + it.t * 1.5);
          it.mat.opacity = Math.max(0, 1 - it.t * 2);
          it.g.visible = it.mat.opacity > 0;
          it.beam.material.opacity = Math.min(0.16, it.t * 0.25) * (0.85 + 0.15 * Math.sin(t * 2 + it.ph));
        }
        // rain under each grey cloud
        for (let d = 0; d < DROPS; d++) {
          const i = (k * DROPS + d) * 3;
          if (it.cleared || !it.g.visible) { rainPos[i + 1] = -999; continue; }
          if (rainPos[i + 1] < 0) {
            rainPos[i] = it.g.position.x + (Math.random() - 0.5) * 3.2;
            rainPos[i + 1] = it.g.position.y - 0.4 - Math.random() * 4;
            rainPos[i + 2] = it.g.position.z + (Math.random() - 0.5) * 1.6;
          }
          rainPos[i + 1] -= dt * 9;
        }
      });
      rainGeo.attributes.position.needsUpdate = true;
      return 0;
    },
    clickables: () => items.filter((i) => !i.cleared && i.g.visible).map((i) => i.hit),
    hit(mesh) {
      const it = items.find((i) => i.hit === mesh);
      if (!it || it.cleared) return false;
      it.cleared = true; it.t = 0;
      ctx.burst.emit(it.g.position, 22, ['#fff0a6', '#ffffff', '#cfe3f0']);
      return true;
    },
    finish(instant) {
      shown = false;
      items.forEach((it) => { it.cleared = true; if (instant) { it.t = 5; it.g.visible = false; } });
      if (instant) items.forEach((it) => { it.beam.material.opacity = 0.16; });
    },
    reset() {
      shown = false;
      items.forEach((it) => { it.cleared = false; it.t = 0; it.mat.opacity = 1; it.g.scale.setScalar(1); it.beam.material.opacity = 0; });
      setVisible(false);
    },
  };
}

/* ---------- Light the lanterns (walk up to them) ---------- */
function lanterns(ctx) {
  const { group, count, path, hw } = ctx;
  const postGeo = new THREE.CylinderGeometry(0.05, 0.07, 1.7, 6).translate(0, 0.85, 0);
  const postMat = new THREE.MeshLambertMaterial({ color: '#8c7aa3' });
  const boxGeo = new THREE.BoxGeometry(0.34, 0.44, 0.34).translate(0, 1.9, 0);
  const capGeo = new THREE.ConeGeometry(0.3, 0.22, 4).rotateY(Math.PI / 4).translate(0, 2.23, 0);
  const darkMat = new THREE.MeshLambertMaterial({ color: '#6f6189' });
  const litMat = new THREE.MeshBasicMaterial({ color: '#ffe3a8', toneMapped: false });
  const items = [];
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group();
    g.position.copy(path.placeAt(uAt(ctx, k, count), (k % 2 ? 1 : -1) * (hw + 0.35)));
    const box = new THREE.Mesh(boxGeo, darkMat);
    const glow = glowSprite('#ffd38a', 2.2, 0.9);
    glow.position.y = 1.9; glow.visible = false;
    const hint = glowSprite('#cbb8ff', 1.1, 0.5); // faint shimmer so she can find the unlit ones
    hint.position.y = 1.9;
    g.add(new THREE.Mesh(postGeo, postMat), box, new THREE.Mesh(capGeo, postMat), glow, hint);
    group.add(g);
    items.push({ g, box, glow, hint, lit: false, t: 0 });
  }
  let shown = false, spawnT = 0;
  const setVisible = (v) => items.forEach((it) => { it.g.visible = v; });
  setVisible(false);
  function light(it) { it.lit = true; it.t = 0; it.box.material = litMat; it.glow.visible = true; it.hint.visible = false; }
  return {
    start() { shown = true; spawnT = 0; setVisible(true); },
    update(dt, playerPos, t, active) {
      if (!shown) return 0;
      spawnT += dt;
      let got = 0;
      items.forEach((it, k) => {
        if (spawnT < 2) appear(it.g, spawnT * 1.6 - k * 0.08);
        if (it.lit) { it.t += dt; it.glow.scale.setScalar(2.2 + Math.sin(t * 3 + k) * 0.15 + Math.max(0, 1 - it.t) * 2); }
        else {
          it.hint.material.opacity = 0.3 + 0.25 * Math.sin(t * 2.5 + k);
          if (active && dist2D(playerPos, it.g.position) < 1.7) {
            light(it);
            ctx.burst.emit(it.g.position.clone().setY(1.9), 18, ['#ffe3a8', '#fff0a6', '#ffffff']);
            got++;
          }
        }
      });
      return got;
    },
    clickables: () => [],
    hit: () => false,
    finish() { shown = true; setVisible(true); items.forEach((it) => { if (!it.lit) light(it); it.g.scale.setScalar(1); }); },
    reset() { shown = false; items.forEach((it) => { it.lit = false; it.box.material = darkMat; it.glow.visible = false; it.hint.visible = true; }); setVisible(false); },
  };
}

/* ---------- Squash the bugs (click or walk into them; they scurry away) ---------- */
function bugs(ctx) {
  const { group, count, path, hw, rand } = ctx;
  const bodyGeo = new THREE.SphereGeometry(0.2, 12, 8).scale(1, 0.7, 1.35);
  const headGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const eyeGeo = new THREE.SphereGeometry(0.045, 6, 6);
  const antGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 4).translate(0, 0.11, 0);
  const legGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.22, 4).rotateZ(Math.PI / 2);
  const bodyMat = new THREE.MeshLambertMaterial({ color: '#8f6fd6', emissive: '#6b4fc0', emissiveIntensity: 0.25 });
  const darkMat = new THREE.MeshLambertMaterial({ color: '#3b2f52' });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#c9ff9e', toneMapped: false }); // glitchy green eyes
  const u0 = ctx.path.uOfZone(ctx.zone, 0.2), u1 = ctx.path.uOfZone(ctx.zone, 0.95);
  const items = [];
  const v = new THREE.Vector3();
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group();
    const body = new THREE.Group();
    body.add(new THREE.Mesh(bodyGeo, bodyMat));
    const head = new THREE.Mesh(headGeo, darkMat); head.position.set(0, 0.02, 0.27);
    body.add(head);
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(s * 0.06, 0.07, 0.36); body.add(e);
      const a = new THREE.Mesh(antGeo, darkMat); a.position.set(s * 0.05, 0.1, 0.32); a.rotation.set(0.6, 0, -s * 0.4); body.add(a);
      for (let l = 0; l < 3; l++) { const leg = new THREE.Mesh(legGeo, darkMat); leg.position.set(s * 0.2, -0.06, -0.1 + l * 0.12); body.add(leg); }
    });
    body.position.y = 0.14;
    const hit = hitSphere(0.7); hit.position.y = 0.2;
    g.add(body, hit);
    g.position.copy(path.placeAt(uAt(ctx, k, count), (rand() - 0.5) * 2 * (hw - 0.6)));
    group.add(g);
    items.push({ g, body, hit, heading: rand() * 6.28, turn: 0, hint: -1, squashed: false, t: 0, ph: rand() * 6 });
  }
  let shown = false, spawnT = 0;
  const setVisible = (vis) => items.forEach((it) => { it.g.visible = vis; });
  setVisible(false);
  function squash(it) { it.squashed = true; it.t = 0; ctx.burst.emit(it.g.position.clone().setY(0.3), 20, ['#c9ff9e', '#dccdf4', '#ffffff']); }

  return {
    start() { shown = true; spawnT = 0; setVisible(true); },
    update(dt, playerPos, t, active) {
      if (!shown) return 0;
      spawnT += dt;
      let got = 0;
      items.forEach((it, k) => {
        if (it.squashed) {
          it.t += dt;
          it.g.scale.set(1 + it.t, Math.max(0.05, 1 - it.t * 6), 1 + it.t);
          it.g.visible = it.t < 0.5;
          return;
        }
        if (spawnT < 2) appear(it.g, spawnT * 1.6 - k * 0.08);
        // wander, and scurry away when she gets close
        const d = dist2D(playerPos, it.g.position);
        let speed = 1.1;
        if (d < 3.5) {
          const away = Math.atan2(it.g.position.x - playerPos.x, it.g.position.z - playerPos.z);
          it.heading += (((away - it.heading + Math.PI * 3) % (Math.PI * 2)) - Math.PI) * Math.min(1, dt * 5);
          speed = 2.6;
        } else {
          it.turn += (Math.random() - 0.5) * dt * 6;
          it.turn *= 0.96;
          it.heading += it.turn * dt * 3;
        }
        v.set(Math.sin(it.heading), 0, Math.cos(it.heading)).multiplyScalar(speed * dt);
        it.g.position.add(v);
        // stay on the path and inside this month
        const n = path.nearest(it.g.position, it.hint);
        it.hint = n.index;
        const lim = hw - 0.5;
        if (Math.abs(n.lateral) > lim) { it.g.position.addScaledVector(n.right, (lim - Math.abs(n.lateral)) * Math.sign(n.lateral)); it.heading += Math.PI * 0.6; }
        if (n.u < u0 || n.u > u1) { it.g.position.addScaledVector(n.tan, (n.u < u0 ? 1 : -1) * speed * dt * 2); it.heading += Math.PI; }
        it.g.rotation.y = it.heading;
        it.body.rotation.z = Math.sin(t * 18 + it.ph) * 0.12;
        it.body.position.y = 0.14 + Math.abs(Math.sin(t * 18 + it.ph)) * 0.03;
        if (active && d < 0.8) { squash(it); got++; }
      });
      return got;
    },
    clickables: () => items.filter((i) => !i.squashed && i.g.visible).map((i) => i.hit),
    hit(mesh) {
      const it = items.find((i) => i.hit === mesh);
      if (!it || it.squashed) return false;
      squash(it);
      return true;
    },
    finish() { shown = false; items.forEach((it) => { it.squashed = true; it.t = 1; it.g.visible = false; }); },
    reset() {
      shown = false;
      items.forEach((it, k) => { it.squashed = false; it.t = 0; it.g.scale.setScalar(1); it.hint = -1; it.g.position.copy(path.placeAt(uAt(ctx, k, count), (Math.random() - 0.5) * 2 * (hw - 0.6))); });
      setVisible(false);
    },
  };
}

/* ---------- Gather the heart pieces (walk through them) ---------- */
function shards(ctx) {
  const { group, count, path, hw, rand, stonePos } = ctx;
  const shardGeo = new THREE.OctahedronGeometry(0.22, 0).scale(0.8, 1.3, 0.8);
  const shardMat = new THREE.MeshBasicMaterial({ color: '#ff9fc1', toneMapped: false });
  const items = [];
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shardGeo, shardMat), glowSprite('#ffb3cf', 1.4, 0.75));
    g.position.copy(path.placeAt(uAt(ctx, k, count), (k % 2 ? 1 : -1) * (0.6 + rand() * (hw - 1.2)), 0.95));
    g.userData.home = g.position.clone();
    group.add(g);
    items.push({ g, got: false, t: 0, ph: rand() * 6 });
  }
  // the mended heart floats above the rune stone once every piece is found
  const heart = new THREE.Mesh(
    new THREE.ExtrudeGeometry(heartShape(), { depth: 0.25, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 2, curveSegments: 10 }).center(),
    new THREE.MeshLambertMaterial({ color: '#ff8fb5', emissive: '#ff9fc1', emissiveIntensity: 0.55 }),
  );
  const heartGlow = glowSprite('#ffc2d8', 3, 0.7);
  const heartG = new THREE.Group();
  heartG.add(heart, heartGlow);
  heartG.position.copy(stonePos).setY(3.5);
  heartG.visible = false;
  group.add(heartG);

  let shown = false, spawnT = 0, heartT = 0;
  const setVisible = (vis) => items.forEach((it) => { it.g.visible = vis; });
  setVisible(false);
  return {
    start() { shown = true; spawnT = 0; setVisible(true); },
    update(dt, playerPos, t, active) {
      if (heartG.visible) {
        heartT += dt;
        heartG.scale.setScalar(Math.max(0.0001, ease.outBack(Math.min(1, heartT * 1.2), 2.2)));
        heart.rotation.y = t * 0.9;
        heartG.position.y = 3.5 + Math.sin(t * 1.4) * 0.15;
      }
      if (!shown) return 0;
      spawnT += dt;
      let got = 0;
      items.forEach((it, k) => {
        if (it.got) {
          it.t += dt;
          it.g.position.y += dt * 4;
          it.g.scale.setScalar(Math.max(0.0001, 1 - it.t * 1.5));
          it.g.visible = it.t < 0.7;
          return;
        }
        if (spawnT < 2) appear(it.g, spawnT * 1.6 - k * 0.1);
        it.g.position.y = 0.95 + Math.sin(t * 2 + it.ph) * 0.15;
        it.g.children[0].rotation.y = t * 2 + it.ph;
        if (active && dist2D(playerPos, it.g.position) < 1.1) {
          it.got = true; it.t = 0;
          ctx.burst.emit(it.g.position, 18, ['#ff9fc1', '#ffd1e3', '#ffffff']);
          got++;
        }
      });
      return got;
    },
    clickables: () => [],
    hit: () => false,
    finish(instant) { shown = false; items.forEach((it) => { it.got = true; it.g.visible = false; }); heartG.visible = true; heartT = instant ? 2 : 0; },
    reset() {
      shown = false; heartG.visible = false; heartT = 0;
      items.forEach((it) => { it.got = false; it.t = 0; it.g.scale.setScalar(1); it.g.position.copy(it.g.userData.home); });
      setVisible(false);
    },
  };
}

/* ---------- Catch the fireflies (click) ---------- */
function fireflies(ctx) {
  const { group, count, path, rand } = ctx;
  const bodyGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const bodyMat = new THREE.MeshBasicMaterial({ color: '#fff5a8', toneMapped: false });
  const items = [];
  for (let k = 0; k < count; k++) {
    const g = new THREE.Group();
    const hit = hitSphere(0.75);
    g.add(new THREE.Mesh(bodyGeo, bodyMat), glowSprite('#fff0a0', 1.6, 0.9), hit);
    const anchor = path.placeAt(uAt(ctx, k, count), (rand() - 0.5) * 9, 1.8 + rand() * 1.6);
    g.position.copy(anchor);
    group.add(g);
    items.push({ g, hit, anchor, caught: false, t: 0, a: 0.6 + rand() * 0.6, b: 0.9 + rand() * 0.8, ph: rand() * 6 });
  }
  // once they're all caught, a soft glow of fireflies settles over the month
  const settled = [];
  for (let k = 0; k < count * 2; k++) {
    const s = glowSprite('#fff0a0', 0.9, 0.85);
    s.position.copy(path.placeAt(ctx.path.uOfZone(ctx.zone, 0.15 + 0.8 * rand()), (rand() - 0.5) * 12, 1 + rand() * 3));
    s.userData.base = s.position.clone(); s.userData.ph = rand() * 6;
    s.visible = false;
    group.add(s);
    settled.push(s);
  }
  let shown = false, spawnT = 0;
  const setVisible = (vis) => items.forEach((it) => { it.g.visible = vis; });
  setVisible(false);
  return {
    start() { shown = true; spawnT = 0; setVisible(true); },
    update(dt, playerPos, t) {
      settled.forEach((s) => { if (s.visible) { const b = s.userData.base, p = s.userData.ph; s.position.set(b.x + Math.sin(t * 0.6 + p) * 0.6, b.y + Math.sin(t * 0.9 + p) * 0.3, b.z + Math.cos(t * 0.5 + p) * 0.6); s.material.opacity = 0.5 + 0.4 * Math.sin(t * 2.5 + p); } });
      if (!shown) return 0;
      spawnT += dt;
      items.forEach((it, k) => {
        if (it.caught) { it.t += dt; it.g.scale.setScalar(Math.max(0.0001, 1 - it.t * 3)); it.g.visible = it.t < 0.34; return; }
        if (spawnT < 2) appear(it.g, spawnT * 1.6 - k * 0.08);
        // looping flight around its anchor
        it.g.position.set(
          it.anchor.x + Math.sin(t * it.a + it.ph) * 1.8,
          it.anchor.y + Math.sin(t * it.b * 1.3 + it.ph) * 0.6,
          it.anchor.z + Math.cos(t * it.a * 0.8 + it.ph) * 1.8,
        );
        it.g.children[1].material.opacity = 0.6 + 0.4 * Math.sin(t * 6 + it.ph);
      });
      return 0;
    },
    clickables: () => items.filter((i) => !i.caught && i.g.visible).map((i) => i.hit),
    hit(mesh) {
      const it = items.find((i) => i.hit === mesh);
      if (!it || it.caught) return false;
      it.caught = true; it.t = 0;
      ctx.burst.emit(it.g.position, 16, ['#fff5a8', '#ffffff', '#ffe3a8']);
      return true;
    },
    finish() { shown = false; items.forEach((it) => { it.caught = true; it.g.visible = false; }); settled.forEach((s) => { s.visible = true; }); },
    reset() { shown = false; items.forEach((it) => { it.caught = false; it.t = 0; it.g.scale.setScalar(1); }); settled.forEach((s) => { s.visible = false; }); setVisible(false); },
  };
}

/* ---------- Stepping stones, one at a time (walk onto the glowing one) ---------- */
function stones(ctx) {
  const { group, count, path } = ctx;
  const geo = new THREE.CylinderGeometry(0.55, 0.62, 0.12, 14).translate(0, 0.06, 0);
  const dim = new THREE.MeshLambertMaterial({ color: '#c8bcd9' });
  const COLORS = ['#ffd1e3', '#dccdf4', '#fde0cf', '#bfe9df', '#fff0a6', '#f6b8c8', '#cfe3f0', '#e7d6fb'];
  const items = [];
  for (let k = 0; k < count; k++) {
    const mesh = new THREE.Mesh(geo, dim);
    mesh.position.copy(path.placeAt(uAt(ctx, k, count, 0.2, 0.95), (k % 2 ? 1 : -1) * 1.2)).setY(0.03);
    const glow = glowSprite('#fff0a6', 2.2, 0); glow.position.y = 0.5;
    mesh.add(glow);
    group.add(mesh);
    items.push({ mesh, glow, lit: false, litMat: new THREE.MeshBasicMaterial({ color: COLORS[k % COLORS.length], toneMapped: false }) });
  }
  let next = 0, shown = false, spawnT = 0;
  const setVisible = (vis) => items.forEach((it) => { it.mesh.visible = vis; });
  setVisible(false);
  return {
    start() { shown = true; spawnT = 0; next = 0; setVisible(true); },
    update(dt, playerPos, t, active) {
      if (!shown) return 0;
      spawnT += dt;
      let got = 0;
      items.forEach((it, k) => {
        if (spawnT < 2) appear(it.mesh, spawnT * 1.6 - k * 0.08);
        if (it.lit) { it.glow.material.opacity = 0.25; return; }
        const isNext = k === next;
        it.glow.material.opacity = isNext ? 0.55 + 0.4 * Math.sin(t * 4) : 0;
        it.mesh.position.y = isNext ? 0.03 + Math.abs(Math.sin(t * 3)) * 0.06 : 0.03;
        if (active && isNext && dist2D(playerPos, it.mesh.position) < 0.95) {
          it.lit = true; it.mesh.material = it.litMat; it.mesh.position.y = 0.03;
          ctx.burst.emit(it.mesh.position.clone().setY(0.4), 16, [COLORS[k % COLORS.length], '#ffffff']);
          next++; got++;
        }
      });
      return got;
    },
    clickables: () => [],
    hit: () => false,
    finish() { shown = true; setVisible(true); items.forEach((it) => { it.lit = true; it.mesh.material = it.litMat; it.mesh.scale.setScalar(1); }); next = count; },
    reset() { shown = false; next = 0; items.forEach((it) => { it.lit = false; it.mesh.material = dim; }); setVisible(false); },
  };
}

export const GAMES = { clouds, lanterns, bugs, shards, fireflies, stones };
