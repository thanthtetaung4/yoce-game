import * as THREE from 'three';
import { glowTexture } from '../utils.js';

// Soft round sprites (sparkles, lantern glows, falling petals/snow) in a single draw call.
export function createPointsMaterial({ size = 0.3, color = '#ffffff', twinkle = 0, opacity = 1, fadeNear = 45, fadeFar = 95, float = 0 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uMap: { value: glowTexture() },
      uTime: { value: 0 },
      uSize: { value: size },
      uColor: { value: new THREE.Color(color) },
      uTwinkle: { value: twinkle },
      uFloat: { value: float }, // gentle drifting, like wisps
      uOpacity: { value: opacity },
      uPixelRatio: { value: 1 },
      uFade: { value: new THREE.Vector2(fadeNear, fadeFar) },
    },
    vertexShader: /* glsl */`
      attribute float aPhase;
      attribute vec3 aColor;
      uniform float uTime, uSize, uTwinkle, uPixelRatio, uFloat;
      uniform vec2 uFade;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec3 p = position;
        p.y += sin(uTime * 0.7 + aPhase * 6.2831) * uFloat;
        p.x += cos(uTime * 0.45 + aPhase * 12.0) * uFloat * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float tw = mix(1.0, 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 2.4 + aPhase * 6.2831)), uTwinkle);
        gl_PointSize = uSize * uPixelRatio * (320.0 / max(-mv.z, 0.1)) * (0.65 + 0.35 * tw);
        vAlpha = tw * (1.0 - smoothstep(uFade.x, uFade.y, -mv.z));
        vColor = aColor;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D uMap;
      uniform vec3 uColor;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float a = texture2D(uMap, gl_PointCoord).a * vAlpha * uOpacity;
        if (a < 0.01) discard;
        gl_FragColor = vec4(uColor * vColor, a);
        #include <colorspace_fragment>
      }`,
  });
}

// Builds a Points object from positions (+ optional colours) with random twinkle phases
export function createPoints(positions, colors, material) {
  const n = positions.length / 3;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const phase = new Float32Array(n);
  for (let i = 0; i < n; i++) phase[i] = Math.random();
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
  const col = colors || new Float32Array(n * 3).fill(1);
  geo.setAttribute('aColor', new THREE.BufferAttribute(col instanceof Float32Array ? col : new Float32Array(col), 3));
  const pts = new THREE.Points(geo, material);
  pts.frustumCulled = false;
  return pts;
}
