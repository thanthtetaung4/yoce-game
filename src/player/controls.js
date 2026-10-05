// Keyboard, mouse and touch input.
// - WASD / arrows to walk (hold Shift to hurry), E / Enter / Space to open a nearby memory
// - Mouse: drag to look around, click to open memories
// - Touch: a floating joystick on the left half (push it to the edge to hurry), drag on the right half to look, tap memories
export function createControls(canvas, { onTap, onHover, onInteract }) {
  const keys = new Set();
  const look = { dx: 0, dy: 0, active: false };
  const stick = { x: 0, y: 0, id: null, ox: 0, oy: 0, mag: 0 };
  const drags = new Map();
  let enabled = false;

  const joy = document.getElementById('joystick');
  const knob = joy.querySelector('.joystick__knob');
  const RADIUS = 52;

  const KEYMAP = {
    KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
    KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
    ShiftLeft: 'fast', ShiftRight: 'fast',
  };

  function onKeyDown(e) {
    if (!enabled || e.target.closest?.('input, textarea')) return;
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
    if ((e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      if (e.target === document.body || e.target === canvas) { e.preventDefault(); onInteract(); }
    }
  }
  const onKeyUp = (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); };
  const onBlur = () => { keys.clear(); releaseStick(); drags.clear(); };

  function releaseStick() {
    stick.id = null; stick.x = stick.y = stick.mag = 0;
    joy.classList.remove('is-active');
    knob.style.transform = '';
  }

  function onPointerDown(e) {
    if (!enabled) return;
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.5 && stick.id === null) {
      stick.id = e.pointerId; stick.ox = e.clientX; stick.oy = e.clientY;
      joy.style.left = `${e.clientX}px`; joy.style.top = `${e.clientY}px`;
      joy.classList.add('is-active');
      return;
    }
    drags.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: 0 });
  }

  function onPointerMove(e) {
    if (e.pointerId === stick.id) {
      let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
      const len = Math.hypot(dx, dy);
      if (len > RADIUS) { dx *= RADIUS / len; dy *= RADIUS / len; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = 0.12, mag = Math.min(1, len / RADIUS);
      const k = mag < dead ? 0 : (mag - dead) / (1 - dead) / Math.max(mag, 1e-3);
      stick.x = (dx / RADIUS) * k; stick.y = (-dy / RADIUS) * k;
      stick.mag = mag;
      return;
    }
    const d = drags.get(e.pointerId);
    if (d) {
      look.dx += e.clientX - d.x; look.dy += e.clientY - d.y;
      d.moved += Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y);
      d.x = e.clientX; d.y = e.clientY;
      if (d.moved > 6) look.active = true;
    } else if (e.pointerType === 'mouse' && enabled) {
      onHover(e.clientX, e.clientY);
    }
  }

  function onPointerUp(e) {
    if (e.pointerId === stick.id) { releaseStick(); return; }
    const d = drags.get(e.pointerId);
    drags.delete(e.pointerId);
    if (!drags.size) look.active = false;
    if (d && enabled && d.moved < 10 && performance.now() - d.t < 450) onTap(e.clientX, e.clientY);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    // Movement as { x: right, y: forward, fast }, length ≤ 1
    move() {
      let x = stick.x, y = stick.y;
      if (keys.has('f')) y += 1;
      if (keys.has('b')) y -= 1;
      if (keys.has('r')) x += 1;
      if (keys.has('l')) x -= 1;
      const len = Math.hypot(x, y);
      const fast = keys.has('fast') || stick.mag > 0.97;
      return len > 1 ? { x: x / len, y: y / len, fast } : { x, y, fast };
    },
    // Accumulated look drag since the last call
    takeLook() {
      const out = { dx: look.dx, dy: look.dy, active: look.active };
      look.dx = look.dy = 0;
      return out;
    },
    setEnabled(v) {
      enabled = v;
      if (!v) onBlur();
      joy.hidden = !v;
    },
    dispose() {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    },
  };
}
