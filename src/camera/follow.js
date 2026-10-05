import * as THREE from 'three';
import { clamp, damp, dampAngle, isTouch } from '../utils.js';

// Third-person camera that trails behind the character and looks down the path.
// Drag to look around; it drifts back behind her once you start walking again.
export function createFollowCamera(camera, path) {
  const target = new THREE.Vector3();
  const look = new THREE.Vector3();
  const desired = new THREE.Vector3();
  const baseDist = isTouch ? 6.8 : 6.2;
  const state = { yaw: Math.PI, offset: 0, pitch: 0.36, dist: baseDist, distTarget: baseDist, idle: 0, cinematic: false, u: 0 };

  function pathYaw(u) {
    const f = path.frameAt(Math.min(1, u + 0.008));
    return Math.atan2(f.tan.x, f.tan.z);
  }

  function place(playerPos, k, dt) {
    const cp = Math.cos(state.pitch);
    desired.set(
      playerPos.x - Math.sin(state.yaw) * state.dist * cp,
      playerPos.y + 1.1 + Math.sin(state.pitch) * state.dist,
      playerPos.z - Math.cos(state.yaw) * state.dist * cp,
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
    // Direction the controls use. While an idle shot has the camera in front of her, forward still means 'along the path'.
    get yaw() { return state.cinematic ? pathYaw(state.u) : state.yaw; },
    // Swing the camera around her (yaw offset from behind, in radians) and/or move it closer — used by idle animations.
    // Walking again eases it back behind her.
    frame(offset, dist = baseDist) { state.offset = offset; state.distTarget = dist; state.idle = 0; state.cinematic = true; },
    snap(playerPos, u) {
      state.offset = 0; state.pitch = 0.36; state.dist = state.distTarget = baseDist; state.cinematic = false; state.u = u;
      state.yaw = pathYaw(u);
      place(playerPos, Infinity, 0);
    },
    update(dt, playerPos, u, lookInput, moving) {
      state.u = u;
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
      const goal = pathYaw(u) + state.offset;
      state.yaw = dampAngle(state.yaw, goal, lookInput.active ? 20 : 3, dt);
      if (state.cinematic && Math.abs(state.offset) < 0.3 && Math.abs(Math.atan2(Math.sin(goal - state.yaw), Math.cos(goal - state.yaw))) < 0.3) state.cinematic = false;
      place(playerPos, 6, dt);
    },
    lookTarget: look,
  };
}
