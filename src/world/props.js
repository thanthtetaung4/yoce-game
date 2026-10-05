import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { ZONE_COUNT, styleOf } from './zones.js';
import { createPointsMaterial, createPoints } from './points.js';
import { rng, heartShape, isTouch } from '../utils.js';

// The enchanted maze: glowing mushrooms and crystals at the hedge roots, flowers, lanterns, floating hearts,
// trees peeking over the hedges and a forest all around.
// Each kind is one InstancedMesh, so the whole forest costs a handful of draw calls.
export function createProps(path, reserved, { noLanternZones = [] } = {}) {
  const group = new THREE.Group();
  const rand = rng(21);
  const hw = CONFIG.pathHalfWidth;
  const end = path.frameAt(1).pos;
  const density = isTouch ? 0.7 : 1;

  const maze = path.maze;
  const H = maze.hedgeHeight;
  const halfCell = maze.cell / 2;
  const zoneOf = (x, z) => path.zoneAt(maze.cellU(x, z));

  // Everything placed so far (bucketed per month) so props don't overlap
  const buckets = Array.from({ length: ZONE_COUNT }, () => []);
  const free = (p, r, zone) => {
    if (!reserved.every((q) => q.distanceTo(p) > r + 2.2)) return false;
    for (let z = Math.max(0, zone - 1); z <= Math.min(ZONE_COUNT - 1, zone + 1); z++) {
      for (const s of buckets[z]) if (s.p.distanceTo(p) < r + s.r) return false;
    }
    return true;
  };
  const claim = (p, r, zone) => buckets[zone].push({ p, r });
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  // corridor cells (main route + dead ends) and every maze cell, per month
  const floorCells = Array.from({ length: ZONE_COUNT }, () => []);
  const allCells = Array.from({ length: ZONE_COUNT }, () => []);
  maze.cells.forEach((c) => {
    if (c.type === 'plaza') return;
    const z = path.zoneAt(c.u);
    allCells[z].push(c);
    if (c.type) floorCells[z].push(c);
  });
  const _c = new THREE.Vector3();
  // on the floor, tucked against a hedge (`inset` metres in from the floor's edge)
  function edgeSpot(zone, inset0, inset1, r, tries = 8) {
    if (!floorCells[zone].length) return null;
    for (let t = 0; t < tries; t++) {
      maze.cellCentre(pick(floorCells[zone]), _c);
      const inset = inset0 + rand() * (inset1 - inset0), sgn = rand() < 0.5 ? -1 : 1, along = (rand() - 0.5) * 2 * halfCell;
      const alongX = rand() < 0.5;
      const p = alongX ? new THREE.Vector3(_c.x + along, 0, _c.z + sgn * (hw - inset)) : new THREE.Vector3(_c.x + sgn * (hw - inset), 0, _c.z + along);
      const bx = alongX ? p.x : p.x + sgn * (inset + 0.7), bz = alongX ? p.z + sgn * (inset + 0.7) : p.z;
      if (!maze.walkable(p.x, p.z, -0.1) || maze.walkable(bx, bz)) continue; // needs a hedge right behind it
      if (zone === ZONE_COUNT - 1 && p.distanceTo(end) < 11.5) continue;
      if (free(p, r, zone)) { claim(p, r, zone); return p; }
    }
    return null;
  }
  // inside a hedge block, at least `margin` metres back from the floor
  function hedgeSpot(zone, r, margin, tries = 8) {
    if (!allCells[zone].length) return null;
    for (let t = 0; t < tries; t++) {
      maze.cellCentre(pick(allCells[zone]), _c);
      const p = new THREE.Vector3(_c.x + (rand() - 0.5) * 2 * halfCell, 0, _c.z + (rand() - 0.5) * 2 * halfCell);
      if (maze.walkable(p.x, p.z, 0.2 + margin)) continue;
      if (free(p, r, zone)) { claim(p, r, zone); return p; }
    }
    return null;
  }
  const PETALS = ['#f6b8c8', '#dccdf4', '#fde0cf', '#ffffff', '#f2a7bb', '#fff3b0', '#bfe9df'];

  const lists = { trees: [], pines: [], flowers: [], hearts: [], balloons: [], lanterns: [], mounds: [], clouds: [], mushrooms: [], crystals: [] };
  const addMushroom = (p, s, c, cluster) => {
    lists.mushrooms.push({ p, s, c, tilt: (rand() - 0.5) * 0.25 });
    if (cluster) for (let k = 0; k < 2; k++) {
      const q = p.clone().add(new THREE.Vector3((rand() - 0.5) * 0.8, 0, (rand() - 0.5) * 0.8));
      lists.mushrooms.push({ p: q, s: s * (0.4 + rand() * 0.25), c, tilt: (rand() - 0.5) * 0.5 });
    }
  };
  for (let z = 0; z < ZONE_COUNT; z++) {
    const st = styleOf(z);
    const count = (n) => Math.round(n * density);
    // a few trees grow up out of the thicker hedge blocks
    for (let i = 0; i < count((st.trees + st.pines) * 0.2); i++) {
      const p = hedgeSpot(z, 1.4, 1.2);
      if (!p) continue;
      if (rand() < st.trees / (st.trees + st.pines)) lists.trees.push({ p, c: pick(st.foliage), s: 1 + rand() * 0.7, r: rand() * 6 });
      else lists.pines.push({ p, c: pick(st.foliage), s: 1 + rand() * 0.6 });
    }
    for (let i = 0; i < count(st.flowers); i++) { const p = edgeSpot(z, 0.1, 0.45, 0.25, 4); p && lists.flowers.push({ p, c: pick(PETALS), s: 0.7 + rand() * 0.6 }); }
    for (let i = 0; i < count(st.mushrooms); i++) {
      // giant ones peek up out of the hedges, little clusters sit at their roots
      if (rand() < 0.25) {
        const p = hedgeSpot(z, 1.2, 0.4, 6);
        p && addMushroom(p.setY(H - 0.4), 1.9 + rand() * 1.1, pick(st.glow), false);
      } else {
        const p = edgeSpot(z, 0.2, 0.55, 0.35, 6);
        p && addMushroom(p, 0.55 + rand() * 0.5, pick(st.glow), true);
      }
    }
    for (let i = 0; i < count(st.crystals); i++) {
      const p = edgeSpot(z, 0.3, 0.6, 0.8, 6);
      if (!p) continue;
      const c = pick(['#d9c8ff', '#c8ecff', '#ffc8e4', '#c9f5e9']);
      const s = 0.6 + rand() * 0.7;
      for (let k = 0; k < 3; k++) {
        lists.crystals.push({ p: p.clone().add(new THREE.Vector3((rand() - 0.5) * 0.7, 0, (rand() - 0.5) * 0.7)), s: s * (k ? 0.55 + rand() * 0.3 : 1), c, rx: (rand() - 0.5) * 0.6, rz: (rand() - 0.5) * 0.6, ry: rand() * 6 });
      }
    }
    for (let i = 0; i < st.hearts; i++) { const p = hedgeSpot(z, 0.6, 0, 4); p && lists.hearts.push({ p, y: H + 1.2 + rand() * 2.4, ph: rand() * 6.28, s: 0.35 + rand() * 0.3 }); }
    for (let i = 0; i < st.balloons; i++) { const p = edgeSpot(z, 0.3, 0.6, 0.6, 4); p && lists.balloons.push({ p, c: pick(['#f6b8c8', '#dccdf4', '#fde0cf', '#cfe3f0', '#f2a7bb']), h: 2.6 + rand() * 1.4, ph: rand() * 6.28 }); }
    // snow piled on top of the winter hedges
    for (let i = 0; i < count(st.mounds); i++) { const p = hedgeSpot(z, 1, 0.3, 4); p && lists.mounds.push({ p: p.setY(H + 0.15), s: 0.6 + rand() * 0.6 }); }
    // lanterns line the main route at a steady rhythm, against the hedges
    for (let i = 0; i < (noLanternZones.includes(z) ? 0 : st.lanterns); i++) {
      const u = path.uOfZone(z, (i + 0.5) / st.lanterns);
      for (const side of i % 2 ? [1, -1] : [-1, 1]) {
        const p = path.placeAt(u, side * (hw - 0.2)), behind = path.placeAt(u, side * (hw + 0.9));
        if (maze.walkable(behind.x, behind.z) || (z === ZONE_COUNT - 1 && p.distanceTo(end) < 9.5)) continue;
        if (free(p, 0.3, z)) { claim(p, 0.3, z); lists.lanterns.push({ p }); }
        break;
      }
    }
  }
  // the forest all around the outside of the maze
  for (let i = 0; i < Math.round(240 * density); i++) {
    const R = maze.half + 40;
    const p = new THREE.Vector3((rand() - 0.5) * 2 * R, 0, (rand() - 0.5) * 2 * R);
    const out = Math.max(Math.abs(p.x), Math.abs(p.z)) - maze.half;
    if (out < 2.5) continue;
    const z = zoneOf(p.x, p.z), st = styleOf(z);
    if (!free(p, 1.5, z)) continue;
    claim(p, 1.5, z);
    const s = 1 + rand() * 0.9 + out * 0.015;
    if (rand() < st.trees / (st.trees + st.pines)) lists.trees.push({ p, c: pick(st.foliage), s, r: rand() * 6 });
    else lists.pines.push({ p, c: pick(st.foliage), s });
  }
  for (let i = 0; i < 2 * ZONE_COUNT; i++) {
    lists.clouds.push({ p: new THREE.Vector3((rand() - 0.5) * 2 * (maze.half + 30), 20 + rand() * 10, (rand() - 0.5) * 2 * (maze.half + 30)), s: 1.6 + rand() * 1.6 });
  }
  // little treats at the end of the dead ends, so a wrong turn is never a waste
  maze.deadEnds.forEach((d) => {
    const st = styleOf(path.zoneAt(d.u));
    addMushroom(d.pos.clone().add(new THREE.Vector3(1.4, 0, 0.6)), 1.1, pick(st.glow), true);
    addMushroom(d.pos.clone().add(new THREE.Vector3(-1.3, 0, -0.7)), 0.9, pick(st.glow), true);
    lists.hearts.push({ p: d.pos.clone(), y: 1.9, ph: rand() * 6.28, s: 0.5 });
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rand();
      lists.flowers.push({ p: d.pos.clone().add(new THREE.Vector3(Math.cos(a) * 2.2, 0, Math.sin(a) * 2.2)), c: pick(PETALS), s: 0.8 + rand() * 0.5 });
    }
  });
  // a fairy ring of glowing mushrooms around the birthday clearing
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    const p = end.clone().add(new THREE.Vector3(Math.cos(a) * 9.6, 0, Math.sin(a) * 9.6));
    if (path.nearest(p).u < 0.985 && Math.abs(path.nearest(p).lateral) < hw + 0.8) continue; // keep the way in clear
    lists.mushrooms.push({ p, s: 0.7 + (i % 3) * 0.2, c: ['#f6a3c0', '#c9a8f5', '#9fe3d6', '#ffd8a8'][i % 4], tilt: 0 });
  }

  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), col = new THREE.Color(), e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const lambert = (opts) => new THREE.MeshLambertMaterial({ flatShading: true, ...opts });
  const glowing = () => new THREE.MeshBasicMaterial({ color: '#fff', toneMapped: false });
  function instanced(geo, mat, items, place) {
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, items.length));
    mesh.count = items.length;
    items.forEach((it, i) => place(it, i, mesh));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
    return mesh;
  }
  const put = (mesh, i, pos, scale, rotY = 0) => {
    q.setFromAxisAngle(up, rotY);
    mesh.setMatrixAt(i, m.compose(pos, q, s.setScalar(scale)));
  };

  /* Trees: tall trunk + three foliage puffs */
  instanced(new THREE.CylinderGeometry(0.13, 0.24, 2.4, 6).translate(0, 1.2, 0), lambert({ color: '#b892a8' }), [...lists.trees, ...lists.pines],
    (t, i, mesh) => put(mesh, i, t.p, t.s));
  const puffs = lists.trees.flatMap((t) => [
    { p: t.p.clone().setY(2.9 * t.s), s: 1.35 * t.s, c: t.c, r: t.r },
    { p: t.p.clone().add(new THREE.Vector3(0.5 * t.s, 3.7 * t.s, 0.2 * t.s)), s: 0.95 * t.s, c: t.c, r: t.r + 1 },
    { p: t.p.clone().add(new THREE.Vector3(-0.45 * t.s, 4.2 * t.s, -0.3 * t.s)), s: 0.8 * t.s, c: t.c, r: t.r + 2 },
  ]);
  instanced(new THREE.IcosahedronGeometry(1, 0), lambert({ color: '#fff' }), puffs, (t, i, mesh) => { put(mesh, i, t.p, t.s, t.r); mesh.setColorAt(i, col.set(t.c)); });
  const cones = lists.pines.flatMap((t) => [
    { p: t.p.clone().setY(2.2 * t.s), s: 1.15 * t.s, c: t.c },
    { p: t.p.clone().setY(3.3 * t.s), s: 0.85 * t.s, c: t.c },
    { p: t.p.clone().setY(4.2 * t.s), s: 0.55 * t.s, c: t.c },
  ]);
  instanced(new THREE.ConeGeometry(1, 1.8, 7), lambert({ color: '#fff' }), cones, (t, i, mesh) => { put(mesh, i, t.p, t.s); mesh.setColorAt(i, col.set(t.c)); });

  /* Glowing mushrooms: cream stem + softly lit cap */
  instanced(new THREE.CylinderGeometry(0.09, 0.13, 0.5, 7).translate(0, 0.25, 0), lambert({ color: '#fff3ea' }), lists.mushrooms,
    (t, i, mesh) => { e.set(t.tilt, 0, t.tilt * 0.5); q.setFromEuler(e); mesh.setMatrixAt(i, m.compose(t.p, q, s.setScalar(t.s))); });
  instanced(new THREE.SphereGeometry(0.32, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.7, 1), glowing(), lists.mushrooms,
    (t, i, mesh) => {
      e.set(t.tilt, 0, t.tilt * 0.5); q.setFromEuler(e);
      v.set(0, 0.48 * t.s, 0).applyQuaternion(q).add(t.p);
      mesh.setMatrixAt(i, m.compose(v, q, s.setScalar(t.s)));
      mesh.setColorAt(i, col.set(t.c));
    });

  /* Crystals */
  instanced(new THREE.OctahedronGeometry(0.3, 0).scale(1, 2.6, 1).translate(0, 0.6, 0), glowing(), lists.crystals,
    (t, i, mesh) => { e.set(t.rx, t.ry, t.rz); q.setFromEuler(e); mesh.setMatrixAt(i, m.compose(t.p, q, s.setScalar(t.s))); mesh.setColorAt(i, col.set(t.c)); });

  /* Flowers: stem + glowing blossom */
  instanced(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 4).translate(0, 0.25, 0), lambert({ color: '#9fcfb0' }), lists.flowers,
    (t, i, mesh) => put(mesh, i, t.p, t.s));
  instanced(new THREE.IcosahedronGeometry(0.15, 0), new THREE.MeshLambertMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 0.25, flatShading: true }), lists.flowers,
    (t, i, mesh) => { put(mesh, i, v.copy(t.p).setY(0.52 * t.s), t.s, rand() * 6); mesh.setColorAt(i, col.set(t.c)); });

  /* Frosty mounds */
  instanced(new THREE.SphereGeometry(1, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), lambert({ color: '#f6f3fd' }), lists.mounds,
    (t, i, mesh) => { q.identity(); mesh.setMatrixAt(i, m.compose(t.p, q, s.set(t.s * 1.4, t.s * 0.45, t.s))); });

  /* Lanterns on little posts */
  instanced(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 5).translate(0, 0.75, 0), lambert({ color: '#b892a8' }), lists.lanterns,
    (t, i, mesh) => put(mesh, i, t.p, 1));
  instanced(new THREE.BoxGeometry(0.3, 0.38, 0.3).translate(0, 1.7, 0), new THREE.MeshBasicMaterial({ color: '#ffe3bf', toneMapped: false }), lists.lanterns,
    (t, i, mesh) => put(mesh, i, t.p, 1, 0.4));

  /* A few high clouds peeking over the canopy */
  const cloudPuffs = lists.clouds.flatMap((c) => Array.from({ length: 4 }, (_, k) => ({
    p: c.p.clone().add(new THREE.Vector3((k - 1.5) * 1.3 * c.s, (k % 2) * 0.4 * c.s, (rand() - 0.5) * c.s)),
    s: c.s * (k === 1 || k === 2 ? 1.25 : 0.85),
  })));
  const clouds = instanced(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#f3e6ff', emissiveIntensity: 0.6, flatShading: true, fog: false }), cloudPuffs,
    (t, i, mesh) => put(mesh, i, t.p, t.s));

  /* Floating hearts (animated) */
  const hearts = instanced(
    new THREE.ExtrudeGeometry(heartShape(), { depth: 0.18, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 8 }).center(),
    new THREE.MeshLambertMaterial({ color: '#f59ab3', emissive: '#f7b3c6', emissiveIntensity: 0.45 }), lists.hearts, () => {});
  hearts.frustumCulled = false;

  /* Balloons (only if a season asks for them) */
  const balloons = instanced(new THREE.SphereGeometry(0.42, 12, 10).scale(1, 1.18, 1), new THREE.MeshLambertMaterial({ color: '#fff', emissive: '#ffffff', emissiveIntensity: 0.12 }), lists.balloons,
    (t, i, mesh) => mesh.setColorAt(i, col.set(t.c)));
  balloons.frustumCulled = false;
  if (lists.balloons.length) {
    const pts = [];
    lists.balloons.forEach((b) => pts.push(b.p.x, 0, b.p.z, b.p.x, b.h - 0.5, b.p.z));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#c9a3b4' })));
  }

  /* Wisps + fireflies drifting through the whole forest (one draw call) */
  const sparkPos = [], sparkCol = [];
  const sparkColors = ['#ffffff', '#fff3b0', '#f6b8c8', '#dccdf4', '#bff3e6'].map((c) => new THREE.Color(c));
  const sparkCount = Math.round(path.total * 1.6 * density);
  for (let i = 0; i < sparkCount; i++) {
    const p = new THREE.Vector3((rand() - 0.5) * 2 * (maze.half + 6), 0, (rand() - 0.5) * 2 * (maze.half + 6));
    p.y = maze.walkable(p.x, p.z) ? 0.4 + rand() * 5.5 : H + 0.6 + rand() * 3.5; // over the hedges, not inside them
    sparkPos.push(p.x, p.y, p.z);
    const c = sparkColors[i % sparkColors.length]; sparkCol.push(c.r, c.g, c.b);
  }
  const sparkMat = createPointsMaterial({ size: 0.2, twinkle: 1, float: 0.45, fadeNear: 28, fadeFar: 70 });
  group.add(createPoints(sparkPos, sparkCol, sparkMat));

  /* Soft glow halos over lanterns, mushroom caps and crystals */
  const glowPos = [], glowCol = [];
  const addGlow = (x, y, z, c) => { glowPos.push(x, y, z); col.set(c); glowCol.push(col.r, col.g, col.b); };
  lists.lanterns.forEach((l) => addGlow(l.p.x, 1.7, l.p.z, '#ffd9a8'));
  lists.mushrooms.forEach((t) => { if (t.s > 0.45) addGlow(t.p.x, t.p.y + 0.55 * t.s, t.p.z, t.c); });
  lists.crystals.forEach((t, i) => { if (i % 3 === 0) addGlow(t.p.x, 0.7 * t.s, t.p.z, t.c); });
  const glowMat = createPointsMaterial({ size: 1.1, opacity: 0.7, twinkle: 0.25, fadeNear: 35, fadeFar: 80 });
  if (glowPos.length) group.add(createPoints(glowPos, glowCol, glowMat));

  let time = 0;
  return {
    group,
    update(dt, renderer) {
      time += dt;
      const pr = renderer.getPixelRatio();
      sparkMat.uniforms.uTime.value = glowMat.uniforms.uTime.value = time;
      sparkMat.uniforms.uPixelRatio.value = glowMat.uniforms.uPixelRatio.value = pr;
      lists.hearts.forEach((h, i) => {
        v.copy(h.p).setY(h.y + Math.sin(time * 1.3 + h.ph) * 0.35);
        put(hearts, i, v, h.s, time * 0.8 + h.ph);
      });
      hearts.instanceMatrix.needsUpdate = true;
      if (lists.balloons.length) {
        lists.balloons.forEach((b, i) => {
          v.copy(b.p).setY(b.h + Math.sin(time * 1.1 + b.ph) * 0.08);
          put(balloons, i, v, 1);
        });
        balloons.instanceMatrix.needsUpdate = true;
      }
      clouds.position.x = Math.sin(time * 0.03) * 4;
    },
  };
}
