import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { dampAngle } from '../utils.js';
import { createCharacter } from './character.js';

// Moves the character relative to the camera and keeps her inside the maze's corridors.
export function createPlayer(path) {
  const character = createCharacter();
  const pos = new THREE.Vector3();
  const move = new THREE.Vector3();
  const _v = new THREE.Vector3();
  const state = { u: 0, hint: -1, facing: Math.PI, speed01: 0, run: 0, blocked: false, near: null };

  function reset() {
    const f = path.frameAt(0.004);
    pos.copy(f.pos);
    state.facing = Math.atan2(f.tan.x, f.tan.z);
    state.hint = -1;
    state.u = 0.004;
    character.object.position.copy(pos);
    character.object.rotation.y = state.facing;
  }
  reset();

  function update(dt, input, camYaw, { gateLocked }) {
    // camera-relative movement: forward is where the camera looks
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    move.set(fx * input.y - fz * input.x, 0, fz * input.y + fx * input.x);
    const mag = Math.min(1, Math.hypot(input.x, input.y));
    const run = input.fast && mag > 0.1 ? 1 : 0;
    state.run += (run - state.run) * Math.min(1, dt * 8); // ease into and out of the faster pace
    pos.addScaledVector(move, CONFIG.walkSpeed * (1 + (CONFIG.fastMultiplier - 1) * state.run) * dt);

    // the hedges: slide along them instead of walking through
    path.maze.keepInside(pos);
    let n = path.nearest(pos, state.hint);

    // the birthday gate stays closed until every memory is found
    state.blocked = false;
    if (gateLocked && Math.abs(n.u - path.gateU) * path.total < 12) {
      const g = path.frameAt(path.gateU - 0.004);
      const over = _v.subVectors(pos, g.pos).dot(g.tan);
      if (over > 0) { pos.addScaledVector(g.tan, -over); state.blocked = mag > 0.1; }
    }

    path.maze.keepInside(pos);
    n = path.nearest(pos, n.index);
    state.hint = n.index;
    state.u = n.u;
    pos.y = 0;

    if (mag > 0.05) state.facing = dampAngle(state.facing, Math.atan2(move.x, move.z), 12, dt);
    state.speed01 = mag;
    character.object.position.copy(pos);
    character.object.rotation.y = state.facing;
    character.update(dt, mag, state.run);
  }

  return { character, object: character.object, position: pos, state, update, reset };
}
