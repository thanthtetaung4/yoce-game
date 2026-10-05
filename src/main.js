import './styles.css';
import * as THREE from 'three';
import { CONFIG } from './config.js';
import { STORY } from './data/story.js';
import { MEMORIES } from './data/memories.js';
import { createScene } from './scene/setup.js';
import { createPath } from './world/path.js';
import { ZONES } from './world/zones.js';
import { createWorld } from './world/world.js';
import { createProps } from './world/props.js';
import { createAmbient } from './world/ambient.js';
import { createPlayer } from './player/player.js';
import { createControls } from './player/controls.js';
import { createIdle } from './player/idle.js';
import { createFollowCamera } from './camera/follow.js';
import { createMemoryMarkers } from './memories/markers.js';
import { createEnding } from './ending/ending.js';
import { createTrials } from './minigames/trials.js';
import { createTrialCard } from './ui/trialCard.js';
import { createHud } from './ui/hud.js';
import { createModal } from './ui/modal.js';
import { createScreens } from './ui/screens.js';
import { createAudio } from './ui/audio.js';
import { disposeObject, isTouch } from './utils.js';

const STORAGE_KEY = 'hb-visited';
const TRIALS_KEY = 'hb-trials';
const canvas = document.getElementById('scene');
const screens = createScreens(STORY);
let state = 'loading'; // loading → title → play ⇄ memory / card (trial) → ending

/* ---------- Loading ---------- */
// Signposts and captions are drawn with the web fonts, so wait for them briefly first.
const fontsReady = Promise.race([
  Promise.all(['600 64px Fredoka', '700 48px Caveat'].map((f) => document.fonts?.load(f))).catch(() => {}),
  new Promise((r) => setTimeout(r, 2500)),
]);
let fontP = 0, texP = 0;
const setLoad = () => screens.setProgress(fontP * 0.15 + texP * 0.85);
const manager = new THREE.LoadingManager();
manager.onProgress = (_, loaded, total) => { texP = loaded / total; setLoad(); };
const texturesDone = new Promise((resolve) => { manager.onLoad = resolve; manager.onError = (url) => console.warn('[loader] could not load', url); });

await fontsReady;
fontP = 1; setLoad();

/* ---------- Build the world ---------- */
const sceneCtx = createScene(canvas);
const { renderer, scene, camera } = sceneCtx;
// each memory gets its own little nook in the maze, near its spot on the route
const path = createPath({ nooks: MEMORIES.map((m) => (m.zone + m.at) / ZONES.length) });
const world = createWorld(path);
const markers = createMemoryMarkers(path, MEMORIES, manager);
const trials = createTrials(path, {
  onProgress(it) {
    hud.setTask(`✦ ${it.found} / ${it.def.count} ${it.def.unit}`, it.found >= it.def.count);
    if (it.found > 0 && it.found < it.def.count) audio.found();
  },
  onComplete(it) {
    saveTrials();
    hud.setTrials(trials.doneCount);
    audio.celebrate();
    setTimeout(() => {
      hud.setTask(null);
      if (state === 'play') openTrial(it);
    }, 900);
  },
});
// keep decorations clear of the memories and the rune stones; no extra lanterns where the lantern trial is
const props = createProps(path, [...markers.items.map((it) => it.root.position), ...trials.items.map((it) => it.root.position)], {
  noLanternZones: trials.items.filter((it) => it.def.type === 'lanterns').map((it) => it.def.zone),
});
const ambient = createAmbient(sceneCtx);
const player = createPlayer(path);
const follow = createFollowCamera(camera, path);
const ending = createEnding(path, STORY.age);
scene.add(world.group, props.group, markers.group, trials.group, ambient.object, player.object, player.character.trail, ending.group);

const audio = createAudio();
const idle = createIdle({ player, path, follow, audio, gateLocked: () => gateLocked() });
scene.add(idle.group);
const hud = createHud({
  total: MEMORIES.length,
  trialsTotal: trials.total,
  muted: audio.muted,
  onMute: () => { audio.setMuted(!audio.muted); return audio.muted; },
});

/* ---------- Visited memories (remembered between visits) ---------- */
const visitedIds = new Set();
try { JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').forEach((id) => visitedIds.add(id)); } catch {}
const save = () => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...visitedIds])); } catch {} };
markers.items.forEach((it) => { if (visitedIds.has(it.mem.id)) markers.setVisited(it, true); });
const foundCount = () => markers.items.filter((it) => it.visited).length;
const allFound = () => foundCount() === markers.items.length;
const gateLocked = () => CONFIG.requireAllMemories && !allFound();
world.setGateOpen(!gateLocked(), true);
hud.setFound(foundCount());

