import * as THREE from 'three';
import { CONFIG, PALETTE } from '../config.js';
import { photoInfo, photoSrc, canvasTexture, glowTexture, placeholderTexture, heartShape, damp, dampAngle, pickOnScreen } from '../utils.js';

// Floating polaroids, tucked into dead-end nooks of the maze. They glow when you get close and get a heart once visited.
export function createMemoryMarkers(path, memories, manager) {
  const group = new THREE.Group();
  const loader = new THREE.TextureLoader(manager);
  const hw = CONFIG.pathHalfWidth;
  const hitMeshes = [];
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const frameMat = new THREE.MeshLambertMaterial({ color: PALETTE.paper });
  const visitedFrameMat = new THREE.MeshLambertMaterial({ color: '#fde3ea' });
  const heartGeo = new THREE.ExtrudeGeometry(heartShape(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 8 }).center();
  const heartMat = new THREE.MeshLambertMaterial({ color: '#f27c9e', emissive: '#f7a6bd', emissiveIntensity: 0.4 });
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const beamTex = canvasTexture(4, 128, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.6, 'rgba(255,255,255,.35)');
    lg.addColorStop(1, 'rgba(255,255,255,.7)');
    g.fillStyle = lg; g.fillRect(0, 0, w, h);
  });

  const items = memories.map((mem, i) => {
    const u = path.uOfZone(mem.zone, mem.at);
    const sideSign = mem.side === 'left' ? -1 : mem.side === 'right' ? 1 : i % 2 ? 1 : -1;
    // in its own nook off the main route, or (if the maze had no room) against the hedge beside it
    const anchor = path.nooks?.[i]?.pos.clone() || path.placeAt(u, sideSign * (hw - 0.5));

    const root = new THREE.Group();
    root.position.copy(anchor);
    const float = new THREE.Group();
    float.position.y = 1.75;
    root.add(float);

    // photo size from the original aspect ratio
    const file = mem.photos?.[0];
    const info = photoInfo(file);
    const aspect = info ? info.w / info.h : 0.75;
    let ph = 1.3, pw = ph * aspect;
    if (pw > 1.6) { pw = 1.6; ph = pw / aspect; }

    const frame = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.18, ph + 0.48, 0.05), frameMat);
    const photoMat = new THREE.MeshBasicMaterial({ color: '#fadbe2', toneMapped: false });
    if (info) {
      loader.load(photoSrc(file, 480), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        photoMat.map = tex; photoMat.color.set('#ffffff'); photoMat.needsUpdate = true;
      });
    } else {
      if (file) console.warn(`[memories] Photo not found: "${file}". Did you run \`npm run photos\`?`);
      photoMat.map = placeholderTexture(); photoMat.color.set('#ffffff');
    }
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), photoMat);
    photo.position.set(0, 0.12, 0.03);

    const caption = mem.captions?.[0] || mem.title;
    const capTex = canvasTexture(512, 80, (g, w, h) => {
      g.fillStyle = PALETTE.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = 54;
      g.font = `700 ${size}px Caveat, cursive`;
      while (g.measureText(caption).width > w - 20 && size > 26) { size -= 2; g.font = `700 ${size}px Caveat, cursive`; }
      g.fillText(caption, w / 2, h / 2);
    });
    const capH = 0.26, capW = capH * (512 / 80);
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(capW, pw + 0.1), capH * Math.min(1, (pw + 0.1) / capW)),
      new THREE.MeshBasicMaterial({ map: capTex, transparent: true, toneMapped: false }));
    cap.position.set(0, -ph / 2 - 0.08, 0.03);

    const heart = new THREE.Mesh(heartGeo, heartMat);
    heart.position.set(pw / 2 + 0.02, ph / 2 + 0.3, 0.06);
    heart.rotation.z = -0.25;
    heart.scale.setScalar(0.0001);

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffc4d6', transparent: true, opacity: 0.5, depthWrite: false }));
    glow.position.z = -0.15;
    glow.scale.setScalar(3.2);

    const hit = new THREE.Mesh(new THREE.BoxGeometry(pw + 1, ph + 1.4, 1), hitMat);
    hit.userData.index = i;
    hitMeshes.push(hit);

    float.add(glow, frame, photo, cap, heart, hit);

    // a soft pillar of light so unvisited memories are easy to spot from afar
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.5, 10, 16, 1, true).translate(0, 5, 0),
      new THREE.MeshBasicMaterial({ map: beamTex, color: '#ffd1df', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide, fog: false }),
    );
    beam.material.map.wrapS = THREE.RepeatWrapping;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.75, 0.95, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#f59ab3', transparent: true, opacity: 0, depthWrite: false }),
    );
    ring.position.y = 0.07;
    root.add(beam, ring);
    group.add(root);

    return { mem, i, u, root, float, frame, glow, heart, beam, ring, visited: false, near: 0, pop: 0, phase: i * 1.7 };
  });

  let time = 0;
  const _cam = new THREE.Vector3();
  return {
    group, items,
    // returns the closest memory within reach (or null)
    update(dt, playerPos, camera) {
      time += dt;
      camera.getWorldPosition(_cam);
      let nearest = null, nd = Infinity;
      for (const it of items) {
        const d = Math.hypot(playerPos.x - it.root.position.x, playerPos.z - it.root.position.z);
        const inReach = d < CONFIG.interactDistance;
        if (inReach && d < nd) { nd = d; nearest = it; }
        it.near = damp(it.near, inReach ? 1 : 0, 6, dt);
        if (d > 70) { it.root.visible = false; continue; }
        it.root.visible = true;

        it.float.position.y = 1.75 + Math.sin(time * 1.2 + it.phase) * 0.12 + it.near * 0.15;
        const yaw = Math.atan2(_cam.x - it.root.position.x, _cam.z - it.root.position.z);
        it.float.rotation.y = dampAngle(it.float.rotation.y, yaw, 4, dt);
        it.float.rotation.z = Math.sin(time * 0.8 + it.phase) * 0.05;
        const s = 1 + it.near * 0.08 + (it.visited ? 0 : Math.sin(time * 3 + it.phase) * 0.015);
        it.frame.parent.scale.setScalar(s);

        const pulse = 0.5 + 0.5 * Math.sin(time * 3.2 + it.phase);
        it.glow.material.opacity = (it.visited ? 0.25 : 0.45) + it.near * (0.25 + pulse * 0.25);
        it.glow.scale.setScalar(3 + it.near * (0.6 + pulse * 0.5));
        it.ring.material.opacity = it.near * (0.4 + pulse * 0.4);
        it.ring.scale.setScalar(1 + pulse * 0.15 * it.near);
        it.beam.material.opacity = damp(it.beam.material.opacity, it.visited ? 0 : 0.35 * (1 - it.near * 0.8), 3, dt);
        it.beam.visible = it.beam.material.opacity > 0.01;
        if (it.visited && it.pop < 1) it.pop = Math.min(1, it.pop + dt * 2.2);
        const k = it.pop;
        it.heart.scale.setScalar(Math.max(0.0001, 0.32 * (k < 1 ? 1 + Math.sin(k * Math.PI) * 0.5 : 1) * k));
      }
      return nearest;
    },
    // tolerancePx > 0 also accepts taps that land just outside a photo (for fingers)
    pick(clientX, clientY, camera, tolerancePx = 0) {
      ndc.set((clientX / window.innerWidth) * 2 - 1, -(clientY / window.innerHeight) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const visible = hitMeshes.filter((m) => m.parent.parent.visible);
      const hit = raycaster.intersectObjects(visible, false)[0];
      if (hit) return items[hit.object.userData.index];
      const near = tolerancePx > 0 ? pickOnScreen(visible, clientX, clientY, camera, tolerancePx, 45) : null;
      return near ? items[near.userData.index] : null;
    },
    setVisited(it, v) {
      it.visited = v;
      it.frame.material = v ? visitedFrameMat : frameMat;
      it.glow.material.color.set(v ? PALETTE.lavender : '#ffc4d6');
      if (!v) { it.pop = 0; it.heart.scale.setScalar(0.0001); it.beam.material.opacity = 0.35; }
    },
  };
}
