import * as THREE from 'three';
import { glowTexture } from '../utils.js';

// A small pool of sparkles that pop outward and fade (used when something is collected).
export function createBurst(size = 220) {
  const pos = new Float32Array(size * 3).fill(-999);
  const vel = new Float32Array(size * 3);
  const life = new Float32Array(size);
  const col = new Float32Array(size * 3).fill(1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uMap: { value: glowTexture() }, uPixelRatio: { value: 1 } },
    vertexShader: /* glsl */`
      attribute float aLife; attribute vec3 aColor;
      uniform float uPixelRatio;
      varying float vLife; varying vec3 vColor;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = 0.4 * uPixelRatio * (320.0 / max(-mv.z, 0.1)) * (0.3 + aLife);
        vLife = aLife; vColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      varying float vLife; varying vec3 vColor;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * min(1.0, vLife * 1.5);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
        #include <colorspace_fragment>
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  let cursor = 0;
  const c = new THREE.Color();

  return {
    points,
    emit(at, n = 18, colors = ['#fff0a6', '#ffd1e3', '#ffffff']) {
      for (let k = 0; k < n; k++) {
        const i = cursor; cursor = (cursor + 1) % size;
        pos[i * 3] = at.x; pos[i * 3 + 1] = at.y; pos[i * 3 + 2] = at.z;
        const a = Math.random() * Math.PI * 2, up = Math.random() * 2 - 0.4, s = 1.5 + Math.random() * 2.5;
        vel[i * 3] = Math.cos(a) * s; vel[i * 3 + 1] = up * 2.2 + 1; vel[i * 3 + 2] = Math.sin(a) * s;
        life[i] = 0.8 + Math.random() * 0.5;
        c.set(colors[k % colors.length]).toArray(col, i * 3);
      }
      geo.attributes.aColor.needsUpdate = true;
    },
    update(dt, renderer) {
      for (let i = 0; i < size; i++) {
        if (life[i] <= 0) continue;
        life[i] = Math.max(0, life[i] - dt);
        vel[i * 3] *= 1 - 2.5 * dt; vel[i * 3 + 1] = vel[i * 3 + 1] * (1 - 2.5 * dt) - 2 * dt; vel[i * 3 + 2] *= 1 - 2.5 * dt;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.aLife.needsUpdate = true;
      if (renderer?.getPixelRatio) mat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
    },
  };
}
