import * as THREE from 'three';
import { createPointsMaterial, createPoints } from './points.js';
import { blendZoneColor, styleOf } from './zones.js';
import { isTouch, damp, reduceMotion } from '../utils.js';

// Seasonal particles around the player (leaves → snow → petals → fireflies), plus sky/fog tinting per month.
export function createAmbient(sceneCtx) {
  const N = isTouch ? 110 : 200, BOX = 22, H = 12;
  const pos = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * BOX * 2;
    pos[i * 3 + 1] = Math.random() * H;
    pos[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2;
    seed[i] = Math.random();
  }
  const mat = createPointsMaterial({ size: 0.3, color: '#ffffff', fadeNear: 18, fadeFar: 30 });
  const points = createPoints(pos, null, mat);
  const attr = points.geometry.attributes.position;

  const params = { fall: 0.8, sway: 1, size: 0.3, twinkle: 0 };
  const tmp = new THREE.Color();
  let time = 0;

  return {
    object: points,
    update(dt, u, center, renderer) {
      time += dt;
      // Blend the season's look
      const zone = Math.min(12, Math.floor(u * 13));
      const p = styleOf(zone).particle;
      for (const k in params) params[k] = damp(params[k], p[k], 1.5, dt);
      tmp.set(p.color);
      mat.uniforms.uColor.value.lerp(tmp, 1 - Math.exp(-1.5 * dt));
      mat.uniforms.uSize.value = params.size;
      mat.uniforms.uTwinkle.value = params.twinkle;
      mat.uniforms.uTime.value = time;
      mat.uniforms.uPixelRatio.value = renderer.getPixelRatio();

      const speed = reduceMotion ? 0.4 : 1;
      for (let i = 0; i < N; i++) {
        const j = i * 3, sd = seed[i];
        let x = pos[j], y = pos[j + 1], z = pos[j + 2];
        y -= params.fall * (0.5 + sd) * dt * speed;
        x += Math.sin(time * (0.6 + sd) + sd * 20) * params.sway * 0.6 * dt * speed;
        z += Math.cos(time * (0.5 + sd) + sd * 12) * params.sway * 0.3 * dt * speed;
        if (y < 0) y += H; else if (y > H) y -= H;
        pos[j] = x; pos[j + 1] = y; pos[j + 2] = z;
      }
      // Recentre: shift the box to the player and wrap particles that fall outside it
      const ox = center.x - points.position.x, oz = center.z - points.position.z;
      if (ox || oz) {
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          pos[j] -= ox; pos[j + 2] -= oz;
          if (pos[j] < -BOX) pos[j] += BOX * 2; else if (pos[j] > BOX) pos[j] -= BOX * 2;
          if (pos[j + 2] < -BOX) pos[j + 2] += BOX * 2; else if (pos[j + 2] > BOX) pos[j + 2] -= BOX * 2;
        }
        points.position.set(center.x, 0, center.z);
      }
      attr.needsUpdate = true;

      // Sky + fog follow the month
      const { skyUniforms, scene } = sceneCtx;
      const k = 1 - Math.exp(-1.2 * dt);
      skyUniforms.top.value.lerp(blendZoneColor(u, 'skyTop', tmp), k);
      skyUniforms.mid.value.lerp(blendZoneColor(u, 'skyMid', tmp), k);
      skyUniforms.bottom.value.lerp(blendZoneColor(u, 'ground', tmp), k);
      scene.fog.color.lerp(blendZoneColor(u, 'fog', tmp), k);
    },
  };
}
