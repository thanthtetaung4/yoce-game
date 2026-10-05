import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { TRIALS } from '../data/trials.js';
import { GAMES } from './games.js';
import { createBurst } from './burst.js';
import { glowTexture, rng, pickOnScreen } from '../utils.js';

// Rune stones that start the trials, plus the trials themselves.
// Each trial's targets live in its own month of the path.
export function createTrials(path, { onProgress, onComplete }) {
  const group = new THREE.Group();
  const hw = CONFIG.pathHalfWidth;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const burst = createBurst();
  group.add(burst.points);

  // shared stone look
  const stoneGeo = new THREE.DodecahedronGeometry(0.55, 0).scale(0.8, 1.5, 0.6).translate(0, 0.75, 0);
  const stoneMat = new THREE.MeshLambertMaterial({ color: '#b9a8d6', flatShading: true });
  const runeGeo = new THREE.PlaneGeometry(0.42, 0.42);
  const runeTex = glowRune();
  const starShape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5, r = i % 2 ? 0.16 : 0.38;
    i ? starShape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : starShape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 }).center();
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  const items = TRIALS.map((def, i) => {
    const stoneU = path.uOfZone(def.zone, 0.12);
    const root = new THREE.Group();
    root.position.copy(path.placeAt(stoneU, hw + 1.1)); // right side, across from the month signpost
    const f = path.frameAt(stoneU);
    const d = f.tan.clone().negate().addScaledVector(f.right, -0.6);
    root.rotation.y = Math.atan2(d.x, d.z);

    const stone = new THREE.Mesh(stoneGeo, stoneMat.clone());
    const rune = new THREE.Mesh(runeGeo, new THREE.MeshBasicMaterial({ map: runeTex, transparent: true, color: '#fff0a6', toneMapped: false, depthWrite: false }));
    rune.position.set(0, 0.85, 0.33);
    const star = new THREE.Mesh(starGeo, new THREE.MeshLambertMaterial({ color: '#ffe08a', emissive: '#ffcf6a', emissiveIntensity: 0.6 }));
    star.position.y = 2.25;
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2b0', transparent: true, opacity: 0.6, depthWrite: false }));
    glow.position.y = 2.25; glow.scale.setScalar(2);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.1, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#ffe08a', transparent: true, opacity: 0, depthWrite: false }));
    ring.position.y = 0.06;
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3, 1.6).translate(0, 1.4, 0), hitMat);
    root.add(stone, rune, star, glow, ring, hit);
    group.add(root);

    const gameGroup = new THREE.Group();
    group.add(gameGroup);
    const game = GAMES[def.type]({ path, zone: def.zone, group: gameGroup, rand: rng(100 + i * 17), hw, count: def.count, burst, stonePos: root.position });
    const item = { def, root, stone, rune, star, glow, ring, hit, game, gameGroup, state: 'idle', found: 0, near: 0, phase: i * 1.3 };
    hit.userData.item = item;
    return item;
  });

  function complete(item, instant = false) {
    item.state = 'done';
    item.found = item.def.count;
    item.game.finish(instant);
    item.stone.material.color.set('#bfe9df');
    item.rune.material.color.set('#ffffff');
    if (!instant) {
      burst.emit(item.root.position.clone().setY(2.3), 40, ['#fff0a6', '#ffd1e3', '#dccdf4']);
      onComplete(item);
    }
  }

  let time = 0;
  const _cam = new THREE.Vector3();
  return {
    group, items,
    get total() { return items.length; },
    get doneCount() { return items.filter((it) => it.state === 'done').length; },
    byZone: (z) => items.find((it) => it.def.zone === z),
    // Returns the nearest rune stone in reach (for the prompt + E key)
    update(dt, playerPos, playerU, camera, renderer) {
      time += dt;
      camera.getWorldPosition(_cam);
      burst.update(dt, renderer);
      let nearest = null, nd = Infinity;
      for (const it of items) {
        const d = Math.hypot(playerPos.x - it.root.position.x, playerPos.z - it.root.position.z);
        const inReach = d < CONFIG.interactDistance && it.state !== 'active';
        if (inReach && d < nd) { nd = d; nearest = it; }
        it.near += ((inReach ? 1 : 0) - it.near) * Math.min(1, dt * 6);
        const close = Math.abs(playerU - path.uOfZone(it.def.zone, 0.5)) < 1.2 / 13;
        it.root.visible = close || d < 70;
        if (!it.root.visible && !close) continue;
        // the star spins and bobs; it pulses while the trial is waiting for her
        it.star.rotation.y = time * (it.state === 'done' ? 0.6 : 1.4);
        it.star.position.y = 2.25 + Math.sin(time * 1.6 + it.phase) * 0.12;
        it.glow.position.y = it.star.position.y;
        const pulse = 0.5 + 0.5 * Math.sin(time * 3 + it.phase);
        it.glow.material.opacity = it.state === 'done' ? 0.35 : 0.45 + pulse * 0.3 + it.near * 0.2;
        it.glow.scale.setScalar(it.state === 'done' ? 1.6 : 1.8 + pulse * 0.5);
        it.ring.material.opacity = it.near * (0.4 + pulse * 0.4);
        it.rune.material.opacity = it.state === 'idle' ? 0.6 + pulse * 0.4 : 1;
        if (close) {
          const got = it.game.update(dt, playerPos, time, it.state === 'active');
          if (it.state === 'active' && got) {
            it.found = Math.min(it.def.count, it.found + got);
            onProgress(it);
            if (it.found >= it.def.count) complete(it);
          }
        }
      }
      return nearest ? { item: nearest, dist: nd } : null;
    },
    // Click/tap: a rune stone, or a target in an active trial
    pick(clientX, clientY, camera, tolerancePx = 0) {
      ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const targets = [];
      items.forEach((it) => {
        if (!it.root.visible) return;
        targets.push(it.hit);
        if (it.state === 'active') targets.push(...it.game.clickables());
      });
      let hit = raycaster.intersectObjects(targets, false).find((h) => h.distance < 40);
      if (!hit && tolerancePx > 0) {
        // forgiving finger taps: clouds/fireflies first, then the stones
        const near = pickOnScreen(targets.filter((t) => !t.userData.item), clientX, clientY, camera, tolerancePx, 40)
          || pickOnScreen(targets.filter((t) => t.userData.item), clientX, clientY, camera, tolerancePx, 40);
        if (near) hit = { object: near };
      }
      if (!hit) return null;
      if (hit.object.userData.item) return { kind: 'stone', item: hit.object.userData.item };
      const it = items.find((x) => x.state === 'active' && x.game.clickables().includes(hit.object));
      if (it && it.game.hit(hit.object)) {
        it.found = Math.min(it.def.count, it.found + 1);
        onProgress(it);
        if (it.found >= it.def.count) complete(it);
      }
      return { kind: 'target' };
    },
    // Hover check without side effects
    hovering(clientX, clientY, camera) {
      ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const targets = [];
      items.forEach((it) => { if (it.root.visible) { targets.push(it.hit); if (it.state === 'active') targets.push(...it.game.clickables()); } });
      return raycaster.intersectObjects(targets, false).some((h) => h.distance < 40);
    },
    start(item) {
      if (item.state !== 'idle') return;
      item.state = 'active';
      item.found = 0;
      item.game.start();
      burst.emit(item.root.position.clone().setY(2.3), 24, ['#fff0a6', '#ffffff']);
      onProgress(item);
    },
    markDone(item) { complete(item, true); },
    reset() {
      items.forEach((it) => {
        it.state = 'idle'; it.found = 0;
        it.game.reset();
        it.stone.material.color.set('#b9a8d6');
        it.rune.material.color.set('#fff0a6');
      });
    },
  };
}

// A softly glowing rune drawn on a canvas
function glowRune() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
  g.shadowColor = '#fff'; g.shadowBlur = 14;
  g.beginPath();
  g.moveTo(64, 14); g.lineTo(64, 114);
  g.moveTo(64, 40); g.lineTo(34, 64); g.lineTo(64, 88); g.lineTo(94, 64); g.lineTo(64, 40);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
