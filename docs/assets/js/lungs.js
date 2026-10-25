// Hero visual: the app's lungs as a breathing particle cloud (three.js).
// Tint, tar specks and breathing follow design.md §3.4, §7 and §10.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js';

// Lung palette, one stop per 20 points of load (design.md §3.4).
const STOPS = ['#F2958A', '#DE8C7E', '#C48678', '#9E7B70', '#7A6A64', '#554A46'].map((c) => new THREE.Color(c));
const TAR = new THREE.Color('#3E3532');
const TRACHEA = new THREE.Color('#E9D9D2');
const GLOW = new THREE.Color('#FFE3D6');
const DUST = new THREE.Color('#98A3A9');

const KIND = { lobe: 0, airway: 1, trachea: 2, dust: 3 };
const PIVOT_Y = 0.45; // trachea base: lobes and airways scale from here

function lungColor(load, out) {
  const t = Math.min(Math.max(load, 0), 100) / 20;
  const i = Math.min(4, Math.floor(t));
  return out.copy(STOPS[i]).lerp(STOPS[i + 1], t - i);
}

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Distance-like value inside a lobe (0 centre → 1 surface), or -1 outside.
// side -1 = viewer's left (the right lung, a little larger), +1 = viewer's right.
function inLobe(x, y, z, side) {
  const cx = side * 0.5;
  const cy = -0.14;
  const h = side < 0 ? 0.94 : 0.9;
  const ny = (y - cy) / h;
  if (ny <= -1 || ny >= 1) return -1;
  // Rounded apex, wide flat base.
  const profile = ny > 0 ? Math.sqrt(1 - ny * ny) : Math.sqrt(1 - Math.pow(-ny, 4));
  const dx = (x - cx) * side; // + lateral, − medial
  const ax = (dx > 0 ? 0.42 : 0.27) * (side < 0 ? 1.06 : 1);
  const r = Math.hypot(dx / (ax * profile), z / (0.34 * profile));
  if (side > 0) {
    // Cardiac notch on the lower inner edge.
    const nx = (x - 0.2) / 0.2;
    const nny = (y + 0.5) / 0.3;
    if (nx * nx + nny * nny < 1) return -1;
  }
  return r <= 1 ? r : -1;
}