/* ---------- Trials (remembered between visits) ---------- */
function saveTrials() { try { localStorage.setItem(TRIALS_KEY, JSON.stringify(trials.items.filter((it) => it.state === 'done').map((it) => it.def.id))); } catch {} }
try {
  const done = JSON.parse(localStorage.getItem(TRIALS_KEY) || '[]');
  trials.items.forEach((it) => { if (done.includes(it.def.id)) trials.markDone(it); });
} catch {}
hud.setTrials(trials.doneCount);
const trialCard = createTrialCard();
function openTrial(it) {
  if (state !== 'play' || !it) return;
  state = 'card';
  controls.setEnabled(false);
  hud.prompt(null);
  canvas.classList.remove('is-hover');
  const z = ZONES[it.def.zone].label;
  const done = it.state === 'done';
  audio.chime();
  trialCard.show(done
    ? { kicker: `✦ ${z} · trial complete`, title: it.def.title, text: it.def.outro, button: 'Keep walking ♡', outro: true }
    : { kicker: `✦ ${z} · a little trial`, title: it.def.title, text: it.def.intro, how: (isTouch && it.def.howTouch) || it.def.how, button: 'Begin ✦' },
  ).then((r) => {
    audio.close();
    state = 'play';
    controls.setEnabled(true);
    if (r === 'go' && it.state === 'idle') trials.start(it);
  });
}

/* ---------- Memory card ---------- */
let openItem = null;
const modal = createModal({
  onClose() {
    const it = openItem;
    openItem = null;
    audio.close();
    state = 'play';
    controls.setEnabled(true);
    if (it && !it.visited) {
      markers.setVisited(it, true);
      visitedIds.add(it.mem.id);
      save();
      hud.setFound(foundCount());
      audio.found();
      if (allFound()) {
        world.setGateOpen(true);
        setTimeout(() => {
          audio.celebrate();
          hud.toast(CONFIG.requireAllMemories ? 'Every memory found! The path to your birthday is open ♡' : 'Every memory found! Now follow the path to the end ♡', 4200);
        }, 450);
      }
    }
  },
});
function openMemory(it) {
  if (state !== 'play' || !it) return;
  state = 'memory';
  openItem = it;
  controls.setEnabled(false);
  hud.prompt(null);
  canvas.classList.remove('is-hover');
  audio.chime();
  modal.show(it.mem, it.i, MEMORIES.length);
}

/* ---------- Input ---------- */
let nearest = null;
let nearStone = null;
const controls = createControls(canvas, {
  onTap(x, y, pointerType) {
    if (state !== 'play') return;
    // fingers get a generous margin around photos and stones; the mouse stays precise
    const tol = pointerType === 'mouse' ? 10 : 44;
    const it = markers.pick(x, y, camera, tol);
    if (it) {
      const d = it.root.position.distanceTo(player.position);
      if (d < 16) openMemory(it);
      else hud.toast('Walk a little closer to open this one ♡');
      return;
    }
    const t = trials.pick(x, y, camera, tol);
    if (t?.kind === 'stone') {
      if (t.item.root.position.distanceTo(player.position) < 16) openTrial(t.item);
      else hud.toast('Walk a little closer to the rune stone ✦');
    }
  },
  onHover(x, y) {
    if (state !== 'play') return;
    canvas.classList.toggle('is-hover', !!markers.pick(x, y, camera) || trials.hovering(x, y, camera));
  },
  onInteract: interact,
  onEmote() { if (state === 'play') idle.emote(); },
});
// open whatever is close by: the E key, or tapping the prompt pill
function interact() {
  if (state !== 'play') return;
  const dm = nearest ? Math.hypot(nearest.root.position.x - player.position.x, nearest.root.position.z - player.position.z) : Infinity;
  if (nearStone && nearStone.dist < dm) openTrial(nearStone.item);
  else if (nearest) openMemory(nearest);
}
hud.onPromptTap(interact);
hud.onEmoteTap(() => { if (state === 'play') idle.emote(); });

/* ---------- Ending ---------- */
function startEnding() {
  state = 'ending';
  controls.setEnabled(false);
  hud.show(false);
  canvas.classList.remove('is-hover');
  audio.celebrate();
  ending.start(camera, follow.lookTarget, player.position);
}
function replay() {
  idle.cancel();
  ending.reset();
  visitedIds.clear(); save();
  markers.items.forEach((it) => markers.setVisited(it, false));
  world.setGateOpen(!gateLocked(), true);
  player.reset();
  follow.snap(player.position, player.state.facing);
  hud.setFound(0);
  trials.reset();
  saveTrials();
  hud.setTrials(0);
  hud.setTask(null);
  hud.show(true);
  state = 'play';
  controls.setEnabled(true);
}

/* ---------- Main loop (the only requestAnimationFrame in the app) ---------- */
let last = performance.now(), time = 0, raf = 0, blockedCooldown = 0, lastZone = -1;
const announced = new Set();
const titleLook = new THREE.Vector3();

