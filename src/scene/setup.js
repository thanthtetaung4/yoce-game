import * as THREE from 'three';
import { isTouch } from '../utils.js';

// Renderer, camera, lights, fog and the pastel gradient sky.
export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isTouch,
    powerPreference: 'high-performance',
    alpha: false,
  });
  const maxDpr = isTouch ? 1.5 : 2;
  let dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; // keeps pastels true (ACES greys them out)
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const fogColor = new THREE.Color('#e9d3e2');
  scene.background = fogColor.clone();
  scene.fog = new THREE.Fog(fogColor, 18, 88); // closer fog = deeper, misty forest

  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 260);
  camera.position.set(0, 4, 8);

  const hemi = new THREE.HemisphereLight('#f8ecff', '#f0d6e4', 1.35);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe2f0', 1.25);
  sun.position.set(-20, 30, 12);
  scene.add(sun);

  // Gradient sky dome that follows the camera
  const skyUniforms = {
    top: { value: new THREE.Color('#bba6e4') },
    mid: { value: new THREE.Color('#f7cfd8') },
    bottom: { value: new THREE.Color('#fff2ea') },
  };
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 top; uniform vec3 mid; uniform vec3 bottom;
        varying vec3 vDir;
        void main() {
          float h = vDir.y;
          vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bottom, pow(-h, 0.5));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  scene.add(sky);

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Pull the camera's field of view wider on tall phone screens so the path still fits
    camera.fov = w / h < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  // Simple adaptive quality: drop the pixel ratio if frames are slow, nudge it back up when there's headroom.
  let acc = 0, frames = 0;
  function adapt(dt) {
    acc += dt; frames++;
    if (acc < 2) return;
    const fps = frames / acc;
    acc = 0; frames = 0;
    if (fps < 45 && dpr > 1) dpr = Math.max(1, dpr - 0.25);
    else if (fps > 58 && dpr < Math.min(window.devicePixelRatio || 1, maxDpr)) dpr = Math.min(maxDpr, dpr + 0.25);
    else return;
    renderer.setPixelRatio(dpr);
    resize();
  }

  return {
    renderer, scene, camera, sky, skyUniforms, fogColor, adapt,
    dispose() {
      window.removeEventListener('resize', resize);
      renderer.dispose();
    },
  };
}
