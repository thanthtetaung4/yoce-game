import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { createBurst } from '../minigames/burst.js';
import { clamp, ease, lerp, smoothstep, heartShape, glowTexture } from '../utils.js';

// Idle animations: when she stands still for a few seconds, she does one of these at random:
//   mirror · takes out a hand mirror, fixes her hair, puts on lipstick, winks
//   car    · a little pastel car pops up and she drives a lap around the spot
//   code   · a chair, desk and laptop pop up and she codes until the build passes
// Walking cancels whatever is playing and everything pops away. Space plays them on demand as emotes.
const IDLE_AFTER = [5, 8];   // seconds of standing still before one starts
const REST_AFTER = [9, 14];  // pause before the next one

export function createIdle({ player, path, follow, audio, gateLocked }) {
  const ch = player.character, rig = ch.rig;
  const group = new THREE.Group();
  const burst = createBurst(160);
  group.add(burst.points);
  const hw = CONFIG.pathHalfWidth;
  const v = new THREE.Vector3();
  const pop = (obj, t, s = 1) => obj.scale.setScalar(Math.max(0.0001, ease.outBack(clamp(t, 0, 1), 2) * s));
  // weight that eases a pose in at the start and out at the end of an animation
  const weight = (t, dur, inT = 0.45, outT = 0.5) => Math.min(smoothstep(0, inT, t), 1 - smoothstep(dur - outT, dur, t));
  const poseArm = (arm, x, z, w) => { arm.rotation.x = lerp(arm.rotation.x, x, w); arm.rotation.z = lerp(arm.rotation.z, z, w); };
  const worldOf = (obj, x, y, z) => obj.localToWorld(v.set(x, y, z)).clone();

  // things popping away after an animation ends
  const leaving = [];
  const popAway = (obj) => { if (obj.visible && !leaving.some((l) => l.obj === obj)) leaving.push({ obj, t: 0, s: obj.scale.x }); };

  /* ======================= Mirror + makeup ======================= */
  const mirror = new THREE.Group();
  {
    const shine = document.createElement('canvas');
    shine.width = shine.height = 64;
    const g = shine.getContext('2d');
    const lg = g.createLinearGradient(0, 0, 64, 64);
    lg.addColorStop(0, '#f4f0ff'); lg.addColorStop(0.5, '#cfe3f7'); lg.addColorStop(1, '#e9dcff');
    g.fillStyle = lg; g.fillRect(0, 0, 64, 64);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(14, 40); g.lineTo(40, 14); g.moveTo(26, 48); g.lineTo(46, 28); g.stroke();
    const tex = new THREE.CanvasTexture(shine); tex.colorSpace = THREE.SRGBColorSpace;
    const frameM = new THREE.MeshLambertMaterial({ color: '#f7b8cf', emissive: '#f7b8cf', emissiveIntensity: 0.3 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.026, 8, 24), frameM);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.13, 24), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    glass.position.z = 0.006;
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), frameM);
    back.rotation.y = Math.PI; back.position.z = -0.006;
    // a long handle reaching back to her hand, so the mirror sits out in front of her (big chibi) face
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.34, 8), frameM);
    handle.position.set(0, -0.29, 0.07); handle.rotation.x = -0.45;
    const bow = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff8fb5', toneMapped: false }));
    bow.position.y = 0.16;
    mirror.add(ring, glass, back, handle, bow);
    // in the left hand: mirror "up" along the arm's +z, its face pointing back at her
    mirror.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 1, 0)));
    mirror.position.set(0, -0.5, 0.42);
    mirror.visible = false;
    rig.arms[0].add(mirror);
  }
  const lipstick = new THREE.Group();
  {
    const gold = new THREE.MeshLambertMaterial({ color: '#ffd36e', emissive: '#ffbf4d', emissiveIntensity: 0.4 });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.1, 10), gold);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.06, 10), new THREE.MeshBasicMaterial({ color: '#ff5f97', toneMapped: false }));
    tip.position.y = -0.08;
    lipstick.add(tube, tip);
    lipstick.position.set(0, -0.4, 0);
    lipstick.visible = false;
    rig.arms[1].add(lipstick);
  }
  const cheekBase = rig.cheekM.color.clone(), cheekRosy = new THREE.Color('#ff7fa3');

  const mirrorAnim = {
    name: 'mirror', duration: 7.2,
    camera: { yaw: Math.PI + 0.6, dist: 4.4 },
    start() { mirror.visible = true; mirror.scale.setScalar(0.0001); this.sparkles = 0; audio.chime(); },
    update(t) {
      const D = this.duration, w = weight(t, D);
      pop(mirror, t * 2.5);
      // left hand holds the mirror up in front of her face
      poseArm(rig.arms[0], -1.45, -0.3, w);
      rig.head.rotation.y = (-0.28 + Math.sin(t * 1.3) * 0.12) * w; // (nothing else turns her head sideways)
      rig.head.rotation.x = lerp(rig.head.rotation.x, 0.1, w);
      const hairPhase = smoothstep(0.4, 0.9, t) * (1 - smoothstep(3.0, 3.4, t));
      const makeupPhase = smoothstep(3.3, 3.8, t) * (1 - smoothstep(5.6, 6.0, t));
      // 1) fix her hair: right hand up at the side of her head, patting
      if (hairPhase > 0) {
        poseArm(rig.arms[1], -0.3 + Math.sin(t * 9) * 0.12, 2.7 + Math.sin(t * 9) * 0.12, hairPhase * w);
        rig.locks[1].rotation.z = Math.sin(t * 9) * 0.15 * hairPhase;
        rig.head.rotation.z = lerp(rig.head.rotation.z, -0.12, hairPhase);
      }
      if (t > 1.4 && this.sparkles === 0) { this.sparkles++; burst.emit(worldOf(rig.head, 0.4, 0.2, 0), 10, ['#fff0a6', '#ffffff']); }
      if (t > 2.7 && this.sparkles === 1) { this.sparkles++; burst.emit(worldOf(rig.head, -0.4, 0.25, 0), 10, ['#fff0a6', '#ffffff']); }
      // 2) lipstick: right hand to her lips, dab dab
      if (makeupPhase > 0) {
        if (!lipstick.visible) { lipstick.visible = true; lipstick.scale.setScalar(0.0001); this.lipT = t; }
        pop(lipstick, (t - this.lipT) * 3);
        poseArm(rig.arms[1], -2.35 + Math.sin(t * 7) * 0.08, -0.3, makeupPhase * w);
        rig.cheekM.color.copy(cheekBase).lerp(cheekRosy, smoothstep(3.8, 5.2, t));
        rig.cheekM.opacity = 0.8 + 0.2 * smoothstep(3.8, 5.2, t);
      }
      if (t > 5.3 && this.sparkles === 2) { this.sparkles++; burst.emit(worldOf(rig.head, 0, -0.1, 0.45), 16, ['#ff8fb5', '#ffd1e3', '#ffffff']); }
      if (t > 5.8 && lipstick.visible && !this.lipGone) { this.lipGone = true; popAway(lipstick); }
      // 3) a wink at the camera
      if (t > 6.0 && t < 6.6) rig.eyes[1].scale.y = 0.15;
      if (t > 6.3 && mirror.visible && !this.mirrorGone) { this.mirrorGone = true; popAway(mirror); }
    },
    stop() {
      popAway(mirror); popAway(lipstick);
      this.lipGone = this.mirrorGone = false;
      rig.cheekM.color.copy(cheekBase); rig.cheekM.opacity = 0.8;
      rig.head.rotation.y = 0;
      rig.locks[1].rotation.z = 0;
    },
  };

  /* ======================= Little car ======================= */
  const car = { root: new THREE.Group(), body: new THREE.Group(), wheels: [] };
  {
    car.root.add(car.body);
    const paint = new THREE.MeshLambertMaterial({ color: '#f7a8c4' });
    const cream = new THREE.MeshLambertMaterial({ color: '#fff6f1' });
    const shell = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.0, 6, 18).rotateX(Math.PI / 2).scale(1.3, 0.72, 1), paint);
    shell.position.y = 0.5;
    const cockpit = new THREE.Mesh(new THREE.CircleGeometry(0.36, 24).scale(1, 1.35, 1).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#c97a9b' }));
    cockpit.position.set(0, 0.805, -0.12);
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.03, 6, 30).scale(1, 1.6, 1).rotateX(Math.PI / 2), cream);
    stripe.position.y = 0.52;
    const shieldMat = new THREE.MeshBasicMaterial({ color: '#d6ecff', transparent: true, opacity: 0.55, side: THREE.DoubleSide, toneMapped: false });
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.26), shieldMat);
    shield.position.set(0, 0.93, 0.4); shield.rotation.x = -0.55;
    const heart = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(), 8).scale(0.22, 0.22, 1), cream);
    heart.position.set(0, 0.55, 0.935);
    const lightM = new THREE.MeshBasicMaterial({ color: '#fff3b0', toneMapped: false });
    const tailM = new THREE.MeshBasicMaterial({ color: '#ff8fb5', toneMapped: false });
    [-1, 1].forEach((s) => {
      const hl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), lightM); hl.position.set(s * 0.32, 0.55, 0.88);
      const tl = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), tailM); tl.position.set(s * 0.33, 0.55, -0.9);
      car.body.add(hl, tl);
    });
    const steer = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.022, 6, 18), cream);
    steer.position.set(0, 0.95, 0.2); steer.rotation.x = -0.9;
    car.body.add(shell, cockpit, stripe, shield, heart, steer);
    const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 18).rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.16, 10).rotateZ(Math.PI / 2);
    const wheelM = new THREE.MeshLambertMaterial({ color: '#b9a2e6' });
    for (const [x, z] of [[-0.55, 0.58], [0.55, 0.58], [-0.55, -0.58], [0.55, -0.58]]) {
      const w = new THREE.Group();
      w.add(new THREE.Mesh(wheelGeo, wheelM), new THREE.Mesh(hubGeo, cream));
      w.position.set(x, 0.2, z);
      car.root.add(w);
      car.wheels.push(w);
    }
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24).scale(0.8, 1.25, 1).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#8f5d8a', transparent: true, opacity: 0.18, depthWrite: false }));
    shadow.position.y = 0.05;
    car.root.add(shadow);
    car.root.visible = false;
    group.add(car.root);
  }
  const SEAT = new THREE.Vector3(0, 0.22, -0.12);

  const carAnim = {
    name: 'car', duration: 10,
    camera: { yaw: 0.25, dist: 7.8, relativeToPath: false }, // from behind the lap (set by plan())
    // a closed loop that starts and ends where she stands. It tries the way she's facing first, then other
    // directions, and shrinks the car (and her with it) until the whole lap fits between the hedges.
    plan() {
      const pos = player.position;
      const n = path.nearest(pos, player.state.hint);
      const routeYaw = Math.atan2(n.tan.x, n.tan.z);
      const f = player.state.facing;
      const headings = [f, routeYaw, routeYaw + Math.PI, f + Math.PI, f + Math.PI / 2, f - Math.PI / 2];
      const F = new THREE.Vector3(), R = new THREE.Vector3();
      for (const k of [1, 0.85, 0.72, 0.6, 0.5, 0.42, 0.35]) {
        for (const yaw of headings) {
          F.set(Math.sin(yaw), 0, Math.cos(yaw)); R.set(-F.z, 0, F.x);
          const at = (d, lat) => pos.clone().addScaledVector(F, d * k).addScaledVector(R, lat * k).setY(0);
          const pts = [at(0, 0), at(2.6, 1.4), at(5.6, 0), at(2.6, -1.4)];
          // the lap mustn't end up past a locked birthday gate
          if (gateLocked() && pts.some((p) => path.nearest(p, n.index).u > path.gateU - 0.004)) continue;
          const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
          // the car is ~0.7 m wide either side of its middle at full size; keep that clear of the hedge faces
          const margin = 0.2 - 0.75 * k;
          let clear = true;
          for (let s = 0; s < 1 && clear; s += 0.025) { const p = curve.getPointAt(s); clear = path.maze.walkable(p.x, p.z, margin); }
          if (!clear) continue;
          // camera behind the lap, measured from the way she faces now
          const camera = { yaw: yaw - f + 0.25, dist: 7.8 * Math.max(0.65, k), relativeToPath: false };
          return { start0: pts[0], curve, k, camera };
        }
      }
      return null;
    },
    ok() { return !!this.plan(); },
    start() {
      Object.assign(this, this.plan());
      this.len = this.curve.getLength();
      car.root.visible = true;
      car.root.position.copy(this.start0);
      const tan = this.curve.getTangentAt(0);
      car.root.rotation.y = Math.atan2(tan.x, tan.z);
      car.root.scale.setScalar(0.0001);
      this.lastS = 0; this.beeped = false;
      this.from = player.position.clone();
      burst.emit(this.start0.clone().setY(0.6), 24, ['#f7a8c4', '#fff0a6', '#ffffff']);
    },
    update(t, dt) {
      pop(car.root, t * 2.2, 1.3 * this.k);
      const DRIVE0 = 1.1, DRIVE1 = 8.3;
      const k = ease.inOutCubic(clamp((t - DRIVE0) / (DRIVE1 - DRIVE0), 0, 1));
      const s = k; // fraction of the lap
      const p = this.curve.getPointAt(s % 1);
      const tan = this.curve.getTangentAt(s % 1);
      const heading = Math.atan2(tan.x, tan.z);
      if (t > DRIVE0) {
        car.root.position.copy(p);
        car.root.rotation.y = heading;
      }
      const moved = (s - this.lastS) * this.len;
      this.lastS = s;
      car.wheels.forEach((w) => { w.rotation.x += moved / (0.26 * this.k); });
      car.body.position.y = Math.abs(Math.sin(t * 14)) * 0.025 * (moved > 0.001 ? 1 : 0);
      car.body.rotation.z = (moved > 0.001 ? Math.sin(t * 3) * 0.03 : 0);
      if (moved > 0.02 && Math.random() < 0.5) burst.emit(worldOf(car.root, 0, 0.3, -1), 1, ['#ffd1e3', '#fff0a6', '#dccdf4']);
      if (!this.beeped && t > 0.9) { this.beeped = true; audio.beep(); }

      // she hops in, rides, and hops back out
      const hopIn = clamp((t - 0.35) / 0.5, 0, 1), hopOut = clamp((t - 8.45) / 0.5, 0, 1);
      car.root.updateMatrixWorld();
      const seat = car.root.localToWorld(v.copy(SEAT).add(car.body.position));
      const riding = hopIn >= 1 && hopOut <= 0;
      const root = rig.root;
      // she shrinks to fit a smaller car while she rides
      if (this.k < 1) root.scale.setScalar(lerp(1, this.k, hopIn) + (1 - this.k) * hopOut);
      if (hopOut > 0) {
        root.position.lerpVectors(seat, this.start0, hopOut);
        root.position.y += Math.sin(hopOut * Math.PI) * 0.6;
      } else if (hopIn > 0) {
        root.position.lerpVectors(this.from, seat, hopIn);
        root.position.y += Math.sin(hopIn * Math.PI) * 0.6;
      }
      if (hopIn > 0) root.rotation.y = car.root.rotation.y;
      const inCar = hopIn > 0.6 && hopOut < 0.4;
      rig.gown.visible = !inCar;
      rig.legs.forEach((l) => { l.visible = !inCar; });
      if (riding || inCar) {
        // hands on the wheel, little happy head bobs
        poseArm(rig.arms[0], -1.15, 0.35, 1);
        poseArm(rig.arms[1], -1.15, -0.35, 1);
        rig.head.rotation.z = Math.sin(t * 4) * 0.08;
      }
      if (hopOut >= 1 && car.root.visible && !this.gone) {
        this.gone = true;
        popAway(car.root);
        burst.emit(car.root.position.clone().setY(0.6), 20, ['#f7a8c4', '#fff0a6', '#ffffff']);
        // she's standing where the lap started; face the way the car was heading
        player.state.facing = car.root.rotation.y;
      }
    },
    stop(cancelled) {
      this.gone = false;
      rig.root.scale.setScalar(1);
      rig.gown.visible = true;
      rig.legs.forEach((l) => { l.visible = true; });
      if (car.root.visible) popAway(car.root);
      // if she leaves mid-ride, she steps out right where the car is (it never leaves the path)
      if (cancelled && this.curve) {
        const p = car.root.position;
        player.position.set(p.x, 0, p.z);
        player.state.hint = -1;
      } else if (this.start0) {
        player.position.set(this.start0.x, 0, this.start0.z);
        player.state.hint = -1;
      }
    },
  };

  /* ======================= Desk, chair + laptop ======================= */
  const desk = { root: new THREE.Group(), chair: new THREE.Group(), table: new THREE.Group(), laptop: new THREE.Group(), lid: new THREE.Group() };
  const LINES = [
    ['const yoce = { age: 21 };', '#ffd1e3'],
    ['// started from zero 💪', '#9a8fb8'],
    ['while (learning) {', '#c9b8ff'],
    ['  practice();', '#bff3e6'],
    ['  fixBugs();', '#bff3e6'],
    ['}', '#c9b8ff'],
    ['yoce.graduate(); // 🎓', '#fff0a6'],
    ["console.log('I did it!');", '#ffd1e3'],
  ];
  const screen = document.createElement('canvas');
  screen.width = 256; screen.height = 160;
  const sg = screen.getContext('2d');
  const screenTex = new THREE.CanvasTexture(screen);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  function drawScreen(chars, passed) {
    sg.fillStyle = '#2b2340'; sg.fillRect(0, 0, 256, 160);
    sg.fillStyle = '#3a3055'; sg.fillRect(0, 0, 256, 14);
    ['#ff8fa3', '#ffd36e', '#9fe3b5'].forEach((c, i) => { sg.fillStyle = c; sg.beginPath(); sg.arc(9 + i * 10, 7, 3, 0, 7); sg.fill(); });
    sg.font = '600 12px ui-monospace, Menlo, Consolas, monospace';
    let left = chars, y = 28;
    for (const [line, color] of LINES) {
      if (left <= 0) break;
      sg.fillStyle = color;
      sg.fillText(line.slice(0, left), 8, y);
      if (left < line.length) { sg.fillStyle = '#ffffff'; sg.fillRect(8 + sg.measureText(line.slice(0, left)).width + 1, y - 10, 6, 12); }
      left -= line.length;
      y += 15;
    }
    if (passed) {
      sg.fillStyle = 'rgba(159, 240, 181, .2)'; sg.fillRect(0, 140, 256, 20);
      sg.fillStyle = '#9ff0b5'; sg.fillText('✓ build passed', 8, 154);
    }
    screenTex.needsUpdate = true;
  }
  const TOTAL_CHARS = LINES.reduce((n, [l]) => n + l.length, 0);
  {
    const wood = new THREE.MeshLambertMaterial({ color: '#f3d3c4' });
    const legM = new THREE.MeshLambertMaterial({ color: '#b892a8' });
    const chairM = new THREE.MeshLambertMaterial({ color: '#cdb8f0' });
    const leg = (h) => new THREE.CylinderGeometry(0.03, 0.03, h, 6).translate(0, h / 2, 0);
    // table (top at 0.72, which suits her chibi arms)
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.62), wood);
    top.position.y = 0.72;
    desk.table.add(top);
    for (const [x, z] of [[-0.48, -0.24], [0.48, -0.24], [-0.48, 0.24], [0.48, 0.24]]) {
      const l = new THREE.Mesh(leg(0.7), legM); l.position.set(x, 0, z); desk.table.add(l);
    }
    desk.table.position.z = 0.52;
    // laptop on the table: base + a lid that opens
    const shell = new THREE.MeshLambertMaterial({ color: '#e9e3f5' });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.34), shell);
    const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.18).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: '#b9a8d6' }));
    keys.position.set(0, 0.014, -0.03);
    desk.laptop.add(base, keys);
    const lidBox = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.02).translate(0, 0.16, 0), shell);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.29).rotateY(Math.PI), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    face.position.set(0, 0.165, -0.012);
    const sticker = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(), 6).scale(0.07, 0.07, 1), new THREE.MeshBasicMaterial({ color: '#ff8fb5', toneMapped: false }));
    sticker.position.set(0, 0.17, 0.012);
    desk.lid.add(lidBox, face, sticker);
    desk.lid.position.set(0, 0.012, 0.17);
    desk.laptop.add(desk.lid);
    desk.laptop.position.set(0, 0.765, -0.1);
    desk.table.add(desk.laptop);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#c9b8ff', transparent: true, opacity: 0.5, depthWrite: false }));
    glow.position.set(0, 0.95, -0.02); glow.scale.setScalar(0.9);
    desk.table.add(glow);
    desk.glow = glow;
    // chair
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.6), chairM);
    seat.position.set(0, 0.4, -0.06);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 0.06), chairM);
    back.position.set(0, 0.7, -0.45);
    const cushion = new THREE.Mesh(new THREE.ShapeGeometry(heartShape(), 6).scale(0.2, 0.2, 1), new THREE.MeshBasicMaterial({ color: '#fff6f1' }));
    cushion.position.set(0, 0.72, -0.418);
    desk.chair.add(seat, back, cushion);
    for (const [x, z] of [[-0.26, -0.32], [0.26, -0.32], [-0.26, 0.2], [0.26, 0.2]]) {
      const l = new THREE.Mesh(leg(0.4), legM); l.position.set(x, 0, z); desk.chair.add(l);
    }
    desk.root.add(desk.chair, desk.table);
    desk.root.visible = false;
    group.add(desk.root);
  }
  // little floating code symbols
  const symbolTex = ['</>', '{ }', '✓', '01', '💻', '♡'].map((s) => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const g = c.getContext('2d');
    g.font = '700 40px ui-monospace, Menlo, Consolas, monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillStyle = '#b4577a';
    g.fillText(s, 64, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  });
  const symbols = Array.from({ length: 6 }, () => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
    s.scale.set(0.5, 0.25, 1);
    s.visible = false;
    group.add(s);
    return { s, life: 0 };
  });
  const check = new THREE.Sprite(new THREE.SpriteMaterial({ map: symbolTex[2], transparent: true, depthWrite: false, color: '#5fd18a' }));
  check.scale.set(1.2, 0.6, 1);
  check.visible = false;
  group.add(check);

  const codeAnim = {
    name: 'code', duration: 9.6,
    camera: { yaw: 1.35, dist: 3.6 }, // over her shoulder, so the code on the screen shows
    start() {
      desk.root.visible = true;
      desk.root.position.copy(player.position).setY(0);
      desk.root.rotation.y = player.state.facing;
      desk.chair.scale.setScalar(0.0001); desk.table.scale.setScalar(0.0001);
      desk.lid.rotation.x = -1.5;
      this.typed = 0; this.lastTick = 0; this.nextSym = 1.4; this.passed = false; this.checkT = -1;
      drawScreen(0, false);
      burst.emit(desk.root.position.clone().setY(0.7), 24, ['#cdb8f0', '#f3d3c4', '#ffffff']);
      audio.chime();
    },
    update(t, dt) {
      const D = this.duration, w = weight(t, D, 0.6, 0.7);
      pop(desk.chair, t * 2.4);
      pop(desk.table, t * 2.4 - 0.2);
      // lid opens, then closes at the end
      const open = smoothstep(0.7, 1.2, t) * (1 - smoothstep(8.0, 8.5, t));
      desk.lid.rotation.x = lerp(-1.5, 0.28, open);
      desk.glow.material.opacity = 0.5 * open;

      // sit down: legs forward, a little lower, arms out to the keyboard
      rig.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, -1.45, w); });
      rig.gown.scale.set(1, lerp(1, 0.8, w), 1);
      rig.body.position.y = lerp(rig.body.position.y, -0.02, w);
      const typing = t > 1.3 && t < 6.6;
      const cheer = smoothstep(6.6, 6.9, t) * (1 - smoothstep(7.6, 8.0, t));
      poseArm(rig.arms[0], -1.12 + (typing ? Math.sin(t * 22) * 0.07 : 0), 0.22, w * (1 - cheer));
      poseArm(rig.arms[1], -1.12 + (typing ? Math.sin(t * 22 + 1.7) * 0.07 : 0), -0.22, w * (1 - cheer));
      if (cheer > 0) { poseArm(rig.arms[0], 0, -2.5, cheer); poseArm(rig.arms[1], 0, 2.5, cheer); rig.body.position.y += Math.abs(Math.sin(t * 10)) * 0.06 * cheer; }
      rig.head.rotation.x = lerp(rig.head.rotation.x, 0.16 + (typing ? Math.sin(t * 1.7) * 0.04 : 0), w * (1 - cheer));
      rig.head.rotation.y = 0;

      // the code types itself out on the screen
      if (typing) {
        const target = Math.min(TOTAL_CHARS, Math.floor((t - 1.3) * 34));
        if (target !== this.typed) { this.typed = target; drawScreen(target, false); }
        if (t - this.lastTick > 0.09) { this.lastTick = t; audio.tick(); }
      }
      if (t > 6.6 && !this.passed) {
        this.passed = true;
        drawScreen(TOTAL_CHARS, true);
        this.checkT = t;
        check.visible = true;
        check.position.copy(worldOf(desk.table, 0, 1.45, -0.05));
        burst.emit(check.position, 26, ['#9ff0b5', '#fff0a6', '#ffffff']);
        audio.found();
      }
      if (this.checkT > 0) {
        const k = t - this.checkT;
        check.scale.set(1.2 * ease.outBack(clamp(k * 3, 0, 1), 2), 0.6 * ease.outBack(clamp(k * 3, 0, 1), 2), 1);
        check.position.y += dt * 0.25;
        check.material.opacity = 1 - smoothstep(1.2, 1.7, k);
        if (k > 1.7) { check.visible = false; this.checkT = -1; }
      }
      // floating </> { } ✓ while she types
      if (typing && t > this.nextSym) {
        this.nextSym = t + 0.7 + Math.random() * 0.4;
        const sym = symbols.find((x) => x.life <= 0);
        if (sym) {
          sym.life = 1.6;
          sym.s.material.map = symbolTex[Math.floor(Math.random() * symbolTex.length)];
          sym.s.material.needsUpdate = true;
          sym.s.position.copy(worldOf(desk.table, (Math.random() - 0.5) * 0.6, 1.15, 0));
          sym.s.visible = true;
        }
      }
      if (t > 8.6 && !this.gone) { this.gone = true; popAway(desk.root); burst.emit(desk.root.position.clone().setY(0.7), 20, ['#cdb8f0', '#ffffff']); }
    },
    stop() {
      this.gone = false;
      rig.gown.scale.set(1, 1, 1);
      if (desk.root.visible) popAway(desk.root);
      check.visible = false;
    },
  };
  // symbols drift up whatever is playing
  function updateSymbols(dt) {
    symbols.forEach((x) => {
      if (x.life <= 0) return;
      x.life -= dt;
      x.s.position.y += dt * 0.55;
      x.s.material.opacity = Math.min(1, x.life * 1.5);
      if (x.life <= 0) x.s.visible = false;
    });
  }

  /* ======================= Orchestration ======================= */
  const ANIMS = [mirrorAnim, carAnim, codeAnim];
  const rand = (a, b) => a + Math.random() * (b - a);
  let idleT = 0, waitFor = rand(...IDLE_AFTER), cur = null, curT = 0, lastName = '';

  function frameCamera(anim) {
    const f = path.frameAt(Math.min(1, player.state.u + 0.008));
    const pathYaw = Math.atan2(f.tan.x, f.tan.z);
    // camera.yaw is the direction the camera looks: facing + π looks back at her face
    const goal = anim.camera.relativeToPath ? pathYaw + anim.camera.yaw : player.state.facing + anim.camera.yaw;
    const off = goal - player.state.facing; // the camera's offsets are measured from behind her
    follow.frame(Math.atan2(Math.sin(off), Math.cos(off)), anim.camera.dist);
  }
  function start() {
    const pool = ANIMS.filter((a) => a.name !== lastName && (!a.ok || a.ok()));
    cur = pool[Math.floor(Math.random() * pool.length)];
    lastName = cur.name;
    curT = 0;
    cur.start();
    frameCamera(cur);
  }
  function stop(cancelled) {
    if (!cur) return;
    cur.stop(cancelled);
    cur = null;
    idleT = 0;
    waitFor = rand(...REST_AFTER);
    follow.frame(0);
  }

  return {
    group,
    get playing() { return cur?.name || null; },
    // call every frame after the player has updated; `allowed` is false whenever she isn't free to idle
    update(dt, { allowed, moving, renderer }) {
      if (cur) {
        if (moving || !allowed) stop(true);
        else {
          curT += dt;
          cur.update(curT, dt);
          if (curT >= cur.duration) stop(false);
        }
      } else {
        idleT = allowed && !moving ? idleT + dt : 0;
        if (idleT > waitFor) start();
      }
      for (let i = leaving.length - 1; i >= 0; i--) {
        const l = leaving[i];
        l.t += dt;
        l.obj.scale.setScalar(Math.max(0.0001, l.s * (1 - ease.outCubic(Math.min(1, l.t / 0.3)))));
        if (l.t >= 0.3) { l.obj.visible = false; l.obj.scale.setScalar(1); leaving.splice(i, 1); }
      }
      updateSymbols(dt);
      burst.update(dt, renderer);
    },
    cancel() { stop(true); idleT = 0; },
    // an emote on demand: the next one in turn (skipping any that won't fit here, like the car beside a hedge)
    emote() {
      const from = Math.max(0, ANIMS.findIndex((a) => a.name === (cur?.name || lastName)));
      const next = [1, 2, 3].map((k) => ANIMS[(from + k) % ANIMS.length]).find((a) => !a.ok || a.ok());
      if (!next) return;
      stop(true);
      cur = next; lastName = next.name; curT = 0;
      cur.start();
      frameCamera(cur);
    },
    // dev: play one right now
    play(name) { stop(true); cur = ANIMS.find((a) => a.name === name) || null; if (cur) { lastName = name; curT = 0; cur.start(); frameCamera(cur); } },
  };
}
