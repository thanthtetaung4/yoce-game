import * as THREE from 'three';
import { clamp, damp, dampAngle, isTouch } from '../utils.js';

// Third-person camera that trails behind the character, turning to wherever she faces.
// Drag to look around; it drifts back behind her once you start walking again.
// When a hedge would hide her (round a corner of the maze), it rises up and peeks over the top.
export function createFollowCamera(camera, path) {
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const baseDist = isTouch ? 6.8 : 6.2;
  const basePitch = 0.44;
  const maze = path.maze;
  const state = { yaw: Math.PI, offset: 0, pitch: basePitch, dist: baseDist, distTarget: baseDist, idle: 0, cinematic: false, facing: Math.PI, lift: 0 };

  // would a hedge sit between her and a camera at this yaw/pitch/distance?
  function hidden(p, yaw, pitch, dist) {
    const cp = Math.cos(pitch), top = maze.hedgeHeight + 0.7;
    for (let t = 0.2; t <= 1.001; t += 0.1) {
      const y = 1.15 + (Math.sin(pitch) * dist - 0.05) * t;
      if (y > top) break;
      if (!maze.walkable(p.x - Math.sin(yaw) * dist * cp * t, p.z - Math.cos(yaw) * dist * cp * t, 0.3)) return true;
    }
    return false;
  }

  function place(playerPos, k, dt) {
    const blocked = hidden(playerPos, state.yaw, state.pitch, state.dist);
    state.lift = k === Infinity ? +blocked : damp(state.lift, +blocked, blocked ? 5 : 1.2, dt);
    const pitch = state.pitch + (Math.max(state.pitch, 1.0) - state.pitch) * state.lift;
    const dist = state.dist * (1 - 0.18 * state.lift);
    const cp = Math.cos(pitch);
    desired.set(
      playerPos.x - Math.sin(state.yaw) * dist * cp,
      playerPos.y + 1.1 + Math.sin(pitch) * dist,
      playerPos.z - Math.cos(state.yaw) * dist * cp,
    );
    target.set(playerPos.x + Math.sin(state.yaw) * 1.6, playerPos.y + 1.15, playerPos.z + Math.cos(state.yaw) * 1.6);
    if (k === Infinity) { camera.position.copy(desired); look.copy(target); }
    else {
      camera.position.x = damp(camera.position.x, desired.x, k, dt);
      camera.position.y = damp(camera.position.y, desired.y, k, dt);
      camera.position.z = damp(camera.position.z, desired.z, k, dt);
      look.lerp(target, 1 - Math.exp(-k * 1.4 * dt));
    }
    camera.lookAt(look);
  }

  return {
    // Direction the controls use. While an idle shot has the camera in front of her, forward still means 'the way she faces'.
    get yaw() { return state.cinematic ? state.facing : state.yaw; },
    // Swing the camera around her (yaw offset from behind her, in radians) and/or move it closer — used by idle animations.
    // Walking again eases it back behind her.
    frame(offset, dist = baseDist) { state.offset = offset; state.distTarget = dist; state.idle = 0; state.cinematic = true; },
    snap(playerPos, facing) {
      state.offset = 0; state.pitch = basePitch; state.dist = state.distTarget = baseDist; state.cinematic = false; state.facing = facing;
      state.yaw = facing;
      place(playerPos, Infinity, 0);
    },
    update(dt, playerPos, facing, lookInput, moving) {
      state.facing = facing;
      if (lookInput.dx || lookInput.dy) {
        state.cinematic = false; // she took the camera
        state.offset -= lookInput.dx * 0.006;
        state.pitch = clamp(state.pitch + lookInput.dy * 0.004, 0.12, 0.85);
      }
      // ease back behind her a moment after you stop dragging and start walking
      state.idle = lookInput.active ? 0 : state.idle + dt;
      if (moving && state.idle > 1.2) state.offset = damp(state.offset, 0, 1.4, dt);
      if (moving) state.distTarget = baseDist;
      state.dist = damp(state.dist, state.distTarget, 2.5, dt);
      const goal = facing + state.offset;
      // while she walks back toward the camera, hold still (chasing her would just spin her in circles)
      const toward = Math.abs(Math.atan2(Math.sin(facing - state.yaw), Math.cos(facing - state.yaw))) > 2.0;
      state.yaw = dampAngle(state.yaw, goal, lookInput.active ? 20 : toward && moving ? 0 : 3, dt);
      if (state.cinematic && Math.abs(state.offset) < 0.3 && Math.abs(Math.atan2(Math.sin(goal - state.yaw), Math.cos(goal - state.yaw))) < 0.3) state.cinematic = false;
      place(playerPos, 6, dt);
    },
    lookTarget: look,
  };
}