function buildGeometry() {
  const rand = rng(44);
  const pos = [];
  const kind = [];
  const seed = [];
  const size = [];
  const push = (x, y, z, k, s) => {
    pos.push(x, y, z);
    kind.push(k);
    seed.push(rand());
    size.push(s);
  };

  // Lobes: weighted towards the surface so the shape reads.
  for (const side of [-1, 1]) {
    let n = 0;
    while (n < 3600) {
      const x = side * 0.5 + (rand() - 0.5) * 1.0;
      const y = -0.14 + (rand() - 0.5) * 1.9;
      const z = (rand() - 0.5) * 0.72;
      const r = inLobe(x, y, z, side);
      if (r < 0) continue;
      if (r < 0.8 && rand() > 0.22) continue;
      push(x, y, z, KIND.lobe, 1.2 + rand() * 1.3);
      n++;
    }
  }

  // A tube of points from a to b.
  const tube = (a, b, radius, density, k, s) => {
    const len = a.distanceTo(b);
    const steps = Math.max(2, Math.round(len * density));
    const dir = b.clone().sub(a).normalize();
    const ortho1 = new THREE.Vector3(0, 0, 1).cross(dir).normalize();
    if (ortho1.lengthSq() < 0.01) ortho1.set(1, 0, 0);
    const ortho2 = dir.clone().cross(ortho1).normalize();
    // Scattered along the length, not on a grid, so tubes don't look like ladders.
    const around = Math.max(3, Math.round(radius * 90));
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j < around; j++) {
        const p = a.clone().lerp(b, Math.min(1, (i + rand()) / steps));
        const t = rand() * Math.PI * 2;
        const q = p.clone()
          .addScaledVector(ortho1, Math.cos(t) * radius)
          .addScaledVector(ortho2, Math.sin(t) * radius);
        push(q.x, q.y, q.z, k, s);
      }
    }
  };

  // Trachea (does not breathe), with faint cartilage rings.
  const top = new THREE.Vector3(0, 1.08, 0);
  const base = new THREE.Vector3(0, PIVOT_Y, 0);
  tube(top, base, 0.065, 70, KIND.trachea, 1.7);
  for (let i = 1; i <= 5; i++) {
    const y = PIVOT_Y + (i / 6) * (1.08 - PIVOT_Y);
    for (let j = 0; j < 14; j++) {
      const t = (j / 14) * Math.PI * 2 + rand() * 0.2;
      push(Math.cos(t) * 0.072, y, Math.sin(t) * 0.072, KIND.trachea, 1.6);
    }
  }

  // Bronchial tree: 2 main bronchi, then 4 levels of branches inside each lobe.
  const branch = (start, dir, len, radius, depth, side) => {
    let end = start.clone().addScaledVector(dir, len);
    for (let tries = 0; tries < 4 && inLobe(end.x, end.y, end.z, side) < 0; tries++) {
      len *= 0.7;
      end = start.clone().addScaledVector(dir, len);
    }
    tube(start, end, radius, 60, KIND.airway, 1.5 + radius * 14);
    if (depth >= 4) return;
    for (const turn of [-1, 1]) {
      const angle = turn * (0.38 + rand() * 0.3);
      const child = dir.clone()
        .applyAxisAngle(new THREE.Vector3(0, 0, 1), angle)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), (rand() - 0.5) * 0.9)
        .normalize();
      branch(end, child, len * 0.74, radius * 0.7, depth + 1, side);
    }
  };
  for (const side of [-1, 1]) {
    const hilum = new THREE.Vector3(side * 0.3, 0.2, 0);
    tube(base, hilum, 0.045, 60, KIND.airway, 2.2);
    branch(hilum, new THREE.Vector3(side * 0.35, -1, 0).normalize(), 0.34, 0.032, 1, side);
    branch(hilum, new THREE.Vector3(side * 0.9, 0.45, 0).normalize(), 0.24, 0.026, 2, side);
  }

  // Slow dust in the air around, for depth.
  for (let i = 0; i < 260; i++) {
    push((rand() - 0.5) * 6, (rand() - 0.5) * 4, (rand() - 0.5) * 3 - 0.6, KIND.dust, 0.8 + rand() * 1.4);
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(kind, 1));
  g.setAttribute('aRand', new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute('aSize', new THREE.Float32BufferAttribute(size, 1));
  return g;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uBreath;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMotion;
  attribute float aKind;
  attribute float aRand;
  attribute float aSize;
  varying float vKind;
  varying float vRand;
  varying float vY;
  varying float vZ;

  void main() {
    vec3 p = position;
    if (aKind < 1.5) {
      vec3 pivot = vec3(0.0, ${PIVOT_Y.toFixed(2)}, 0.0);
      p = pivot + (p - pivot) * (1.0 + uBreath);
      p += uMotion * 0.004 * vec3(sin(uTime * 0.9 + aRand * 40.0), cos(uTime * 0.8 + aRand * 31.0), 0.0);
    } else if (aKind > 2.5) {
      p.y = mod(p.y + 2.0 + uMotion * uTime * (0.02 + aRand * 0.04), 4.0) - 2.0;
    }
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * aSize * uPixelRatio / -mv.z;
    vKind = aKind;
    vRand = aRand;
    vY = position.y;
    vZ = p.z;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uFill;
  uniform vec3 uDeep;
  uniform vec3 uTrachea;
  uniform vec3 uTar;
  uniform vec3 uGlow;
  uniform vec3 uDust;
  uniform float uLoad;
  varying float vKind;
  varying float vRand;
  varying float vY;
  varying float vZ;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = pow(smoothstep(0.5, 0.0, d), 1.6);
    vec3 col;
    float alpha;
    if (vKind < 0.5) {
      // Lobe: top a little lighter, a rim of air glow up high, front points brighter.
      col = uFill * (0.92 + 0.16 * smoothstep(-1.0, 0.7, vY));
      col = mix(col, uGlow, 0.4 * smoothstep(0.35, 0.72, vY));
      col *= 0.8 + 0.35 * smoothstep(-0.4, 0.4, vZ);
      alpha = 0.5;
      // Tar specks: more of them as the load goes up. Dark specks add almost no
      // light (additive blending), so they read as the lung losing its glow.
      if (vRand < uLoad * 0.0024) { col = uTar; alpha = 0.3; }
    } else if (vKind < 1.5) {
      // Lighter than the fill so the airway tree reads on a dark ground.
      col = mix(uDeep, uGlow, 0.35);
      alpha = 0.85;
    } else if (vKind < 2.5) {
      col = uTrachea;
      alpha = 0.55;
    } else {
      col = uDust;
      alpha = 0.18;
    }
    gl_FragColor = vec4(col, alpha * soft);
  }
`;

export function createLungScene(canvas, { reduceMotion = false, load = 42 } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'low-power' });
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0, 6);

  const uniforms = {
    uTime: { value: 0 },
    uBreath: { value: 0 },
    uSize: { value: 17 },
    uPixelRatio: { value: pixelRatio },
    uMotion: { value: reduceMotion ? 0 : 1 },
    uLoad: { value: load },
    uFill: { value: lungColor(load, new THREE.Color()) },
    uDeep: { value: new THREE.Color() },
    uTrachea: { value: TRACHEA },
    uTar: { value: TAR },
    uGlow: { value: GLOW },
    uDust: { value: DUST },
  };
  uniforms.uDeep.value.copy(uniforms.uFill.value).multiplyScalar(0.78);

  const geometry = buildGeometry();
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lungs = new THREE.Points(geometry, material);
  lungs.position.y = 0.05;
  scene.add(lungs);

  let width = 0;
  let height = 0;
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h || (w === width && h === height)) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Keep the whole lung in view on narrow screens.
    const aspect = w / h;
    camera.position.z = aspect < 0.8 ? 5.2 / Math.max(aspect / 0.8, 0.62) : 5.2;
    // On wide layouts the calculator card overlaps the bottom, so sit higher.
    lungs.position.y = aspect > 1 ? 0.2 : 0.05;
    camera.updateProjectionMatrix();
    if (!running) render(0);
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Pointer tilt, eased. Touch is left alone so the page still scrolls.
  const target = { x: 0, y: 0 };
  const onPointer = (e) => {
    if (e.pointerType === 'touch') return;
    target.y = (e.clientX / window.innerWidth - 0.5) * 0.7;
    target.x = (e.clientY / window.innerHeight - 0.5) * 0.25;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  let targetLoad = load;
  let currentLoad = load;
  const fill = new THREE.Color();

  function render(dt) {
    // Colour tween towards the new load (about 1.2 s, design.md §7).
    currentLoad += (targetLoad - currentLoad) * (reduceMotion ? 1 : 1 - Math.exp(-dt / 0.35));
    uniforms.uLoad.value = currentLoad;
    uniforms.uFill.value.copy(lungColor(currentLoad, fill));
    uniforms.uDeep.value.copy(uniforms.uFill.value).multiplyScalar(0.78);

    if (!reduceMotion) {
      const t = uniforms.uTime.value;
      // 8 s breath: 4 s in, 4 s out, scale 1 → 1.035.
      uniforms.uBreath.value = 0.035 * (0.5 - 0.5 * Math.cos((t / 8) * Math.PI * 2));
      const idle = Math.sin(t * 0.18) * 0.22;
      lungs.rotation.y += (target.y + idle - lungs.rotation.y) * Math.min(1, dt * 2.5);
      lungs.rotation.x += (target.x - lungs.rotation.x) * Math.min(1, dt * 2.5);
    }
    renderer.render(scene, camera);
  }

  // Only animate while the hero is on screen and the tab is visible.
  let running = false;
  let visible = true;
  let last = 0;
  let frame = 0;
  const loop = (now) => {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    uniforms.uTime.value += dt;
    render(dt);
    frame = requestAnimationFrame(loop);
  };
  const update = () => {
    const shouldRun = !reduceMotion && visible && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(frame);
    }
  };
  const io = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    update();
  });
  io.observe(canvas);
  document.addEventListener('visibilitychange', update);

  resize();
  render(0);
  update();

  return {
    setLoad(value) {
      targetLoad = value;
      if (!running) render(1);
    },
    dispose() {
      cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', update);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    },
  };
}
