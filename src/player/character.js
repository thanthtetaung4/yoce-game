import * as THREE from 'three';
import { damp, glowTexture } from '../utils.js';

// Princess Yoce, built from primitives: long blonde hair, a golden tiara, puff sleeves,
// a layered pastel ball gown, and a trail of sparkles when she walks.
export function createCharacter() {
  const root = new THREE.Group();   // position + facing
  const body = new THREE.Group();   // bobbing
  root.add(body);

  const mat = (color, extra) => new THREE.MeshLambertMaterial({ color, ...extra });
  const skin = mat('#f8d9c8', { emissive: '#f6cdb8', emissiveIntensity: 0.22 });
  const hairM = mat('#ffe08f', { side: THREE.DoubleSide, emissive: '#f7cf7a', emissiveIntensity: 0.25 });
  const bodiceM = mat('#f49bb7');
  const gownM = mat('#f9c3d5');
  const overM = mat('#e7d6fb');
  const trimM = mat('#fff6f1');
  const shoeM = mat('#e9c4ff', { emissive: '#d9b8ff', emissiveIntensity: 0.3 });
  const goldM = mat('#ffd36e', { emissive: '#ffbf4d', emissiveIntensity: 0.45 });
  const gemM = new THREE.MeshBasicMaterial({ color: '#ff8fb8', toneMapped: false });
  const dark = new THREE.MeshBasicMaterial({ color: '#2a1d25' });
  const cheekM = new THREE.MeshBasicMaterial({ color: '#f5a3b5', transparent: true, opacity: 0.8 });

  // Legs swing under the gown
  const legGeo = new THREE.CapsuleGeometry(0.07, 0.26, 4, 8).translate(0, -0.2, 0);
  const shoeGeo = new THREE.SphereGeometry(0.095, 10, 8).scale(1, 0.65, 1.4).translate(0, -0.41, 0.04);
  const legs = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.1, 0.49, 0);
    pivot.add(new THREE.Mesh(legGeo, skin), new THREE.Mesh(shoeGeo, shoeM));
    body.add(pivot);
    return pivot;
  });

  // Ball gown: full skirt, a lavender over-layer, a frilled hem and waist ribbon
  const gown = new THREE.Group();
  body.add(gown);
  const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.52, 0.6, 18, 1, true), gownM);
  skirt.position.y = 0.38;
  const skirtBottom = new THREE.Mesh(new THREE.CircleGeometry(0.52, 18).rotateX(Math.PI / 2), gownM);
  skirtBottom.position.y = 0.08;
  const over = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.44, 0.42, 18, 1, true), overM);
  over.position.y = 0.48;
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.04, 6, 24), trimM);
  hem.rotation.x = Math.PI / 2; hem.position.y = 0.09;
  const overHem = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.03, 6, 24), trimM);
  overHem.rotation.x = Math.PI / 2; overHem.position.y = 0.28;
  const sash = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.035, 6, 20), goldM);
  sash.rotation.x = Math.PI / 2; sash.position.y = 0.69;
  gown.add(skirt, skirtBottom, over, hem, overHem, sash);
  skirt.material.side = THREE.DoubleSide;
  over.material.side = THREE.DoubleSide;

  // Bodice + puff sleeves
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.16, 4, 12), bodiceM);
  torso.position.y = 0.84;
  const neckline = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.025, 6, 18), trimM);
  neckline.rotation.x = Math.PI / 2; neckline.position.y = 1.02;
  body.add(torso, neckline);

  const armGeo = new THREE.CapsuleGeometry(0.05, 0.24, 4, 8).translate(0, -0.18, 0);
  const handGeo = new THREE.SphereGeometry(0.065, 8, 6).translate(0, -0.34, 0);
  const puffGeo = new THREE.SphereGeometry(0.11, 12, 8).scale(1, 0.85, 1);
  const arms = [-1, 1].map((s) => {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.24, 0.98, 0);
    pivot.rotation.z = s * 0.25;
    pivot.add(new THREE.Mesh(armGeo, skin), new THREE.Mesh(handGeo, skin), new THREE.Mesh(puffGeo, overM));
    body.add(pivot);
    return pivot;
  });

  // Head
  const head = new THREE.Group();
  head.position.y = 1.42;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 24, 18), skin));
  // hair: a shell around the back/sides, a fringe, and long waves down her back
  const back = new THREE.Mesh(new THREE.SphereGeometry(0.45, 24, 18, Math.PI * 0.28, Math.PI * 1.44, 0, Math.PI * 0.72), hairM);
  back.rotation.y = Math.PI / 2;  // the open side faces forward, framing the face
  back.position.set(0, 0.02, -0.02);
  const fringe = new THREE.Mesh(new THREE.SphereGeometry(0.435, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM);
  fringe.rotation.x = 0.32;
  fringe.position.y = 0.02;
  const long = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 14).scale(1.1, 1, 0.55), hairM);
  long.position.set(0, -0.42, -0.2);
  long.rotation.x = 0.12;
  const locks = [-1, 1].map((s) => {
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.42, 4, 8), hairM);
    l.position.set(s * 0.36, -0.32, 0.02);
    l.rotation.z = s * 0.08;
    head.add(l);
    return l;
  });
  head.add(back, fringe, long);

  // golden tiara with a pink gem
  const tiara = new THREE.Group();
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.025, 6, 24), goldM);
  band.rotation.x = Math.PI / 2;
  tiara.add(band);
  for (let i = 0; i < 5; i++) {
    const a = Math.PI / 2 + (i - 2) * 0.42;
    const h = i === 2 ? 0.2 : i % 2 ? 0.13 : 0.1;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.035, h, 6), goldM);
    spike.position.set(Math.cos(a) * 0.2, h / 2, Math.sin(a) * 0.2);
    tiara.add(spike);
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(i === 2 ? 0.045 : 0.025, 8, 6), i === 2 ? gemM : trimM);
    pearl.position.set(Math.cos(a) * 0.2, h + 0.01, Math.sin(a) * 0.2);
    tiara.add(pearl);
  }
  tiara.position.set(0, 0.4, 0.04);
  tiara.rotation.x = -0.25;
  head.add(tiara);

  // face
  const eyeGeo = new THREE.SphereGeometry(0.05, 10, 8).scale(1, 1.25, 0.6);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Mesh(eyeGeo, dark);
    e.position.set(s * 0.14, -0.02, 0.37);
    head.add(e);
    return e;
  });
  const cheekGeo = new THREE.CircleGeometry(0.06, 12);
  [-1, 1].forEach((s) => {
    const c = new THREE.Mesh(cheekGeo, cheekM);
    c.position.set(s * 0.22, -0.11, 0.33);
    c.rotation.y = s * 0.55;
    head.add(c);
  });
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), dark);
  smile.position.set(0, -0.12, 0.385);
  smile.rotation.z = Math.PI;
  head.add(smile);

  // Soft blob shadow
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: '#8f5d8a', transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.position.y = 0.06;
  root.add(shadow);

  // A gentle halo of light so she stays readable in the mist
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2f8', transparent: true, opacity: 0.4, depthWrite: false }));
  glow.scale.setScalar(2.8);
  glow.position.y = 0.9;
  root.add(glow);

  /* ---------- Sparkle trail (world space, so it stays behind her) ---------- */
  const TN = 60;
  const tPos = new Float32Array(TN * 3).fill(-999);
  const tLife = new Float32Array(TN);
  const tCol = new Float32Array(TN * 3);
  const trailColors = ['#fff3b0', '#ffd1e3', '#e3d4ff', '#ffffff'].map((c) => new THREE.Color(c));
  for (let i = 0; i < TN; i++) trailColors[i % 4].toArray(tCol, i * 3);
  const tGeo = new THREE.BufferGeometry();
  tGeo.setAttribute('position', new THREE.BufferAttribute(tPos, 3));
  tGeo.setAttribute('aLife', new THREE.BufferAttribute(tLife, 1));
  tGeo.setAttribute('aColor', new THREE.BufferAttribute(tCol, 3));
  const tMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: glowTexture() }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aLife; attribute vec3 aColor;
      uniform float uPixelRatio;
      varying float vLife; varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 0.22 * uPixelRatio * (320.0 / max(-mv.z, 0.1)) * (0.4 + aLife);
        vLife = aLife; vColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying float vLife; varying vec3 vColor;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vLife;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });
  const trail = new THREE.Points(tGeo, tMat);
  trail.frustumCulled = false;
  let tCursor = 0, tEmit = 0;
  const _w = new THREE.Vector3();

  let phase = 0, walk = 0, time = 0, blink = 2;
  return {
    object: root,
    trail,
    // body parts, so idle animations can pose her (they run after update() each frame)
    rig: { root, body, gown, legs, arms, head, eyes, cheekM, long, locks },
    // speed01: 0 = standing, 1 = full walk
    update(dt, speed01, run = 0) {
      time += dt;
      walk = damp(walk, speed01, 10, dt);
      phase += dt * (4 + 6 * walk + 4 * run);
      const sw = Math.sin(phase * 1.4) * walk;
      legs[0].rotation.x = sw * 0.6;
      legs[1].rotation.x = -sw * 0.6;
      arms[0].rotation.x = -sw * 0.55;
      arms[1].rotation.x = sw * 0.55;
      arms[0].rotation.z = -0.3 - (1 - walk) * Math.sin(time * 1.6) * 0.04;
      arms[1].rotation.z = 0.3 + (1 - walk) * Math.sin(time * 1.6) * 0.04;
      // walk bounce + idle breathing; the gown sways and the hair swings
      body.position.y = Math.abs(Math.sin(phase * 1.4)) * (0.06 + 0.04 * run) * walk + Math.sin(time * 2) * 0.012 * (1 - walk);
      body.rotation.z = Math.sin(phase * 1.4) * 0.035 * walk;
      gown.rotation.z = -Math.sin(phase * 1.4) * 0.05 * walk;
      gown.rotation.x = -0.06 * walk;
      long.rotation.x = 0.12 + walk * 0.25 + Math.sin(phase * 2.8) * 0.04 * walk;
      locks.forEach((l, i) => { l.rotation.x = walk * 0.2 + Math.sin(phase * 2.8 + i) * 0.05 * walk; });
      head.rotation.z = Math.sin(time * 0.9) * 0.06 * (1 - walk);
      head.rotation.x = walk * 0.06;
      // blink every few seconds
      blink -= dt;
      const closed = blink < 0.12;
      eyes.forEach((e) => { e.scale.y = closed ? 0.15 : 1; });
      if (blink < 0) blink = 2 + Math.random() * 3;
      shadow.scale.setScalar(1 - body.position.y * 1.5);

      // sparkles from the hem of her gown
      tEmit -= dt;
      if (walk > 0.2 && tEmit <= 0) {
        tEmit = run > 0.5 ? 0.02 : 0.035;
        root.getWorldPosition(_w);
        const a = Math.random() * Math.PI * 2;
        tPos[tCursor * 3] = _w.x + Math.cos(a) * 0.45;
        tPos[tCursor * 3 + 1] = 0.1 + Math.random() * 0.3;
        tPos[tCursor * 3 + 2] = _w.z + Math.sin(a) * 0.45;
        tLife[tCursor] = 1;
        tCursor = (tCursor + 1) % TN;
      }
      for (let i = 0; i < TN; i++) {
        if (tLife[i] <= 0) continue;
        tLife[i] = Math.max(0, tLife[i] - dt * 0.9);
        tPos[i * 3 + 1] += dt * 0.5;
      }
      tGeo.attributes.position.needsUpdate = true;
      tGeo.attributes.aLife.needsUpdate = true;
    },
    // Little hop for celebrations
    cheer(t) {
      body.position.y = Math.max(0, Math.sin(t * 9)) * 0.25;
      arms[0].rotation.z = -2.4; arms[1].rotation.z = 2.4;
      arms[0].rotation.x = arms[1].rotation.x = 0;
    },
  };
}