function frame(now) {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  const u = player.state.u;

  if (state === 'title' || state === 'loading') {
    // slow orbit in front of her as a backdrop for the title screen
    const f = path.frameAt(u);
    const yaw = Math.atan2(f.tan.x, f.tan.z) + Math.sin(time * 0.15) * 0.55;
    const r = isTouch ? 6.5 : 5.2;
    camera.position.set(player.position.x + Math.sin(yaw) * r, 3.2, player.position.z + Math.cos(yaw) * r);
    camera.lookAt(titleLook.copy(player.position).setY(1.1));
    player.character.update(dt, 0);
  } else if (state === 'play') {
    const input = controls.move();
    const moving = Math.hypot(input.x, input.y) > 0.05;
    player.update(dt, input, follow.yaw, { gateLocked: gateLocked() });
    idle.update(dt, { allowed: true, moving, renderer });
    follow.update(dt, player.position, player.state.facing, controls.takeLook(), moving);
    blockedCooldown -= dt;
    if (player.state.blocked && blockedCooldown <= 0) {
      const left = markers.items.length - foundCount();
      hud.toast(`Find every memory first ♡ (${left} to go)`, 2400);
      blockedCooldown = 3;
    }
    if (!gateLocked() && player.state.u > path.finaleU) startEnding();
  } else if (state === 'memory' || state === 'card') {
    player.character.update(dt, 0);
    controls.takeLook();
  }
  if (state !== 'play') idle.update(dt, { allowed: false, moving: false, renderer });

  nearest = markers.update(dt, player.position, camera);
  nearStone = trials.update(dt, player.position, player.state.u, camera, renderer);
  if (state === 'play') {
    const dm = nearest ? Math.hypot(nearest.root.position.x - player.position.x, nearest.root.position.z - player.position.z) : Infinity;
    if (nearStone && nearStone.dist < dm) {
      hud.prompt(nearStone.item.state === 'done' ? (isTouch ? '✦ Trial complete · tap here to read again' : '✦ Trial complete · press E to read again')
        : isTouch ? '✦ Tap here to begin the trial' : '✦ Click the rune stone or press E to begin');
    } else {
      hud.prompt(nearest ? (nearest.visited ? 'Open this memory again ♡' : isTouch ? '✨ Tap here to open this memory' : '✨ Click the photo or press E') : null);
    }
    const zone = path.zoneAt(player.state.u);
    hud.setMonth(ZONES[zone].label);
    if (zone !== lastZone) {
      lastZone = zone;
      const t = trials.byZone(zone);
      if (t && t.state === 'idle' && !announced.has(t.def.id)) {
        announced.add(t.def.id);
        hud.toast(`✦ A little trial waits in ${ZONES[zone].name}. Find the glowing rune stone`, 3600);
      }
    }
    hud.setProgress(player.state.u);
  }

  if (state === 'ending') {
    const events = ending.update(dt, camera, player);
    if (events.includes('card')) {
      screens.showEnding({
        onWish() { ending.wish(); audio.puff(); setTimeout(() => audio.celebrate(), 250); },
        onReplay: replay,
      });
    }
  } else if (ending.active) ending.update(dt, camera, player);

  world.update(dt);
  props.update(dt, renderer);
  ambient.update(dt, player.state.u, player.position, renderer);
  player.character.trail.material.uniforms.uPixelRatio.value = renderer.getPixelRatio();
  renderer.render(scene, camera);
  sceneCtx.adapt(dt);
}

// Warm up shaders while the photos finish loading, then show the title screen
renderer.compile(scene, camera);
raf = requestAnimationFrame(frame);
await Promise.race([texturesDone, new Promise((r) => setTimeout(r, 15000))]);
screens.setProgress(1);
state = 'title';
screens.showTitle(() => {
  audio.unlock();
  follow.snap(player.position, player.state.facing);
  hud.show(true);
  hud.setMonth(ZONES[0].label);
  state = 'play';
  controls.setEnabled(true);
  if (foundCount()) hud.toast(`Welcome back ♡ ${foundCount()} of ${MEMORIES.length} memories found`);
});

// Dev-only helpers for testing in the console (stripped from production builds)
if (import.meta.env.DEV) {
  window.__game = {
    teleport(u) {
      const f = path.frameAt(u);
      player.position.copy(f.pos); player.state.hint = -1; player.state.facing = Math.atan2(f.tan.x, f.tan.z);
      follow.snap(player.position, player.state.facing);
    },
    visitAll() { markers.items.forEach((it) => { markers.setVisited(it, true); visitedIds.add(it.mem.id); }); save(); hud.setFound(foundCount()); world.setGateOpen(true); },
    get state() { return { state, u: player.state.u }; },
    trials,
    stoneU: (i) => path.uOfZone(trials.items[i].def.zone, 0.12),
    // run n frames by hand (handy when the tab is in the background)
    step(n = 1, dt = 1 / 60) { for (let i = 0; i < n; i++) { cancelAnimationFrame(raf); const now = performance.now(); last = now - dt * 1000; frame(now); } },
    player, camera, idle, markers,
  };
}

/* ---------- Cleanup ---------- */
function dispose() {
  cancelAnimationFrame(raf);
  controls.dispose();
  audio.dispose();
  disposeObject(scene);
  sceneCtx.dispose();
}
window.addEventListener('pagehide', (e) => { if (!e.persisted) dispose(); });
if (import.meta.hot) import.meta.hot.dispose(dispose);
