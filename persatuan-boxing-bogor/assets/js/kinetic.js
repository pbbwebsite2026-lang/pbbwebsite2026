/* ============================================================================
   PERSATUAN BOXING BOGOR — KINETIC DIGITAL ARTWORK
   assets/js/kinetic.js · v8
   ----------------------------------------------------------------------------
   Engine    Three.js r128 (global build) · GSAP 3.12.5 + ScrollTrigger
   Pipeline  RenderPass (scene) → Chromatic-Aberration Shockwave ShaderPass → screen
   Map       0 guards      1 config       2 utils        3 spring       4 audio
             5 GLSL        6 stage        7 typography   8 world        9 camera rail
             10 input      11 DOM bridge  12 router      13 frame loop  14 boot
   Fallback  Without WebGL / CDN / font, or with prefers-reduced-motion, this file
             exits early and the static CSS layout (style.css) stays in charge.
   ========================================================================== */
(function () {
  'use strict';

  /* ══ 0 · GUARDS ═══════════════════════════════════════════════════════════ */
  const T = window.THREE;
  const gsap = window.gsap;
  const root = document.documentElement;
  const host = document.getElementById('boxing-canvas-container');

  if (!T || !gsap || !host) return;

  const REQUIRED = ['WebGLRenderer', 'Scene', 'PerspectiveCamera', 'EffectComposer', 'RenderPass', 'ShaderPass', 'CopyShader', 'FontLoader', 'TextGeometry'];
  for (let i = 0; i < REQUIRED.length; i++) {
    if (!T[REQUIRED[i]]) {
      console.warn('[PBB kinetic] THREE.' + REQUIRED[i] + ' is unavailable; the static layout stays active.');
      return;
    }
  }
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.__PBB_KINETIC__) return;
  window.__PBB_KINETIC__ = true;

  if (window.ScrollTrigger) {
    try { gsap.registerPlugin(window.ScrollTrigger); } catch (err) { /* already registered by app.js */ }
  }

  /* ══ 1 · CONFIG ═══════════════════════════════════════════════════════════ */
  const CONFIG = {
    colors: { onyx: 0x0a0a0c, red: 0xff2a4b, cyan: 0x00f0ff, bone: 0xf1eee8 },
    fontUrl: 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/helvetiker_bold.typeface.json',
    contentUrl: '/data/content.json',
    fov: 40,
    hudDistance: 12,            /* camera-space depth of the pointer-reactive title plane       */
    camDistance: 16,            /* rail camera sits this far in front of every station anchor  */
    frameMs: 1000 / 60,         /* the 60 fps lock                                              */
    punch: { radius: 3.0, minVelocity: 1.2 },
    shock: { peak: 0.06, duration: 0.45 },
    audio: { startFreq: 160, endFreq: 35, duration: 0.25 },
    spring: { omega: 22, zeta: 0.15, duration: 1.7 },
    title: { lines: ['PERSATUAN', 'BOXING', 'BOGOR'], depth: 0.34, bevel: 0.04, condense: 0.8, tracking: 0.045, leading: 0.2, capHeight: 0.72 }
  };

  /* Station anchors: the camera rail glides through these in nav order. */
  const STATIONS = [
    { id: 'home',         navKey: 'nav_index',        label: '',        x:   0, y:  0, z:    0 },
    { id: 'about',        navKey: 'nav_about',        label: 'TENTANG', x:  16, y:  3, z:  -26 },
    { id: 'programs',     navKey: 'nav_programs',     label: 'PROGRAM', x: -14, y: -2, z:  -52 },
    { id: 'coaches',      navKey: 'nav_coaches',      label: 'PELATIH', x:  15, y:  4, z:  -78 },
    { id: 'schedule',     navKey: 'nav_schedule',     label: 'JADWAL',  x: -15, y:  0, z: -104 },
    { id: 'competitions', navKey: 'nav_competitions', label: 'EVENT',   x:  14, y: -3, z: -130 },
    { id: 'gallery',      navKey: 'nav_gallery',      label: 'GALERI',  x: -12, y:  3, z: -156 },
    { id: 'contact',      navKey: 'foot_contact',     label: 'KONTAK',  x:   0, y:  0, z: -182 },
    { id: 'notfound',     navKey: '',                 label: '404',     x:   0, y: -4, z: -208 }
  ];
  const LAST = STATIONS.length - 1;

  /* Quality tier: protects the 60 fps budget on weaker hardware. */
  const coarsePointer = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const tierName = (coarsePointer || cores <= 2 || memory <= 2) ? 'low' : (cores <= 4 || memory <= 4) ? 'mid' : 'high';
  const TIER = {
    low:  { maxDpr: 1.5,  tessEdge: 0.32, octaves: 3, dust: 320 },
    mid:  { maxDpr: 1.75, tessEdge: 0.22, octaves: 4, dust: 600 },
    high: { maxDpr: 2,    tessEdge: 0.15, octaves: 5, dust: 900 }
  }[tierName];

  /* ══ 2 · UTILS ════════════════════════════════════════════════════════════ */
  const clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  const lerp = function (a, b, t) { return a + (b - a) * t; };
  const noop = function () {};
  const nextFrame = function () { return new Promise(function (res) { requestAnimationFrame(function () { res(); }); }); };

  function stationIndex(id) {
    for (let i = 0; i < STATIONS.length; i++) if (STATIONS[i].id === id) return i;
    return -1;
  }

  /* '/programs.html' | URL | Barba url object → station id */
  function stationFromUrl(input) {
    let path = '';
    if (typeof input === 'string') path = input;
    else if (input && typeof input === 'object') path = input.path || input.pathname || input.href || '';
    path = String(path).split(/[?#]/)[0];
    const last = path.split('/').filter(Boolean).pop() || '';
    const base = last.replace(/\.html?$/i, '').toLowerCase();
    if (base === '' || base === 'index') return 'home';
    if (base === '404') return 'notfound';
    return stationIndex(base) >= 0 ? base : 'home';
  }

  /* ══ 3 · DAMPED HARMONIC SPRING ═══════════════════════════════════════════
     x(t) = e^(−ζωt) · [cos(ω_d·t) + (ζω/ω_d)·sin(ω_d·t)]     ω_d = ω·√(1−ζ²)
     x(0) = 1 (fully displaced), x′(0) = 0, x(∞) = 0 (origin grid).
     makeSpringEase() turns it into a GSAP ease function, so a tween from A to 0
     plays the vertices back to their origin like a boxing-ring rope rebounding. */
  function dampedSpring(t, omega, zeta) {
    const wd = omega * Math.sqrt(1 - zeta * zeta);
    return Math.exp(-zeta * omega * t) * (Math.cos(wd * t) + (zeta * omega / wd) * Math.sin(wd * t));
  }
  function makeSpringEase(omega, zeta, duration) {
    return function (p) {
      if (p <= 0) return 0;
      if (p >= 1) return 1;
      return 1 - dampedSpring(p * duration, omega, zeta);
    };
  }
  const titleSpringEase = makeSpringEase(CONFIG.spring.omega, CONFIG.spring.zeta, CONFIG.spring.duration);
  const propSpringEase = makeSpringEase(18, 0.14, 1.5);
  const shakeSpringEase = makeSpringEase(30, 0.12, 0.9);

  /* ══ 4 · PROCEDURAL AUDIO (Web Audio API — no sample files) ═══════════════ */
  let audioCtx = null;
  let masterGain = null;
  let soundOn = true;
  let lastSoundAt = 0;
  let liveVoices = 0;
  const GESTURES = ['pointerdown', 'pointerup', 'touchend', 'keydown', 'click'];

  function detachGestures() {
    for (let i = 0; i < GESTURES.length; i++) window.removeEventListener(GESTURES[i], unlockAudio, true);
  }

  /* Bound to the first user gesture (browsers keep audio suspended until then). */
  function unlockAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { detachGestures(); return; }
      try {
        audioCtx = new AC();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = 0.34;
        const comp = audioCtx.createDynamicsCompressor();
        masterGain.connect(comp);
        comp.connect(audioCtx.destination);
      } catch (err) {
        audioCtx = null;
        detachGestures();
        return;
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(function () { if (audioCtx.state === 'running') detachGestures(); }).catch(noop);
    } else if (audioCtx.state === 'running') {
      detachGestures();
    }
  }
  for (let g = 0; g < GESTURES.length; g++) window.addEventListener(GESTURES[g], unlockAudio, { capture: true, passive: true });

  /* Leather-bag thud: a sine whose pitch glides 160 Hz → 35 Hz while its gain
     falls 1.0 → 0.001 over the same window (default 0.25 s). */
  function playProceduralPunchSound(startFreq, duration, level) {
    if (!audioCtx || !masterGain || !soundOn || audioCtx.state !== 'running') return;
    const f0 = (typeof startFreq === 'number' && startFreq > CONFIG.audio.endFreq + 5) ? startFreq : CONFIG.audio.startFreq;
    const dur = (typeof duration === 'number' && duration > 0.05) ? duration : CONFIG.audio.duration;
    const peak = (typeof level === 'number' && level > 0.001) ? level : 1.0;
    const nowMs = performance.now();
    if (nowMs - lastSoundAt < 45 || liveVoices >= 6) return;
    lastSoundAt = nowMs;

    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f0, t0);
    osc.frequency.exponentialRampToValueAtTime(CONFIG.audio.endFreq, t0 + dur);
    env.gain.setValueAtTime(peak, t0);
    env.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(env);
    env.connect(masterGain);
    liveVoices++;
    osc.onended = function () {
      liveVoices = Math.max(0, liveVoices - 1);
      try { osc.disconnect(); env.disconnect(); } catch (err) { /* already disconnected */ }
    };
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  /* ══ 5 · GLSL ═════════════════════════════════════════════════════════════ */

  /* 5a · Title vertex shader — punch warp (u_mouse / u_velocity / u_time) plus
     the spring-driven return field (u_hit / u_hitDir). `position` is the
     immutable origin grid; every uniform returning to 0 restores it exactly. */
  const GLSL_TEXT_VERT = `
    uniform vec2  u_mouse;
    uniform float u_velocity;
    uniform float u_time;
    uniform vec2  u_accel;
    uniform vec4  u_hit[4];
    uniform vec3  u_hitDir[4];
    uniform float u_reveal;
    attribute vec3 a_letter;
    varying vec3  vNormal;
    varying vec3  vView;
    varying float vPush;
    varying float vSeed;

    const float PUNCH_RADIUS   = 3.0;
    const float PUNCH_VELOCITY = 1.2;

    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vec3 p  = mv.xyz;
      vec3 disp = vec3(0.0);

      /* live punch: algebraic distance vertex ↔ pointer */
      float dx = p.x - u_mouse.x;
      float dy = p.y - u_mouse.y;
      float dist = sqrt(dx * dx + dy * dy);
      if (dist < PUNCH_RADIUS && u_velocity > PUNCH_VELOCITY) {
        float fall = 1.0 - dist / PUNCH_RADIUS;
        fall = fall * fall * (3.0 - 2.0 * fall);
        float power = min(u_velocity - PUNCH_VELOCITY, 3.0);
        vec2 away = vec2(dx, dy);
        away = away / max(length(away), 0.0001);
        vec2 dir = mix(away, u_accel, 0.65);
        dir = dir / max(length(dir), 0.0001);
        disp.xy += dir * (fall * power * 0.6);
        disp.z  -= fall * power * 0.9;
      }

      /* damped-spring impacts (amplitude already multiplied by x(t) on the CPU) */
      for (int i = 0; i < 4; i++) {
        float r = max(u_hit[i].w, 0.0001);
        float d = distance(p.xy, u_hit[i].xy);
        float f = clamp(1.0 - d / r, 0.0, 1.0);
        f = f * f * (3.0 - 2.0 * f);
        disp += u_hitDir[i] * (u_hit[i].z * f);
      }

      /* idle breathing + letter-by-letter slam-in */
      disp.z += sin(u_time * 1.4 + p.x * 1.3 + p.y * 0.9) * 0.035;
      float rv = clamp(u_reveal * 1.7 - a_letter.x * 0.7, 0.0, 1.0);
      float ev = 1.0 - pow(1.0 - rv, 3.0);
      disp.z -= (1.0 - ev) * 10.0;
      disp.y += (1.0 - ev) * (a_letter.z - 0.5) * 2.0;

      p += disp;
      vPush = length(disp.xy) + abs(disp.z) * 0.5;
      vSeed = a_letter.z;
      vNormal = normalize(normalMatrix * normal);
      vView = -p;
      gl_Position = projectionMatrix * vec4(p, 1.0);
    }`;

  /* 5b · Title fragment shader — onyx bevels, red-corner / blue-corner rim lights,
     bone-white faces, heat where the glyphs were punched, HUD scan-line. */
  const GLSL_TEXT_FRAG = `
    uniform float u_time;
    uniform float u_reveal;
    uniform vec3  u_red;
    uniform vec3  u_cyan;
    varying vec3  vNormal;
    varying vec3  vView;
    varying float vPush;
    varying float vSeed;

    void main() {
      vec3 n = normalize(vNormal);
      vec3 v = normalize(vView);
      float face = smoothstep(0.62, 0.96, n.z);
      float key  = max(dot(n, normalize(vec3(-0.30, 0.70, 0.65))), 0.0);
      float rimR = pow(max(dot(n, normalize(vec3( 0.95, 0.15, 0.25))), 0.0), 2.2);
      float rimC = pow(max(dot(n, normalize(vec3(-0.95, 0.10, 0.25))), 0.0), 2.2);
      float fres = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 2.6);

      vec3 bone = vec3(0.93, 0.92, 0.95);
      vec3 col  = bone * (0.42 + 0.58 * key) * face;
      col += (1.0 - face) * vec3(0.02, 0.02, 0.03);
      col += u_red  * rimR * 0.95;
      col += u_cyan * rimC * 0.95;
      col += u_cyan * fres * 0.22;
      col  = mix(col, u_red * 1.15, clamp(vPush * 0.9, 0.0, 0.85));
      col += u_cyan * 0.05 * sin(gl_FragCoord.y * 0.35 - u_time * 6.0 + vSeed * 6.2831) * face;
      gl_FragColor = vec4(col * (0.12 + 0.88 * u_reveal), 1.0);
    }`;

  /* 5c · Fluid backdrop — domain-warped fbm in onyx / ember / ice. */
  const GLSL_BG_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.9999, 1.0);
    }`;

  const GLSL_BG_FRAG = `
    uniform float u_time;
    uniform vec2  u_res;
    uniform vec2  u_flow;
    uniform float u_heat;
    uniform vec2  u_pointer;
    varying vec2  vUv;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }
    float vnoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
    }
    float fbm(vec2 p) {
      float s = 0.0;
      float a = 0.5;
      for (int i = 0; i < OCTAVES; i++) {
        s += a * vnoise(p);
        p = p * 2.03 + vec2(17.1, 9.7);
        a *= 0.5;
      }
      return s;
    }
    void main() {
      vec2 uv = vUv;
      vec2 p = (uv - 0.5) * vec2(u_res.x / u_res.y, 1.0) * 2.4 + u_flow;
      float t = u_time * 0.045;
      vec2 q = vec2(fbm(p + vec2(0.0, t)), fbm(p + vec2(5.2, 1.3) - t));
      vec2 r = vec2(fbm(p + 3.2 * q + vec2(1.7, 9.2) + 0.9 * t), fbm(p + 3.2 * q + vec2(8.3, 2.8) - 0.7 * t));
      float f = fbm(p + 3.2 * r);

      vec3 onyx  = vec3(0.039, 0.039, 0.047);
      vec3 ember = vec3(0.300, 0.020, 0.070);
      vec3 ice   = vec3(0.000, 0.200, 0.260);
      vec3 col = mix(onyx, ember, smoothstep(0.35, 0.95, f) * 0.55);
      col = mix(col, ice, smoothstep(0.30, 0.90, length(q)) * 0.30);
      col += vec3(0.30, 0.03, 0.08) * exp(-8.0 * distance(uv, u_pointer)) * 0.10;
      col += vec3(1.0, 0.16, 0.29) * u_heat * 0.10 * smoothstep(0.2, 1.0, f);
      gl_FragColor = vec4(col, 1.0);
    }`;

  /* 5d · Post-processing — Chromatic Aberration Shockwave.
     u_distortion pushes red and blue horizontally in opposite directions;
     u_shock is the expanding ring (xy centre, z radius, w strength). */
  const GLSL_POST_VERT = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const GLSL_POST_FRAG = `
    uniform sampler2D tDiffuse;
    uniform float u_distortion;
    uniform float u_time;
    uniform vec2  u_resolution;
    uniform vec4  u_shock;
    uniform float u_grain;
    uniform float u_vignette;
    varying vec2  vUv;

    vec3 fxaaLite(vec2 uv) {
      vec2 px = 1.0 / u_resolution;
      vec3 rgbM  = texture2D(tDiffuse, uv).rgb;
      vec3 rgbNW = texture2D(tDiffuse, uv + vec2(-1.0, -1.0) * px).rgb;
      vec3 rgbNE = texture2D(tDiffuse, uv + vec2( 1.0, -1.0) * px).rgb;
      vec3 rgbSW = texture2D(tDiffuse, uv + vec2(-1.0,  1.0) * px).rgb;
      vec3 rgbSE = texture2D(tDiffuse, uv + vec2( 1.0,  1.0) * px).rgb;
      vec3 luma = vec3(0.299, 0.587, 0.114);
      float lM  = dot(rgbM,  luma);
      float lNW = dot(rgbNW, luma);
      float lNE = dot(rgbNE, luma);
      float lSW = dot(rgbSW, luma);
      float lSE = dot(rgbSE, luma);
      float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
      float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
      vec2 dir;
      dir.x = -((lNW + lNE) - (lSW + lSE));
      dir.y =  ((lNW + lSW) - (lNE + lSE));
      float dirReduce = max((lNW + lNE + lSW + lSE) * (0.25 * 0.125), 1.0 / 128.0);
      float rcpDirMin = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
      dir = min(vec2(8.0), max(vec2(-8.0), dir * rcpDirMin)) * px;
      vec3 rgbA = 0.5 * (texture2D(tDiffuse, uv + dir * (1.0 / 3.0 - 0.5)).rgb + texture2D(tDiffuse, uv + dir * (2.0 / 3.0 - 0.5)).rgb);
      vec3 rgbB = rgbA * 0.5 + 0.25 * (texture2D(tDiffuse, uv + dir * -0.5).rgb + texture2D(tDiffuse, uv + dir * 0.5).rgb);
      float lB = dot(rgbB, luma);
      if (lB < lMin || lB > lMax) return rgbA;
      return rgbB;
    }

    void main() {
      float aspect = u_resolution.x / u_resolution.y;

      /* shockwave ring: radial displacement travelling out from the click */
      vec2 toC = vUv - u_shock.xy;
      vec2 d = vec2(toC.x * aspect, toC.y);
      float dist = length(d);
      float band = 0.07;
      float ring = smoothstep(u_shock.z - band, u_shock.z, dist) - smoothstep(u_shock.z, u_shock.z + band * 0.5, dist);
      vec2 dirn = d / max(dist, 0.0001);
      vec2 uv = vUv + vec2(dirn.x / aspect, dirn.y) * ring * u_shock.w * 0.035;

      /* RGB channel split — red and blue pushed horizontally in opposite directions */
      vec4 color;
      if (abs(u_distortion) < 0.0002) {
        color = vec4(fxaaLite(uv), 1.0);
      } else {
        color = texture2D(tDiffuse, uv);
        color.r = texture2D(tDiffuse, uv + vec2(u_distortion, 0.0)).r;
        color.b = texture2D(tDiffuse, uv - vec2(u_distortion, 0.0)).b;
      }

      color.rgb += vec3(1.0, 0.16, 0.29) * ring * u_shock.w * 0.12;

      float vig = 1.0 - smoothstep(0.25, 0.95, length((vUv - 0.5) * vec2(aspect * 0.7, 1.0)));
      color.rgb *= mix(1.0, vig, u_vignette);

      float grain = fract(sin(dot(vUv * u_resolution + fract(u_time), vec2(12.9898, 78.233))) * 43758.5453);
      color.rgb += (grain - 0.5) * u_grain;

      gl_FragColor = vec4(color.rgb, 1.0);
    }`;

  /* ══ 6 · STAGE ════════════════════════════════════════════════════════════ */
  const view = { w: 1, h: 1, dpr: 1, maxDpr: 1 };
  const engine = { running: false, paused: false, time: 0 };
  const page = { scroll: 0, scrollVel: 0, station: 'home', lastY: window.pageYOffset || 0 };
  const input = { x: 0, y: 0, vx: 0, vy: 0, ax: 0, ay: 0, speed: 0, t: 0, nx: 0, ny: 0, dirX: 1, dirY: 0, wx: 999, wy: 999 };

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false });
  } catch (err) {
    console.warn('[PBB kinetic] WebGL is unavailable; the static layout stays active.', err);
    return;
  }
  view.maxDpr = Math.min(window.devicePixelRatio || 1, TIER.maxDpr);
  view.dpr = view.maxDpr;
  renderer.setClearColor(CONFIG.colors.onyx, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.fog = new T.FogExp2(CONFIG.colors.onyx, 0.0125);
  const camera = new T.PerspectiveCamera(CONFIG.fov, 1, 0.1, 420);
  scene.add(camera); /* camera must live in the scene graph so its children (title plane) render */

  /* Fluid backdrop: full-screen triangle pair that ignores the camera. */
  const backdropMat = new T.ShaderMaterial({
    uniforms: {
      u_time: { value: 0 },
      u_res: { value: new T.Vector2(1, 1) },
      u_flow: { value: new T.Vector2(0, 0) },
      u_heat: { value: 0 },
      u_pointer: { value: new T.Vector2(0.5, 0.5) }
    },
    defines: { OCTAVES: TIER.octaves },
    vertexShader: GLSL_BG_VERT,
    fragmentShader: GLSL_BG_FRAG,
    depthTest: false,
    depthWrite: false
  });
  const backdrop = new T.Mesh(new T.PlaneGeometry(2, 2), backdropMat);
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1000;
  scene.add(backdrop);

  /* Post-processing: RenderPass → Chromatic Aberration Shockwave. The renderer is sized first so the
     composer's render targets are born at the real pixel ratio. */
  renderer.setPixelRatio(view.dpr);
  renderer.setSize(Math.max(1, host.clientWidth || window.innerWidth), Math.max(1, host.clientHeight || window.innerHeight), false);
  const composer = new T.EffectComposer(renderer);
  composer.addPass(new T.RenderPass(scene, camera));
  const postPass = new T.ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      u_distortion: { value: 0 },
      u_time: { value: 0 },
      u_resolution: { value: new T.Vector2(1, 1) },
      u_shock: { value: new T.Vector4(0.5, 0.5, 0, 0) },
      u_grain: { value: 0.035 },
      u_vignette: { value: 0.85 }
    },
    vertexShader: GLSL_POST_VERT,
    fragmentShader: GLSL_POST_FRAG
  });
  composer.addPass(postPass);

  /* Title material: u_mouse (vec2) · u_velocity (float) · u_time (float) + spring hits. */
  const U = {
    u_mouse: { value: new T.Vector2(999, 999) },
    u_velocity: { value: 0 },
    u_time: { value: 0 },
    u_accel: { value: new T.Vector2(1, 0) },
    u_hit: { value: [new T.Vector4(0, 0, 0, 3), new T.Vector4(0, 0, 0, 3), new T.Vector4(0, 0, 0, 3), new T.Vector4(0, 0, 0, 3)] },
    u_hitDir: { value: [new T.Vector3(0, 0, -1), new T.Vector3(0, 0, -1), new T.Vector3(0, 0, -1), new T.Vector3(0, 0, -1)] },
    u_reveal: { value: 0 },
    u_red: { value: new T.Color(CONFIG.colors.red) },
    u_cyan: { value: new T.Color(CONFIG.colors.cyan) }
  };
  const titleMat = new T.ShaderMaterial({ uniforms: U, vertexShader: GLSL_TEXT_VERT, fragmentShader: GLSL_TEXT_FRAG });

  function resize() {
    const w = Math.max(1, host.clientWidth || window.innerWidth);
    const h = Math.max(1, host.clientHeight || window.innerHeight);
    view.w = w;
    view.h = h;
    renderer.setPixelRatio(view.dpr);
    renderer.setSize(w, h, false);
    if (composer.setPixelRatio) composer.setPixelRatio(view.dpr);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    postPass.uniforms.u_resolution.value.set(w * view.dpr, h * view.dpr);
    backdropMat.uniforms.u_res.value.set(w, h);
  }
  let resizeRaf = 0;
  window.addEventListener('resize', function () {
    if (resizeRaf) return;
    resizeRaf = requestAnimationFrame(function () { resizeRaf = 0; resize(); });
  }, { passive: true });
  resize();

  renderer.domElement.addEventListener('webglcontextlost', function (e) { e.preventDefault(); engine.paused = true; }, false);
  renderer.domElement.addEventListener('webglcontextrestored', function () { engine.paused = false; resize(); }, false);

  /* ── spring-driven impacts on the title (4 concurrent slots) ── */
  const hitSlots = [{ amp: 0 }, { amp: 0 }, { amp: 0 }, { amp: 0 }];
  let hitCursor = 0;
  function spawnHit(x, y, dx, dy, dz, power, radius) {
    const i = hitCursor++ % 4;
    const slot = hitSlots[i];
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    U.u_hitDir.value[i].set(dx / len, dy / len, dz / len);
    U.u_hit.value[i].set(x, y, power, radius);
    slot.amp = power;
    gsap.killTweensOf(slot);
    gsap.to(slot, {
      amp: 0,
      duration: CONFIG.spring.duration,
      ease: titleSpringEase, /* damped harmonic oscillator → vertices rebound to the origin grid */
      onUpdate: function () { U.u_hit.value[i].z = slot.amp; },
      onComplete: function () { U.u_hit.value[i].z = 0; }
    });
  }

  /* ── chromatic-aberration shockwave: u_distortion 0 → 0.06 instantly, back to 0 in 0.45 s ── */
  const shockRing = { r: 0, s: 0 };
  const domSplit = { v: 0 };
  let hitClassTimer = 0;
  function triggerShock(clientX, clientY, peak) {
    const p = (typeof peak === 'number') ? peak : CONFIG.shock.peak;
    const u = postPass.uniforms.u_distortion;
    const sv = postPass.uniforms.u_shock.value;
    sv.set(clientX / view.w, 1 - clientY / view.h, 0, 1);

    u.value = p;
    gsap.to(u, { value: 0, duration: CONFIG.shock.duration, ease: 'elastic.out(1, 0.3)', overwrite: true });

    shockRing.r = 0;
    shockRing.s = 1;
    gsap.to(shockRing, {
      r: 1.5, s: 0, duration: 0.9, ease: 'power2.out', overwrite: true,
      onUpdate: function () { sv.z = shockRing.r; sv.w = shockRing.s; },
      onComplete: function () { sv.z = 0; sv.w = 0; }
    });

    /* the DOM takes the hit too: headings split into red / cyan for the same 0.45 s */
    domSplit.v = (p / CONFIG.shock.peak) * 6;
    root.classList.add('k-hit');
    root.style.setProperty('--k-split', domSplit.v.toFixed(2) + 'px');
    gsap.to(domSplit, {
      v: 0, duration: CONFIG.shock.duration, ease: 'elastic.out(1, 0.3)', overwrite: true,
      onUpdate: function () { root.style.setProperty('--k-split', domSplit.v.toFixed(2) + 'px'); }
    });
    window.clearTimeout(hitClassTimer);
    hitClassTimer = window.setTimeout(function () {
      root.classList.remove('k-hit');
      root.style.setProperty('--k-split', '0px');
    }, CONFIG.shock.duration * 1000 + 120);
  }

  /* ══ 7 · TYPOGRAPHY: TextGeometry → tessellation → one merged mesh ═══════ */

  /* The camera looks at the front lid; the back lid is never seen, so drop it. */
  function stripBackFaces(geo) {
    if (geo.index) geo = geo.toNonIndexed();
    const pos = geo.attributes.position.array;
    const nor = geo.attributes.normal.array;
    const uv = geo.attributes.uv ? geo.attributes.uv.array : null;
    const tris = pos.length / 9;
    const keepPos = [];
    const keepNor = [];
    const keepUv = [];
    for (let i = 0; i < tris; i++) {
      if (nor[i * 9 + 2] < -0.9) continue;
      for (let k = 0; k < 9; k++) { keepPos.push(pos[i * 9 + k]); keepNor.push(nor[i * 9 + k]); }
      if (uv) for (let k = 0; k < 6; k++) keepUv.push(uv[i * 6 + k]);
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(keepPos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(keepNor, 3));
    if (uv) out.setAttribute('uv', new T.Float32BufferAttribute(keepUv, 2));
    geo.dispose();
    return out;
  }

  /* Builds the whole title as ONE BufferGeometry (one draw call).
     Every letter is extruded, tessellated (so the vertex shader has vertices to
     warp), tracked and merged with a per-vertex a_letter attribute. */
  async function buildTitleGeometry(font, lines) {
    const cfg = CONFIG.title;
    const data = font.data;
    const res = data.resolution || 1000;
    const k = 1 / res;
    const gap = cfg.bevel * 2 + cfg.tracking;
    const totalLetters = Math.max(1, lines.join('').replace(/\s+/g, '').length);
    const letters = [];
    const lineW = [];
    let letterIndex = 0;

    for (let li = 0; li < lines.length; li++) {
      const text = String(lines[li]);
      let cursor = 0;
      for (let ci = 0; ci < text.length; ci++) {
        const ch = text.charAt(ci);
        const glyph = data.glyphs[ch] || data.glyphs['?'];
        const adv = (glyph ? glyph.ha : res * 0.5) * k * cfg.condense;
        if (ch === ' ') { cursor += adv + gap; continue; }

        let geo = new T.TextGeometry(ch, {
          font: font, size: 1, height: cfg.depth, curveSegments: 5,
          bevelEnabled: true, bevelThickness: cfg.bevel, bevelSize: cfg.bevel, bevelOffset: 0, bevelSegments: 2
        });
        if (!geo.attributes || !geo.attributes.position) { cursor += adv + gap; continue; }
        geo.scale(cfg.condense, 1, 1);
        geo = stripBackFaces(geo);
        if (T.TessellateModifier) {
          try { geo = new T.TessellateModifier(TIER.tessEdge, 6).modify(geo); } catch (err) { /* keep coarse geometry */ }
        }
        letters.push({ geo: geo, x: cursor, line: li, idx: letterIndex / Math.max(1, totalLetters - 1), seed: Math.random() });
        letterIndex++;
        cursor += adv + gap;
        await nextFrame(); /* time-slice: one letter per frame keeps the page responsive */
      }
      lineW[li] = Math.max(0, cursor - gap);
    }
    if (!letters.length) return null;

    const maxW = Math.max.apply(null, lineW);
    const aligns = lines.length === 3 ? ['left', 'right', 'left'] : lines.map(function (_, i) { return i % 2 ? 'right' : 'left'; });
    const step = cfg.capHeight + cfg.leading;

    let vertexCount = 0;
    for (let i = 0; i < letters.length; i++) vertexCount += letters[i].geo.attributes.position.count;
    const P = new Float32Array(vertexCount * 3);
    const N = new Float32Array(vertexCount * 3);
    const L = new Float32Array(vertexCount * 3);
    let o = 0;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < letters.length; i++) {
      const lt = letters[i];
      const pa = lt.geo.attributes.position.array;
      const na = lt.geo.attributes.normal.array;
      const offX = lt.x + (aligns[lt.line] === 'right' ? maxW - lineW[lt.line] : 0);
      const offY = -lt.line * step;
      const count = lt.geo.attributes.position.count;
      for (let v = 0; v < count; v++) {
        const x = pa[v * 3] + offX;
        const y = pa[v * 3 + 1] + offY;
        const z = pa[v * 3 + 2];
        P[o * 3] = x; P[o * 3 + 1] = y; P[o * 3 + 2] = z;
        N[o * 3] = na[v * 3]; N[o * 3 + 1] = na[v * 3 + 1]; N[o * 3 + 2] = na[v * 3 + 2];
        L[o * 3] = lt.idx; L[o * 3 + 1] = lt.line; L[o * 3 + 2] = lt.seed;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
        o++;
      }
      lt.geo.dispose();
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    for (let i = 0; i < vertexCount; i++) { P[i * 3] -= cx; P[i * 3 + 1] -= cy; P[i * 3 + 2] -= cz; }

    const merged = new T.BufferGeometry();
    merged.setAttribute('position', new T.BufferAttribute(P, 3));
    merged.setAttribute('normal', new T.BufferAttribute(N, 3));
    merged.setAttribute('a_letter', new T.BufferAttribute(L, 3));
    return { geometry: merged, blockW: maxX - minX, blockH: maxY - minY };
  }

  /* Crisp outline word (cyan hairlines) used as a ghost sign above every station. */
  function buildOutlineWord(font, text, color, opacity, targetWidth) {
    const shapes = font.generateShapes(text, 1);
    const pts = [];
    const loop = function (arr) {
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i];
        const b = arr[(i + 1) % arr.length];
        pts.push(a.x, a.y, 0, b.x, b.y, 0);
      }
    };
    for (let s = 0; s < shapes.length; s++) {
      const ex = shapes[s].extractPoints(6);
      loop(ex.shape);
      for (let h = 0; h < ex.holes.length; h++) loop(ex.holes[h]);
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
    const word = new T.LineSegments(geo, new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false }));
    word.scale.setScalar(targetWidth / Math.max(0.001, bb.max.x - bb.min.x));
    return word;
  }

  /* ══ 8 · WORLD — data-driven stations along the camera rail ═══════════════
     Every prop is generated from data/content.json (counts, times, dates), so
     the artwork grows and shrinks with the CMS. Nothing here invents names. */
  const matLine = function (color, opacity) {
    return new T.LineBasicMaterial({ color: color, transparent: true, opacity: opacity, depthWrite: false });
  };
  const matFill = function (color, opacity) {
    return new T.MeshBasicMaterial({ color: color, transparent: opacity < 1, opacity: opacity, depthWrite: false });
  };
  function segGeo(points) {
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(points, 3));
    return g;
  }
  /* circle as line segments; plane 'xz' lies on a floor at height h, 'xy' faces the camera at depth h */
  function circleSegs(radius, n, plane, h) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = ((i + 1) / n) * Math.PI * 2;
      if (plane === 'xz') out.push(Math.cos(a0) * radius, h, Math.sin(a0) * radius, Math.cos(a1) * radius, h, Math.sin(a1) * radius);
      else out.push(Math.cos(a0) * radius, Math.sin(a0) * radius, h, Math.cos(a1) * radius, Math.sin(a1) * radius, h);
    }
    return out;
  }
  const UP = new T.Vector3(0, 1, 0);
  function rod(a, b, radius, material) {
    const dir = new T.Vector3().subVectors(b, a);
    const len = dir.length();
    const mesh = new T.Mesh(new T.CylinderGeometry(radius, radius, len, 6, 1, true), material);
    mesh.position.copy(a).addScaledVector(dir, 0.5);
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
    return mesh;
  }

  /* damped-spring "kick": props read kick.amp each frame while GSAP plays it back to 0 */
  function makeKick() {
    const k = { amp: 0 };
    k.fire = function (power) {
      k.amp = clamp(k.amp * 0.5 + power, -2.5, 2.5);
      gsap.killTweensOf(k);
      gsap.to(k, { amp: 0, duration: 1.5, ease: propSpringEase });
    };
    return k;
  }

  /* 4 posts + 3 rope loops (red / bone / cyan) */
  function buildRingFrame(size, height) {
    const group = new T.Group();
    const floorY = -6;
    const corners = [[-size, -size], [size, -size], [size, size], [-size, size]];
    const capColors = [CONFIG.colors.red, CONFIG.colors.cyan, CONFIG.colors.red, CONFIG.colors.cyan];
    const postMat = matFill(0x15151b, 1);
    corners.forEach(function (c, i) {
      const post = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, height, 10), postMat);
      post.position.set(c[0], floorY + height / 2, c[1]);
      group.add(post);
      const cap = new T.Mesh(new T.SphereGeometry(0.26, 12, 8), matFill(capColors[i], 1));
      cap.position.set(c[0], floorY + height, c[1]);
      group.add(cap);
    });
    const ropeColors = [CONFIG.colors.red, CONFIG.colors.bone, CONFIG.colors.cyan];
    const ropes = [];
    for (let r = 0; r < 3; r++) {
      const y = floorY + height * (0.38 + r * 0.26);
      const loopGroup = new T.Group();
      const material = matFill(ropeColors[r], 0.7);
      for (let e = 0; e < 4; e++) {
        const a = corners[e];
        const b = corners[(e + 1) % 4];
        loopGroup.add(rod(new T.Vector3(a[0], y, a[1]), new T.Vector3(b[0], y, b[1]), 0.045, material));
      }
      group.add(loopGroup);
      ropes.push({ group: loopGroup, kick: makeKick() });
    }
    return { group: group, ropes: ropes };
  }
  function updateRingFrame(ring, time) {
    for (let i = 0; i < ring.ropes.length; i++) ring.ropes[i].group.position.y = ring.ropes[i].kick.amp * 0.4 * (i % 2 ? -1 : 1);
    ring.group.rotation.y = 0.6 + Math.sin(time * 0.1) * 0.35;
  }
  function kickRingFrame(ring, power) {
    for (let i = 0; i < ring.ropes.length; i++) ring.ropes[i].kick.fire(power * (0.7 + i * 0.2));
  }

  /* home · three long ring ropes behind the title */
  function buildHome() {
    const group = new T.Group();
    const defs = [[CONFIG.colors.red, -2.6], [CONFIG.colors.bone, 0.3], [CONFIG.colors.cyan, 3.0]];
    const ropes = defs.map(function (d) {
      const mesh = new T.Mesh(new T.CylinderGeometry(0.06, 0.06, 140, 8, 1, true), matFill(d[0], 0.55));
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(0, d[1], -8);
      group.add(mesh);
      return { mesh: mesh, base: d[1], kick: makeKick() };
    });
    return {
      group: group,
      update: function (time) {
        for (let i = 0; i < ropes.length; i++) ropes[i].mesh.position.y = ropes[i].base + ropes[i].kick.amp * 0.5 * (i % 2 ? -1 : 1) + Math.sin(time * 0.6 + i) * 0.03;
      },
      kick: function (p) { for (let i = 0; i < ropes.length; i++) ropes[i].kick.fire(p * (0.6 + i * 0.2)); },
      drift: function (p, out) { out.set(0, -p * 1.2, 0); }
    };
  }

  /* about · the ring itself */
  function buildAbout() {
    const ring = buildRingFrame(7, 4.6);
    return {
      group: ring.group,
      update: function (time) { updateRingFrame(ring, time); },
      kick: function (p) { kickRingFrame(ring, p); },
      drift: function (p, out) { out.set(0, 0, -p * 5); }
    };
  }

  /* programs · one heavy bag per active program */
  function buildPrograms(ctx) {
    const group = new T.Group();
    const items = (ctx.data.programs || []).filter(function (x) { return x && x.active !== false; });
    const n = Math.max(1, items.length);
    const spacing = 5.2;
    const bagMat = matFill(0x14141a, 1);
    const bags = [];
    for (let i = 0; i < n; i++) {
      const pivot = new T.Group();
      pivot.position.set((i - (n - 1) / 2) * spacing, 7.5, -2 - (i % 2) * 2);
      const chain = new T.LineSegments(segGeo([0, 0, 0, 0, -2.4, 0]), matLine(CONFIG.colors.cyan, 0.65));
      const body = new T.Mesh(new T.CylinderGeometry(1.05, 0.95, 4, 20), bagMat);
      body.position.y = -4.4;
      const rim = new T.LineSegments(new T.EdgesGeometry(body.geometry, 30), matLine(CONFIG.colors.cyan, 0.7));
      rim.position.copy(body.position);
      const band = new T.Mesh(new T.TorusGeometry(1.0, 0.05, 6, 28), matFill(CONFIG.colors.red, 0.95));
      band.rotation.x = Math.PI / 2;
      band.position.set(0, -3.6, 0);
      pivot.add(chain);
      pivot.add(body);
      pivot.add(rim);
      pivot.add(band);
      group.add(pivot);
      bags.push({ pivot: pivot, kick: makeKick(), phase: i * 1.3, dir: i % 2 ? -1 : 1 });
    }
    return {
      group: group,
      update: function (time) {
        for (let i = 0; i < bags.length; i++) bags[i].pivot.rotation.z = bags[i].dir * bags[i].kick.amp * 0.3 + Math.sin(time * 0.7 + bags[i].phase) * 0.03;
      },
      kick: function (p) { for (let i = 0; i < bags.length; i++) bags[i].kick.fire(p * (0.7 + (i % 3) * 0.2)); },
      drift: function (p, out) { out.set((p - 0.5) * (n - 1) * spacing * 0.8, 0, 0); }
    };
  }

  /* coaches · the ring + one pillar per active coach (initials only; empty ring when none) */
  function buildCoaches(ctx) {
    const group = new T.Group();
    const ring = buildRingFrame(6.5, 4.6);
    group.add(ring.group);
    const coaches = (ctx.data.coaches || []).filter(function (x) { return x && x.active !== false; });
    const n = coaches.length;
    const pillarMat = matFill(0x14141a, 1);
    coaches.forEach(function (c, i) {
      const a = n === 1 ? 0 : (i / (n - 1) - 0.5) * Math.PI * 0.9;
      const h = 4 + (i % 3) * 0.8;
      const px = Math.sin(a) * 9;
      const pz = -Math.cos(a) * 4 - 2;
      const pillar = new T.Mesh(new T.BoxGeometry(1.1, h, 1.1), pillarMat);
      pillar.position.set(px, -6 + h / 2, pz);
      const edges = new T.LineSegments(new T.EdgesGeometry(pillar.geometry), matLine(CONFIG.colors.cyan, 0.75));
      edges.position.copy(pillar.position);
      group.add(pillar);
      group.add(edges);
      const initials = String(c.name || '').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
      if (initials && ctx.font) {
        const geo = new T.ShapeGeometry(ctx.font.generateShapes(initials, 0.8));
        geo.computeBoundingBox();
        geo.translate(-(geo.boundingBox.min.x + geo.boundingBox.max.x) / 2, 0, 0);
        const label = new T.Mesh(geo, matFill(CONFIG.colors.bone, 0.95));
        label.position.set(px, -6 + h + 0.35, pz + 0.6);
        group.add(label);
      }
    });
    return {
      group: group,
      update: function (time) { updateRingFrame(ring, time); },
      kick: function (p) { kickRingFrame(ring, p); },
      drift: function (p, out) { out.set((p - 0.5) * 6, 0, -p * 4); }
    };
  }

  /* schedule · a 24 h dial: every session becomes an arc, the needle is "now" in WIB */
  function timeFrac(hhmm) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const mi = parseInt(m[2], 10);
    if (h > 24 || mi > 59) return null;
    return (h * 60 + mi) / 1440;
  }
  function jakartaFrac() {
    try {
      const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jakarta' }).formatToParts(new Date());
      let h = 0;
      let m = 0;
      parts.forEach(function (p) {
        if (p.type === 'hour') h = parseInt(p.value, 10) % 24;
        if (p.type === 'minute') m = parseInt(p.value, 10);
      });
      return (h * 60 + m) / 1440;
    } catch (err) {
      const d = new Date();
      return (d.getHours() * 60 + d.getMinutes()) / 1440;
    }
  }
  function buildSchedule(ctx) {
    const group = new T.Group();
    const dial = new T.Group();
    group.add(dial);
    const R = 4.6;
    dial.add(new T.LineSegments(segGeo(circleSegs(R, 128, 'xy', 0)), matLine(CONFIG.colors.cyan, 0.6)));
    dial.add(new T.LineSegments(segGeo(circleSegs(R - 0.55, 128, 'xy', 0)), matLine(CONFIG.colors.cyan, 0.25)));
    const ticks = [];
    for (let h = 0; h < 24; h++) {
      const a = Math.PI / 2 - (h / 24) * Math.PI * 2;
      const len = h % 6 === 0 ? 0.75 : 0.36;
      ticks.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a) * (R - len), Math.sin(a) * (R - len), 0);
    }
    dial.add(new T.LineSegments(segGeo(ticks), matLine(CONFIG.colors.bone, 0.5)));

    const rows = (ctx.data.schedule || []).filter(function (x) { return x && x.status !== 'cancelled' && x.status !== 'closed'; });
    rows.forEach(function (row) {
      const s = timeFrac(row.startTime);
      const e = timeFrac(row.endTime);
      if (s === null || e === null || e <= s) return;
      const arcColor = row.status === 'full' ? CONFIG.colors.red : CONFIG.colors.cyan;
      const arc = new T.Mesh(
        new T.RingGeometry(R - 1.7, R - 0.8, 48, 1, Math.PI / 2 - e * Math.PI * 2, (e - s) * Math.PI * 2),
        new T.MeshBasicMaterial({ color: arcColor, transparent: true, opacity: 0.55, side: T.DoubleSide, depthWrite: false })
      );
      dial.add(arc);
    });

    const needle = new T.LineSegments(segGeo([0, 0, 0, 0, R - 0.3, 0]), matLine(CONFIG.colors.red, 0.95));
    dial.add(needle);
    dial.add(new T.Mesh(new T.CircleGeometry(0.18, 16), matFill(CONFIG.colors.red, 1)));
    dial.rotation.x = -0.35;
    dial.rotation.y = 0.3;

    const kick = makeKick();
    let nowFrac = jakartaFrac();
    let nextRead = 0;
    let angle = -nowFrac * Math.PI * 2;
    return {
      group: group,
      update: function (time) {
        if (time > nextRead) { nowFrac = jakartaFrac(); nextRead = time + 20; }
        angle += (-nowFrac * Math.PI * 2 - angle) * 0.05;
        needle.rotation.z = angle + kick.amp * 0.25;
        dial.scale.setScalar(1 + kick.amp * 0.04);
        dial.rotation.z = Math.sin(time * 0.12) * 0.05;
      },
      kick: function (p) { kick.fire(p); },
      drift: function (p, out) { out.set(Math.sin(p * Math.PI) * 2.5, 0, -p * 2); }
    };
  }

  /* competitions · single-elimination bracket: one leaf per event, the rest are empty slots */
  function buildCompetitions(ctx) {
    const events = (ctx.data.events || []).filter(function (x) { return x && x.active !== false; })
      .sort(function (a, b) { return String(a.date || '9999').localeCompare(String(b.date || '9999')); });
    const leaves = Math.max(2, events.length);
    const rounds = Math.max(1, Math.ceil(Math.log2(leaves)));
    const slots = Math.pow(2, rounds);
    const colW = 4.4;
    const rowH = 1.9;
    const real = [];
    const ghost = [];
    const nodes = [];
    let col = [];
    for (let i = 0; i < slots; i++) col.push({ x: 0, y: (i - (slots - 1) / 2) * rowH, real: i < events.length });
    Array.prototype.push.apply(nodes, col);
    for (let r = 0; r < rounds; r++) {
      const next = [];
      for (let i = 0; i < col.length; i += 2) {
        const a = col[i];
        const b = col[i + 1];
        const parent = { x: (r + 1) * colW, y: (a.y + b.y) / 2, real: a.real || b.real };
        const midX = a.x + colW * 0.5;
        (a.real ? real : ghost).push(a.x, a.y, 0, midX, a.y, 0);
        (b.real ? real : ghost).push(b.x, b.y, 0, midX, b.y, 0);
        (parent.real ? real : ghost).push(midX, a.y, 0, midX, b.y, 0, midX, parent.y, 0, parent.x, parent.y, 0);
        next.push(parent);
      }
      Array.prototype.push.apply(nodes, next);
      col = next;
    }
    const inner = new T.Group();
    inner.position.x = -(rounds * colW) / 2;
    const box = function (x, y, s, bucket) {
      bucket.push(x - s, y - s, 0, x + s, y - s, 0, x + s, y - s, 0, x + s, y + s, 0, x + s, y + s, 0, x - s, y + s, 0, x - s, y + s, 0, x - s, y - s, 0);
    };
    nodes.forEach(function (n) { box(n.x, n.y, 0.26, n.real ? real : ghost); });
    inner.add(new T.LineSegments(segGeo(real), matLine(CONFIG.colors.red, 0.9)));
    inner.add(new T.LineSegments(segGeo(ghost), matLine(CONFIG.colors.cyan, 0.32)));
    const fills = [];
    for (let i = 0; i < events.length; i++) {
      const q = new T.Mesh(new T.PlaneGeometry(0.4, 0.4), matFill(CONFIG.colors.red, 0.9));
      q.position.set(nodes[i].x, nodes[i].y, 0.01);
      inner.add(q);
      fills.push(q);
    }
    const champion = nodes[nodes.length - 1];
    const crown = new T.Mesh(new T.OctahedronGeometry(0.7, 0), new T.MeshBasicMaterial({ color: CONFIG.colors.red, wireframe: true, transparent: true, opacity: 0.95, depthWrite: false }));
    crown.position.set(champion.x + 1.4, champion.y, 0);
    inner.add(crown);

    const group = new T.Group();
    const fit = clamp(Math.min(15 / (rounds * colW + 1), 9 / (slots * rowH)), 0.45, 1.7);
    group.scale.setScalar(fit);
    group.add(inner);
    const kick = makeKick();
    return {
      group: group,
      update: function (time) {
        crown.rotation.y = time * 0.9;
        crown.rotation.x = time * 0.5;
        crown.scale.setScalar(1 + kick.amp * 0.35 + Math.sin(time * 2) * 0.05);
        for (let i = 0; i < fills.length; i++) fills[i].scale.setScalar(1 + kick.amp * 0.4 + Math.sin(time * 1.6 + i) * 0.06);
      },
      kick: function (p) { kick.fire(p); },
      drift: function (p, out) { out.set((p - 0.5) * rounds * colW * fit * 0.5, 0, 0); }
    };
  }

  /* gallery · a spiral of frames, one per published photo (6–24) */
  function buildGallery(ctx) {
    const items = (ctx.data.gallery || []).filter(function (x) { return x && x.active !== false && x.image; });
    const n = clamp(items.length, 6, 24);
    const group = new T.Group();
    const frames = [];
    const w = 3.2;
    const h = 2.4;
    const pts = [-w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, -h / 2, 0, w / 2, h / 2, 0, w / 2, h / 2, 0, -w / 2, h / 2, 0, -w / 2, h / 2, 0, -w / 2, -h / 2, 0];
    for (let i = 0; i < n; i++) {
      const a = i * 0.68;
      const frame = new T.LineSegments(segGeo(pts), matLine(i % 3 === 0 ? CONFIG.colors.red : CONFIG.colors.cyan, 0.7));
      frame.position.set(Math.cos(a) * 7.5, Math.sin(a) * 4.2, -i * 1.5);
      frame.rotation.y = -Math.cos(a) * 0.5;
      frame.rotation.x = Math.sin(a) * 0.3;
      group.add(frame);
      frames.push({ mesh: frame, kick: makeKick(), phase: i });
    }
    return {
      group: group,
      update: function (time) {
        for (let i = 0; i < frames.length; i++) frames[i].mesh.position.z = -i * 1.5 + frames[i].kick.amp * 0.8 + Math.sin(time * 0.5 + frames[i].phase) * 0.08;
      },
      kick: function (p) { for (let i = 0; i < frames.length; i++) frames[i].kick.fire(p * (0.5 + (i % 4) * 0.2)); },
      drift: function (p, out) { out.set(0, 0, -p * n * 1.5 * 0.7); }
    };
  }

  /* contact / 404 · the bell: rings radiating outward */
  function buildBell(tint) {
    const group = new T.Group();
    const rings = [];
    for (let i = 0; i < 6; i++) {
      const color = (i % 2) ? CONFIG.colors.cyan : tint;
      const mesh = new T.Mesh(new T.TorusGeometry(1, 0.012, 6, 96), new T.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.5, depthWrite: false }));
      group.add(mesh);
      rings.push(mesh);
    }
    const core = new T.Mesh(new T.OctahedronGeometry(0.9, 0), new T.MeshBasicMaterial({ color: tint, wireframe: true, transparent: true, opacity: 0.9, depthWrite: false }));
    group.add(core);
    const kick = makeKick();
    return {
      group: group,
      update: function (time) {
        for (let i = 0; i < rings.length; i++) {
          const f = (time * 0.22 + i / rings.length) % 1;
          rings[i].scale.setScalar(0.8 + f * 9);
          rings[i].material.opacity = clamp((1 - f) * 0.55 + kick.amp * 0.25, 0, 1);
        }
        core.rotation.y = time * 0.7;
        core.rotation.x = time * 0.4;
        core.scale.setScalar(1 + kick.amp * 0.3);
      },
      kick: function (p) { kick.fire(p); },
      drift: function (p, out) { out.set(0, 0, -p * 3); }
    };
  }

  const BUILDERS = {
    home: buildHome,
    about: buildAbout,
    programs: buildPrograms,
    coaches: buildCoaches,
    schedule: buildSchedule,
    competitions: buildCompetitions,
    gallery: buildGallery,
    contact: function () { return buildBell(CONFIG.colors.red); },
    notfound: function () { return buildBell(CONFIG.colors.cyan); }
  };

  /* concentric floor decals (a ring-canvas mat) under every station */
  function buildFloorMat() {
    const pts = [];
    [5, 9.5, 14, 19].forEach(function (r) { Array.prototype.push.apply(pts, circleSegs(r, 72, 'xz', -7.5)); });
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      pts.push(Math.cos(a) * 5, -7.5, Math.sin(a) * 5, Math.cos(a) * 19, -7.5, Math.sin(a) * 19);
    }
    return new T.LineSegments(segGeo(pts), matLine(CONFIG.colors.cyan, 0.16));
  }

  function stationLabel(st, site) {
    const cms = st.navKey && site && typeof site[st.navKey] === 'string' ? site[st.navKey].trim() : '';
    return String(cms || st.label || '').toUpperCase();
  }

  /* dust field that streams past the camera along the whole rail */
  function buildDust(count) {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [new T.Color(CONFIG.colors.bone), new T.Color(CONFIG.colors.cyan), new T.Color(CONFIG.colors.red)];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 70;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 32;
      pos[i * 3 + 2] = 14 - Math.random() * 240;
      const c = palette[Math.random() < 0.7 ? 0 : (Math.random() < 0.6 ? 1 : 2)];
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.BufferAttribute(pos, 3));
    geo.setAttribute('color', new T.BufferAttribute(col, 3));
    const points = new T.Points(geo, new T.PointsMaterial({ size: 0.09, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending }));
    points.frustumCulled = false;
    return points;
  }

  /* speed lines glued to the camera: only visible while the rail is moving */
  function buildStreaks() {
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const x = (Math.random() - 0.5) * 30;
      const y = (Math.random() - 0.5) * 18;
      const z = -4 - Math.random() * 46;
      pts.push(x, y, z, x, y, z - 1.6);
    }
    const lines = new T.LineSegments(segGeo(pts), new T.LineBasicMaterial({ color: CONFIG.colors.cyan, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    lines.frustumCulled = false;
    lines.visible = false;
    return lines;
  }

  const dust = buildDust(TIER.dust);
  scene.add(dust);
  const streaks = buildStreaks();
  camera.add(streaks);

  let world = null;
  function buildWorld(data, font, site) {
    const w = { group: new T.Group(), stations: [] };
    STATIONS.forEach(function (st) {
      const built = BUILDERS[st.id]({ data: data, font: font, site: site });
      const g = new T.Group();
      g.position.set(st.x, st.y, st.z);
      g.add(built.group);
      g.add(buildFloorMat());
      const text = stationLabel(st, site);
      if (font && text) {
        const word = buildOutlineWord(font, text, CONFIG.colors.cyan, 0.34, 17);
        word.position.set(0, 4.8, -5);
        g.add(word);
      }
      w.group.add(g);
      built.root = g;
      w.stations.push(built);
    });
    scene.add(w.group);
    return w;
  }
  function updateWorld(time, dt, railPos) {
    if (!world) return;
    for (let i = 0; i < world.stations.length; i++) {
      const s = world.stations[i];
      const near = Math.abs(i - railPos) < 2.6;
      s.root.visible = near;
      if (near && s.update) s.update(time, dt);
    }
  }

  /* ══ 9 · CAMERA RAIL — the camera slides through space instead of reloading ═
     Two Catmull-Rom curves (camera positions + look-at points) run through the
     station anchors in nav order. A page change tweens rig.t along the rail;
     scrolling a page drifts the camera through that station's own props. */
  const railCurve = new T.CatmullRomCurve3(STATIONS.map(function (s) { return new T.Vector3(s.x, s.y, s.z + CONFIG.camDistance); }), false, 'centripetal');
  const lookCurve = new T.CatmullRomCurve3(STATIONS.map(function (s) { return new T.Vector3(s.x, s.y, s.z); }), false, 'centripetal');
  const rig = { t: 0, lead: 0, dir: 1, speed: 0, prevT: 0, leadTl: null };
  const shake = { amp: 0, ang: 0 };
  const par = { x: 0, y: 0 };
  const vPos = new T.Vector3();
  const vLook = new T.Vector3();
  const vTan = new T.Vector3();
  const vDrift = new T.Vector3();

  function goToStation(id, immediate) {
    const i = stationIndex(id);
    if (i < 0) return;
    if (!immediate && id === page.station) return; /* Barba fires before + beforeEnter for one navigation: slide once */
    page.station = id;
    root.setAttribute('data-station', id);
    const toT = i / LAST;
    gsap.killTweensOf(rig, 't');
    if (rig.leadTl) { rig.leadTl.kill(); rig.leadTl = null; }
    if (immediate) { rig.t = toT; rig.prevT = toT; rig.lead = 0; return; }
    const hops = Math.abs(toT - rig.t) * LAST;
    if (hops < 0.01) return;
    const dur = clamp(0.95 + hops * 0.22, 1.0, 2.1);
    rig.dir = toT >= rig.t ? 1 : -1;
    gsap.to(rig, { t: toT, duration: dur, ease: 'power3.inOut' });
    rig.leadTl = gsap.timeline()
      .to(rig, { lead: 1, duration: dur * 0.5, ease: 'sine.out' })
      .to(rig, { lead: 0, duration: dur * 0.5, ease: 'sine.in' });
    triggerShock(view.w / 2, view.h / 2, 0.03);
    playProceduralPunchSound(130, 0.2, 0.5);
  }

  function updateRig(dt) {
    const t = clamp(rig.t, 0, 1);
    railCurve.getPoint(t, vPos);
    lookCurve.getPoint(t, vLook);
    railCurve.getTangent(t, vTan);

    const f = t * LAST;
    const idx = Math.round(f);
    const weight = clamp(1 - Math.abs(f - idx) * 2, 0, 1);
    vDrift.set(0, 0, 0);
    if (world && world.stations[idx] && world.stations[idx].drift) world.stations[idx].drift(page.scroll, vDrift);
    vDrift.multiplyScalar(weight);
    vPos.add(vDrift);
    vLook.addScaledVector(vDrift, 0.7);

    const k = 1 - Math.exp(-dt * 4);
    par.x += (input.nx - par.x) * k;
    par.y += (input.ny - par.y) * k;
    vPos.x += par.x * 0.35 + Math.cos(shake.ang) * shake.amp * 0.3;
    vPos.y += par.y * 0.22 + Math.sin(shake.ang) * shake.amp * 0.2;

    vLook.addScaledVector(vTan, rig.lead * rig.dir * 9);
    camera.position.copy(vPos);
    camera.lookAt(vLook);
    camera.rotateZ(-vTan.x * rig.lead * rig.dir * 0.22);

    const fov = CONFIG.fov + rig.lead * 9;
    if (Math.abs(fov - camera.fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    rig.speed = Math.abs(t - rig.prevT) / Math.max(dt, 0.001);
    rig.prevT = t;
  }

  /* scroll progress: ScrollTrigger when available (synced with Lenis), manual fallback */
  let scrollTrigger = null;
  function bindScrollTrigger() {
    if (!window.ScrollTrigger || scrollTrigger) return;
    try {
      scrollTrigger = window.ScrollTrigger.create({ trigger: document.documentElement, start: 0, end: 'max' });
    } catch (err) {
      scrollTrigger = null;
    }
  }
  function updateScroll(dt) {
    const y = window.pageYOffset || 0;
    let target;
    let vel;
    if (scrollTrigger && typeof scrollTrigger.progress === 'number' && !isNaN(scrollTrigger.progress)) {
      target = scrollTrigger.progress;
      vel = scrollTrigger.getVelocity() / 1000;
    } else {
      const max = Math.max(1, (document.documentElement.scrollHeight || 1) - view.h);
      target = y / max;
      vel = (y - page.lastY) / Math.max(dt * 1000, 1);
    }
    page.lastY = y;
    page.scroll += (clamp(target, 0, 1) - page.scroll) * (1 - Math.exp(-dt * 5));
    page.scrollVel += (vel - page.scrollVel) * 0.3;
  }

  /* camera recoil + prop kick used by every punch */
  function camShake(power) {
    shake.ang = Math.random() * Math.PI * 2;
    shake.amp = power;
    gsap.killTweensOf(shake);
    gsap.to(shake, { amp: 0, duration: 0.9, ease: shakeSpringEase });
  }
  function kickWorld(power) {
    if (!world) return;
    const s = world.stations[stationIndex(page.station)];
    if (s && s.kick) s.kick(power);
  }

  /* ══ 10 · INPUT — pointer velocity / acceleration, punches, hover tones ═══ */
  const HOVER_SELECTOR = '.nav a, .menu-toggle, .site-header .brand, .footer-links a, .site-footer .brand, .btn, .line-link, .text-link, .program-card, .round-link, .action-bar a';
  const FORM_SELECTOR = 'input, textarea, select, option, label, dialog, [data-no-punch]';

  const title = { group: null, mesh: null, slot: null, blockW: 1, blockH: 1, ready: false, shown: false, lastHit: 0, cx: 999, cy: 999, halfW: 0, halfH: 0 };
  const backdropPointer = { x: 0.5, y: 0.5 };

  /* world units per CSS pixel on the title plane (camera space, depth = hudDistance) */
  function unitsPerPixel() {
    return 2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * CONFIG.hudDistance / view.h;
  }

  window.addEventListener('pointermove', function (e) {
    const now = e.timeStamp || performance.now();
    const dt = Math.max(1, now - input.t);
    const vx = (e.clientX - input.x) / dt;             /* px / ms, +x right */
    const vy = -(e.clientY - input.y) / dt;            /* px / ms, +y up    */
    input.ax += (((vx - input.vx) / dt) - input.ax) * 0.5;   /* acceleration, px / ms² */
    input.ay += (((vy - input.vy) / dt) - input.ay) * 0.5;
    input.vx = vx;
    input.vy = vy;
    const sp = Math.sqrt(vx * vx + vy * vy);
    input.speed += (Math.min(sp, 6) - input.speed) * 0.5;

    /* impact direction = pointer acceleration, steadied by the velocity direction */
    const dx = input.ax * 3 + (sp > 0.05 ? vx / sp : 0);
    const dy = input.ay * 3 + (sp > 0.05 ? vy / sp : 0);
    const dl = Math.sqrt(dx * dx + dy * dy);
    if (dl > 0.0001) {
      input.dirX += (dx / dl - input.dirX) * 0.5;
      input.dirY += (dy / dl - input.dirY) * 0.5;
      const nl = Math.sqrt(input.dirX * input.dirX + input.dirY * input.dirY) || 1;
      input.dirX /= nl;
      input.dirY /= nl;
    }

    const upp = unitsPerPixel();
    input.wx = (e.clientX - view.w / 2) * upp;
    input.wy = -(e.clientY - view.h / 2) * upp;
    input.nx = (e.clientX / view.w - 0.5) * 2;
    input.ny = -(e.clientY / view.h - 0.5) * 2;
    backdropPointer.x = e.clientX / view.w;
    backdropPointer.y = 1 - e.clientY / view.h;
    input.x = e.clientX;
    input.y = e.clientY;
    input.t = now;
  }, { passive: true });

  let glitchTimer = 0;
  function glitchHeadings() {
    const els = document.querySelectorAll('main h1');
    for (let i = 0; i < els.length; i++) {
      els[i].classList.remove('impact-glitch');
      void els[i].offsetWidth;
      els[i].classList.add('impact-glitch');
    }
    window.clearTimeout(glitchTimer);
    glitchTimer = window.setTimeout(function () {
      const again = document.querySelectorAll('main h1.impact-glitch');
      for (let i = 0; i < again.length; i++) again[i].classList.remove('impact-glitch');
    }, 260);
  }

  /* one simulated glove hit: bass thud + shockwave + recoil + title spring + props */
  function punch(cx, cy) {
    playProceduralPunchSound(CONFIG.audio.startFreq, CONFIG.audio.duration);
    triggerShock(cx, cy);
    camShake(1);
    kickWorld(1.1);
    if (title.group && title.group.visible) {
      const upp = unitsPerPixel();
      spawnHit((cx - view.w / 2) * upp, -(cy - view.h / 2) * upp, 0, 0, -1, 1.5, 3.4);
    }
    glitchHeadings();
  }

  window.addEventListener('click', function (e) {
    if (!engine.running) return;
    const target = e.target;
    if (target && target.closest && target.closest(FORM_SELECTOR)) return; /* never thump while someone is typing */
    unlockAudio();
    let cx = e.clientX;
    let cy = e.clientY;
    if (e.detail === 0 && target && target.getBoundingClientRect) { /* keyboard activation has no pointer */
      const r = target.getBoundingClientRect();
      cx = r.left + r.width / 2;
      cy = r.top + r.height / 2;
    }
    punch(cx, cy);
  });

  /* menu hover: the index of the item inside its menu sets the pitch of the thud */
  document.addEventListener('pointerover', function (e) {
    if (!engine.running || e.pointerType === 'touch') return;
    const el = e.target && e.target.closest ? e.target.closest(HOVER_SELECTOR) : null;
    if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
    const menu = el.closest('.nav, .footer-links') || document;
    const items = menu.querySelectorAll(HOVER_SELECTOR);
    let idx = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i] === el) { idx = i; break; }
    }
    playProceduralPunchSound(112 + (idx % 8) * 9, 0.16, 0.45);
  }, { passive: true });

  /* a fast flick through the title spawns a spring impact (rate-limited) */
  function maybeVelocityHit(nowMs) {
    if (!title.group || !title.group.visible) return;
    if (input.speed <= CONFIG.punch.minVelocity || nowMs - title.lastHit < 110) return;
    if (Math.abs(input.wx - title.cx) > title.halfW + CONFIG.punch.radius) return;
    if (Math.abs(input.wy - title.cy) > title.halfH + CONFIG.punch.radius) return;
    title.lastHit = nowMs;
    const power = clamp((input.speed - CONFIG.punch.minVelocity) * 0.45 + 0.35, 0.3, 1.5);
    spawnHit(input.wx, input.wy, input.dirX, input.dirY, -0.35, power, CONFIG.punch.radius + 0.4);
  }

  /* ══ 11 · DOM BRIDGE — the 3D title tracks the layout slot in index.html ══ */
  function findSlot() {
    const el = document.querySelector('[data-kinetic-title]');
    if (el !== title.slot) {
      title.slot = el;
      title.shown = false;
    }
    return el;
  }

  function revealTitle() {
    const loaderUp = document.querySelector('.loader') && !root.classList.contains('no-loader');
    gsap.killTweensOf(U.u_reveal);
    U.u_reveal.value = 0;
    gsap.to(U.u_reveal, { value: 1, duration: 1.5, delay: loaderUp ? 0.8 : 0.1, ease: 'power3.out' });
  }

  function attachTitle(built) {
    if (title.group) {
      camera.remove(title.group);
      if (title.mesh) title.mesh.geometry.dispose();
    }
    const mesh = new T.Mesh(built.geometry, titleMat);
    mesh.frustumCulled = false; /* the vertex shader moves vertices outside the static bounds */
    const group = new T.Group();
    group.add(mesh);
    group.visible = false;
    camera.add(group);
    title.group = group;
    title.mesh = mesh;
    title.blockW = built.blockW;
    title.blockH = built.blockH;
    title.ready = true;
    title.shown = false;
  }

  function layoutTitle() {
    if (!title.ready) return;
    const slot = (title.slot && title.slot.isConnected) ? title.slot : findSlot();
    if (!slot) { title.group.visible = false; return; }
    const r = slot.getBoundingClientRect();
    if (r.width < 8 || r.height < 8 || r.bottom < -160 || r.top > view.h + 160) { title.group.visible = false; return; }
    if (!title.shown) {
      title.shown = true;
      revealTitle();
      root.classList.add('kinetic-title');
    }
    const upp = unitsPerPixel();
    const s = Math.min(r.width / title.blockW, r.height / title.blockH) * upp;
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    title.group.visible = true;
    title.group.scale.setScalar(s);
    title.group.position.set((cx - view.w / 2) * upp, -(cy - view.h / 2) * upp, -CONFIG.hudDistance);
    const tilt = clamp(-page.scrollVel * 0.18, -0.35, 0.35);
    title.group.rotation.x += (tilt - title.group.rotation.x) * 0.1;
    title.cx = title.group.position.x;
    title.cy = title.group.position.y;
    title.halfW = (title.blockW * s) / 2;
    title.halfH = (title.blockH * s) / 2;
  }

  /* ══ 12 · ROUTER — Barba page changes become camera slides ════════════════ */
  function stationFromContainer() {
    const c = document.querySelector('[data-barba="container"]');
    const ns = c ? c.getAttribute('data-barba-namespace') : '';
    return stationIndex(ns) >= 0 ? ns : stationFromUrl(window.location.pathname);
  }
  function refreshPage() {
    findSlot();
    const id = stationFromContainer();
    if (id !== page.station) goToStation(id);
    if (window.ScrollTrigger) {
      try { window.ScrollTrigger.refresh(); } catch (err) { /* refreshed again by app.js */ }
    }
  }
  function bindBarba() {
    if (!window.barba || !window.barba.hooks) return;
    try {
      window.barba.hooks.before(function (data) {
        if (data && data.next && data.next.url) goToStation(stationFromUrl(data.next.url));
      });
      window.barba.hooks.beforeEnter(function (data) {
        if (data && data.next && data.next.namespace && stationIndex(data.next.namespace) >= 0) goToStation(data.next.namespace);
      });
      window.barba.hooks.after(refreshPage);
    } catch (err) {
      /* without Barba the pages navigate normally and every page boots at its own station */
    }
  }
  window.addEventListener('pbb:content', refreshPage);

  /* ══ 13 · FRAME LOOP — locked to 60 fps, resolution adapts to hold it ═════ */
  const timing = { last: performance.now(), acc: 0, renderedAt: performance.now(), frames: 0 };
  const gov = { ema: 16.7, slow: 0, fast: 0, drops: 0, emaAtDrop: 0, cooldown: 0, throttled: false };

  /* Adaptive resolution. Frame time stays above budget -> render fewer pixels.
     If a drop buys no speed-up, the frame rate is being capped by the platform
     (30 Hz panel, low-power mode), not by the GPU: restore full resolution and
     stop adapting instead of blurring the artwork for nothing. */
  function govern(dtMs) {
    timing.frames++;
    if (timing.frames < 60) return; /* ignore shader-compile / upload hitches */
    gov.ema += (dtMs - gov.ema) * 0.08;
    if (gov.cooldown > 0) gov.cooldown--;
    if (gov.ema > 21.5) { gov.slow++; gov.fast = 0; }
    else if (gov.ema < 17.6) { gov.fast++; gov.slow = 0; }
    else { gov.slow = 0; gov.fast = 0; }

    if (!gov.throttled && gov.slow > 45 && view.dpr > 0.8) {
      if (gov.drops > 0 && gov.ema > gov.emaAtDrop - 3) {
        gov.throttled = true;
        view.dpr = view.maxDpr;
        gov.slow = 0;
        resize();
        return;
      }
      gov.emaAtDrop = gov.ema;
      gov.drops++;
      gov.cooldown = 1800; /* ~30 s before resolution may climb again: no hunting */
      view.dpr = Math.max(0.8, view.dpr - 0.2);
      gov.slow = 0;
      resize();
    } else if (gov.fast > 300 && gov.cooldown === 0) {
      gov.fast = 0;
      gov.drops = 0;
      if (view.dpr < view.maxDpr) {
        view.dpr = Math.min(view.maxDpr, view.dpr + 0.15);
        resize();
      }
    }
  }

  function frame(dt, nowMs) {
    engine.time += dt;
    const time = engine.time;
    updateScroll(dt);

    input.speed *= Math.pow(0.9, dt * 60);
    U.u_velocity.value = input.speed;
    U.u_mouse.value.set(input.wx, input.wy);
    U.u_accel.value.set(input.dirX, input.dirY);
    U.u_time.value = time;

    const bu = backdropMat.uniforms;
    bu.u_time.value = time;
    bu.u_flow.value.set(rig.t * 14, page.scroll * 0.6);
    bu.u_heat.value = clamp(shake.amp * 0.8 + input.speed * 0.08, 0, 1);
    bu.u_pointer.value.set(backdropPointer.x, backdropPointer.y);
    postPass.uniforms.u_time.value = time;

    layoutTitle();
    maybeVelocityHit(nowMs);
    updateRig(dt);
    updateWorld(time, dt, rig.t * LAST);
    dust.rotation.y = Math.sin(time * 0.05) * 0.03;

    const op = clamp(rig.speed * 0.9, 0, 0.75);
    streaks.material.opacity = op;
    streaks.visible = op > 0.02;
    streaks.scale.z = 1 + rig.speed * 12;

    composer.render(dt);
  }

  /* gsap.ticker is the single clock (Lenis and every tween ride it as well). The
     accumulator lets a 60 Hz panel render every tick, a 120/144 Hz panel render
     at an even 60, and never lets a slow frame snowball. */
  function onTick() {
    const now = performance.now();
    if (!engine.running || engine.paused || document.hidden) { timing.last = now; timing.acc = 0; return; }
    let delta = now - timing.last;
    timing.last = now;
    if (delta > 100) delta = 100;
    timing.acc += delta;
    if (timing.acc < CONFIG.frameMs - 2) return;
    timing.acc -= CONFIG.frameMs;
    if (timing.acc < 0 || timing.acc > CONFIG.frameMs * 2) timing.acc = 0;
    const dtMs = now - timing.renderedAt;
    timing.renderedAt = now;
    frame(Math.min(dtMs / 1000, 0.05), now);
    govern(dtMs);
  }
  document.addEventListener('visibilitychange', function () {
    timing.last = performance.now();
    timing.renderedAt = timing.last;
    timing.acc = 0;
  });

  /* ══ 14 · BOOT ════════════════════════════════════════════════════════════ */
  async function loadContent() {
    try {
      let d = null;
      if (new URLSearchParams(window.location.search).get('draft') === '1') {
        const raw = window.localStorage.getItem('pbogor_cms_draft');
        if (raw) d = JSON.parse(raw);
      }
      if (!d) {
        const r = await fetch(CONFIG.contentUrl, { cache: 'no-store' });
        if (r.ok) d = await r.json();
      }
      return d || {};
    } catch (err) {
      return {};
    }
  }
  function loadFont(url) {
    return new Promise(function (resolve) {
      try { new T.FontLoader().load(url, resolve, undefined, function () { resolve(null); }); } catch (err) { resolve(null); }
    });
  }
  function titleLines(site) {
    const slot = document.querySelector('[data-kinetic-title]');
    const raw = slot ? String(slot.getAttribute('data-kinetic-title') || '') : '';
    let lines = raw.split('|').map(function (s) { return s.trim().toUpperCase(); }).filter(Boolean);
    if (!lines.length) lines = String(site.name || '').toUpperCase().split(/\s+/).filter(Boolean);
    if (lines.length < 1 || lines.length > 4) lines = CONFIG.title.lines;
    return lines;
  }

  async function boot() {
    goToStation(stationFromContainer(), true);
    bindScrollTrigger();
    bindBarba();
    engine.running = true;
    root.classList.add('kinetic-ready');
    gsap.ticker.add(onTick); /* the fluid backdrop is on screen from the first tick */

    const ready = (window.PBBSiteReady && typeof window.PBBSiteReady.then === 'function') ? window.PBBSiteReady : Promise.resolve({});
    const results = await Promise.all([loadContent(), loadFont(CONFIG.fontUrl), ready.catch(function () { return {}; })]);
    const data = results[0] || {};
    const font = results[1];
    const site = data.site || {};
    soundOn = site.kineticSound !== false;

    try {
      world = buildWorld(data, font, site);
    } catch (err) {
      console.warn('[PBB kinetic] world build failed; backdrop only.', err);
      world = null;
    }

    if (font) {
      try {
        const built = await buildTitleGeometry(font, titleLines(site));
        if (built) attachTitle(built);
      } catch (err) {
        console.warn('[PBB kinetic] title build failed; the DOM title stays visible.', err);
      }
    }
    findSlot();
  }

  window.PBBKinetic = {
    version: 8,
    playProceduralPunchSound: playProceduralPunchSound,
    punch: punch,
    goToStation: goToStation,
    spring: dampedSpring,
    get state() { return { station: page.station, railT: rig.t, dpr: view.dpr, tier: tierName, fps: gov.ema ? 1000 / gov.ema : 0 }; }
  };
  window.playProceduralPunchSound = playProceduralPunchSound;

  boot().catch(function (err) {
    console.warn('[PBB kinetic] boot failed; the static layout stays active.', err);
    engine.running = false;
    gsap.ticker.remove(onTick);
    root.classList.remove('kinetic-ready', 'kinetic-title');
  });
})();
