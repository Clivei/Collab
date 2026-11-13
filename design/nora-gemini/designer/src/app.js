/* app.js - scene, camera, UI, view modes and action animations. The racket itself comes from engine.js. */
(function () {
  const $ = s => document.querySelector(s);
  const el = (tag, attrs = {}, ...kids) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v); }
    for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c));
    return e;
  };
  const toast = (t) => { const n = $('#toast'); n.textContent = t; n.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => n.classList.remove('show'), 1800); };

  /* ------------------------------------------------------------------ renderer / scene */
  const canvas = $('#gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const MAXA = renderer.capabilities.getMaxAnisotropy();

  const scene = new THREE.Scene();
  { const c = document.createElement('canvas'); c.width = 4; c.height = 512; const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, '#1b222c'); gr.addColorStop(0.55, '#0d1117'); gr.addColorStop(1, '#07090c'); g.fillStyle = gr; g.fillRect(0, 0, 4, 512);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; scene.background = t; }
  const camera = new THREE.PerspectiveCamera(32, 1, 1, 600);
  const controls = new THREE.OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08; controls.minDistance = 18; controls.maxDistance = 240; controls.rotateSpeed = 0.7;
  controls.target.set(0, 0, 0); controls.autoRotateSpeed = 3.2;

  /* ------------------------------------------------------------------ procedural environments (no HDRI files) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  function makeEnv(kind) {
    const s = new THREE.Scene();
    const room = new THREE.Mesh(new THREE.SphereGeometry(60, 32, 16), new THREE.MeshBasicMaterial({ color: kind === 'neutral' ? 0x7d828a : 0x07080b, side: THREE.BackSide }));
    s.add(room);
    const box = (w, h, pos, col, k) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(k), side: THREE.DoubleSide }));
      m.position.set(...pos); m.lookAt(0, 0, 0); s.add(m);
    };
    if (kind === 'studio') {
      box(34, 26, [-30, 26, 34], 0xffffff, 7);          // key softbox
      box(5, 60, [-46, 5, -14], 0xffffff, 9);            // long rim strips
      box(5, 60, [46, 5, -14], 0xdfe9ff, 9);
      box(40, 12, [0, 52, 0], 0xffffff, 3.2);            // overhead
      box(24, 20, [38, 12, 34], 0xbfd4ff, 2.2);          // cool fill
      box(60, 10, [0, 6, -48], 0xfff1dc, 2.6);           // back kicker
      box(70, 70, [0, -52, 0], 0x303640, 1.2);           // floor bounce
    } else if (kind === 'arena') {
      box(28, 70, [-48, 8, 8], 0x2f6bff, 7); box(28, 70, [48, 8, 8], 0xff7a2a, 7);
      for (let i = -3; i <= 3; i++) box(5, 5, [i * 13, 52, 8], 0xffffff, 14);
      box(80, 12, [0, 14, -52], 0xffffff, 2.4); box(40, 20, [0, 18, 46], 0xcfd8ff, 1.6);
    } else { box(80, 80, [0, 55, 0], 0xffffff, 2.2); box(70, 40, [-50, 10, 30], 0xffffff, 1.8); box(70, 40, [50, 10, 30], 0xffffff, 1.4); }
    const t = pmrem.fromScene(s, 0.03).texture; s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return t;
  }
  const envs = {};
  const setEnv = k => { if (!envs[k]) envs[k] = makeEnv(k); scene.environment = envs[k]; };

  /* ------------------------------------------------------------------ 3-point studio lights */
  const key = new THREE.DirectionalLight(0xfff4e8, 1.5); key.position.set(-42, 70, 62); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 10, far: 220 });
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.12; key.shadow.radius = 4;
  const rim = new THREE.SpotLight(0xa8c8ff, 2.4, 0, 0.7, 0.6); rim.position.set(48, 38, -64); rim.target.position.set(0, 0, 0);
  const fill = new THREE.DirectionalLight(0xffe2cc, 0.55); fill.position.set(60, 10, 55);
  scene.add(key, rim, rim.target, fill, new THREE.HemisphereLight(0x8aa0c0, 0x10131a, 0.25));

  /* ------------------------------------------------------------------ floor: CAD grid + soft shadow catcher */
  const FLOOR_Y = -30;
  const grid = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: `varying vec2 vP; float ln(vec2 p,float s){ vec2 g=abs(fract(p/s-.5)-.5)/fwidth(p/s); return 1.-min(min(g.x,g.y),1.); }
      void main(){ float r=length(vP); float f=1.-smoothstep(30.,115.,r); float a=(ln(vP,5.)*.10+ln(vP,25.)*.22)*f;
        float ring=1.-smoothstep(.0,.35,abs(r-32.)); a+=ring*.35*f; gl_FragColor=vec4(.35,.7,.9,a); }`
  }));
  grid.rotation.x = -Math.PI / 2; grid.position.y = FLOOR_Y; scene.add(grid);
  const shadowCatch = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.ShadowMaterial({ opacity: 0.38 }));
  shadowCatch.rotation.x = -Math.PI / 2; shadowCatch.position.y = FLOOR_Y + 0.05; shadowCatch.receiveShadow = true; scene.add(shadowCatch);

  /* ------------------------------------------------------------------ rig: hover -> swing pivot -> racket */
  const rig = new THREE.Group(), swing = new THREE.Group(); rig.add(swing); scene.add(rig);
  const HAND_Y = 70;                                  // mm along the grip where the player holds it
  let racket = null, mold = null;

  /* ------------------------------------------------------------------ state */
  const state = {
    moldId: null, selFace: 'A', link: false, viewFace: 'A', mode: 'studio', heatKind: 'sweet', airflow: true,
    faces: { A: null, B: null }, ui: { A: null, B: null }, core: null, frame: null, grip: null,
    scene: { env: 'studio', exposure: 1.0, shadows: true, hotspots: true }
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const defUI = () => ({ groups: { logo: true, type: true, stripe: true }, logoColor: null, customText: '' });

  /* ------------------------------------------------------------------ camera helpers */
  const camState = () => { const o = camera.position.clone().sub(controls.target), d = o.length(); return { az: Math.atan2(o.x, o.z), pol: Math.acos(o.y / d), d, tx: controls.target.x, ty: controls.target.y, tz: controls.target.z }; };
  const applyCam = s => {
    camera.position.set(s.tx + s.d * Math.sin(s.pol) * Math.sin(s.az), s.ty + s.d * Math.cos(s.pol), s.tz + s.d * Math.sin(s.pol) * Math.cos(s.az));
    controls.target.set(s.tx, s.ty, s.tz); camera.lookAt(controls.target);
  };
  let camTween = null;
  function tweenCam(to, dur = 1.1, ease = 'power3.inOut') {
    const s = camState(); if (camTween) camTween.kill();
    controls.enabled = false;
    camTween = gsap.to(s, { ...to, duration: dur, ease, onUpdate: () => applyCam(s), onComplete: () => { controls.enabled = true; } });
    return camTween;
  }
  const homeView = face => ({ az: face === 'A' ? 0.42 : Math.PI - 0.42, pol: 1.5, d: fitDist(), tx: 0, ty: 0.5, tz: 0 });
  function fitDist() { const aspect = innerWidth / innerHeight, vf = 32 * Math.PI / 180, H = 64; const dv = H / 2 / Math.tan(vf / 2); const dh = 26 / aspect / Math.tan(vf / 2) * aspect; return Math.max(dv * 1.02, dh * 1.1); }
  function resize() {
    const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h;
    const shift = $('#side').classList.contains('closed') || innerWidth < 760 ? 0 : 170;
    camera.setViewOffset(w, h, -shift, innerWidth < 760 ? 0 : 52, w, h); camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  /* ------------------------------------------------------------------ load a mold */
  function loadMold(id, animate = true) {
    const m = MOLD_REGISTRY[id]; if (!m) return;
    if (racket) { swing.remove(racket.root); racket.dispose(); }
    mold = m; state.moldId = id;
    state.faces = { A: clone(m.faces.A), B: clone(m.faces.B) };
    state.ui = { A: defUI(), B: defUI() };
    state.core = clone(m.core); state.frame = clone(m.frame); state.grip = m.handle.grip.color;
    racket = new Racket(m, { maxAniso: MAXA });
    const midY = (racket.geo.bb.y1 - 76) / 2;
    racket.root.position.set(0, -HAND_Y * MMS, 0);
    swing.position.set(0, -(midY - HAND_Y) * MMS, 0); swing.rotation.set(0, 0, 0);
    swing.add(racket.root);
    racket.viewMode = 'studio';
    racket.heatUniforms.uOpacity.value = 0;
    buildPins(); buildLayerTags();
    refreshUI();
    setMode('studio', true);
    $('#hudName').textContent = m.brand + ' ' + m.model; updateHud();
    if (animate) {
      gsap.fromTo(rig.scale, { x: 0.86, y: 0.86, z: 0.86 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: 'back.out(1.6)' });
      gsap.fromTo(rig.rotation, { y: -0.6 }, { y: 0, duration: 0.9, ease: 'power3.out' });
      tweenCam(homeView(state.viewFace), 1.0);
    } else applyCam(homeView(state.viewFace));
    toast(m.brand + ' ' + m.model + ' loaded');
  }

  /* ------------------------------------------------------------------ view modes */
  const explode = { t: 0 };
  function setMode(m, silent) {
    const was = state.mode; state.mode = m;
    const wantEx = m === 'exploded' ? 1 : 0;
    gsap.to(explode, { t: wantEx, duration: m === 'exploded' ? 1.5 : 1.0, ease: 'power3.inOut', onUpdate: () => racket.setExplode(explode.t) });
    racket.airflowOn = state.airflow;
    racket.setViewMode(m === 'exploded' ? 'studio' : m);
    racket.setHeatKind(state.heatKind);
    gsap.to(racket.heatUniforms.uOpacity, { value: m === 'heat' ? 0.9 : 0, duration: 0.6, onUpdate: () => { if (m !== 'heat' && racket.heatUniforms.uMode.value === 0 && racket.heatUniforms.uOpacity.value < 0.02) { racket.heat.A.visible = racket.heat.B.visible = false; } } });
    if (m === 'heat') racket.heatUniforms.uMode.value = 0;
    if (!silent) {
      if (m === 'exploded') tweenCam({ az: state.viewFace === 'A' ? 1.15 : Math.PI - 1.15, pol: 1.42, d: fitDist() * 1.25 }, 1.4);
      else if (was === 'exploded') tweenCam(homeView(state.viewFace), 1.2);
      if (m === 'heat') tweenCam({ az: state.viewFace === 'A' ? 0.12 : Math.PI - 0.12, pol: 1.52, d: fitDist() * 0.92 }, 1.1);
    }
    document.querySelectorAll('#dock [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
    $('#sub').classList.toggle('show', m === 'heat'); $('#sub').style.bottom = ($('#dock').offsetHeight + 24) + 'px';
    pinsVisible();
    updateHud();
  }
  function flip() {
    const s = camState(); state.viewFace = state.viewFace === 'A' ? 'B' : 'A'; state.selFace = state.viewFace;
    tweenCam({ az: s.az + Math.PI }, 1.1); refreshFaceTabs(); updateHud();
    if (racket && state.mode === 'studio') toast(state.viewFace === 'A' ? 'Face A - Attack / Forehand' : 'Face B - Control / Backhand');
  }
  function updateHud() { $('#hudSub').innerHTML = `<span class="face">FACE ${state.viewFace}</span> &middot; ${state.viewFace === 'A' ? 'ATTACK / FOREHAND' : 'CONTROL / BACKHAND'} &middot; ${state.mode.toUpperCase()}`; }

  /* ------------------------------------------------------------------ action animations */
  let anim = null, turntable = false;
  const trail = (() => {
    const N = 44, pos = new Float32Array(N * 2 * 3), alpha = new Float32Array(N * 2), idx = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uFade: { value: 1 } },
      vertexShader: 'attribute float alpha; varying float vA; void main(){ vA=alpha; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float uFade; varying float vA; void main(){ gl_FragColor=vec4(mix(vec3(.1,.55,1.),vec3(.9,1.,1.),vA),vA*vA*.7*uFade); }'
    }));
    m.frustumCulled = false; m.visible = false; scene.add(m);
    const hist = [];
    return {
      mesh: m, active: false,
      reset() { hist.length = 0; g.setDrawRange(0, 0); },
      push(a, b) {
        hist.unshift([a.clone(), b.clone()]); if (hist.length > N) hist.pop();
        for (let i = 0; i < hist.length; i++) {
          pos.set([hist[i][0].x, hist[i][0].y, hist[i][0].z, hist[i][1].x, hist[i][1].y, hist[i][1].z], i * 6);
          const f = 1 - i / hist.length; alpha[i * 2] = f; alpha[i * 2 + 1] = f * 0.0;
        }
        g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.setDrawRange(0, Math.max(0, (hist.length - 1) * 6));
      }
    };
  })();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(3.3, 28, 20), new THREE.MeshStandardMaterial({ color: 0xd8f227, roughness: 0.85, emissive: 0x2b3300 }));
  ball.visible = false; ball.castShadow = true; scene.add(ball);
  const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
  function smash() {
    if (anim) return;
    if (state.mode === 'exploded' || state.mode === 'wire' || state.mode === 'xray') setMode('studio');
    controls.autoRotate = false; turntable = false; syncDock();
    const faceSign = state.viewFace === 'A' ? 1 : -1, contactAng = 0.62 * faceSign;
    // camera: side-on so the arc reads clearly
    tweenCam({ az: faceSign > 0 ? -1.15 : 1.15, pol: 1.5, d: fitDist() * 1.2, ty: 1, tx: 0, tz: faceSign * 15 }, 0.8);
    // predict the contact point so the ball waits where the strings (face) will be
    swing.rotation.x = contactAng; swing.updateMatrixWorld(true);
    const head = racket.root.localToWorld(new THREE.Vector3(0, 320, 0));
    const nrm = new THREE.Vector3(0, 0, faceSign).transformDirection(racket.root.matrixWorld);
    const contact = head.clone().add(nrm.multiplyScalar(1.9 + 3.3));
    swing.rotation.x = 0; swing.updateMatrixWorld(true);
    ball.position.copy(contact); ball.scale.setScalar(1); ball.visible = true; ball.material.opacity = 1; ball.material.transparent = true;
    trail.reset(); trail.active = true; trail.mesh.visible = true; trail.mesh.material.uniforms.uFade.value = 1;
    const tl = gsap.timeline({ onComplete: () => { anim = null; trail.active = false; ball.visible = false; gsap.to(trail.mesh.material.uniforms.uFade, { value: 0, duration: 0.5, onComplete: () => { trail.mesh.visible = false; } }); toast('Swing complete'); } });
    anim = tl;
    const sw = { x: 0 }; let hit = false;
    const hitSign = faceSign;
    tl.to(rig.position, { y: 0.8, duration: 0.45, ease: 'power2.out' }, 0)
      .to(swing.rotation, { x: -1.15 * hitSign, z: 0.25, duration: 0.7, ease: 'power2.inOut' }, 0)
      .to(swing.rotation, { x: 1.55 * hitSign, z: -0.1, duration: 0.34, ease: 'power3.in',
        onUpdate: () => { if (!hit && swing.rotation.x * hitSign >= contactAng * hitSign) { hit = true; impact(contact, hitSign); } } }, 0.78)
      .to(swing.rotation, { x: 0, z: 0, duration: 1.2, ease: 'power2.inOut' }, 1.5)
      .to(rig.position, { y: 0, duration: 1.0, ease: 'power2.inOut' }, 1.5);
    gsap.fromTo(ball.scale, { x: 0.1, y: 0.1, z: 0.1 }, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' });
  }
  function impact(contact, sign) {
    // ball launched away from the hitting face
    const dir = new THREE.Vector3(0.18, -0.30, sign).normalize(), v = { t: 0 };
    gsap.to(ball.position, { x: contact.x + dir.x * 150, y: contact.y + dir.y * 150 - 10, z: contact.z + dir.z * 150, duration: 1.2, ease: 'power1.out' });
    gsap.to(ball.material, { opacity: 0, duration: 0.5, delay: 0.8 });
    // vibration: damped shake of the whole swing pivot
    const t0 = clock.elapsedTime;
    gsap.to(v, { t: 1, duration: 1.7, ease: 'none', onUpdate: () => {
      const e = Math.exp(-v.t * 5.2), w = (clock.elapsedTime - t0) * 62;
      swing.position.z = Math.sin(w) * 0.28 * e; swing.rotation.y = Math.sin(w * 0.8) * 0.035 * e;
    }, onComplete: () => { swing.position.z = 0; swing.rotation.y = 0; } });
    // ripple across the face
    const u = racket.heatUniforms; u.uMode.value = 1; u.uOpacity.value = 1; u.uRipple.value.set(((mold.performance || {}).sweetSpot || { x: 0 }).x, ((mold.performance || {}).sweetSpot || { y: 320 }).y, clock.elapsedTime);
    racket.heat.A.visible = racket.heat.B.visible = true;
    gsap.delayedCall(2.1, () => { u.uMode.value = 0; u.uOpacity.value = state.mode === 'heat' ? 0.9 : 0; if (state.mode !== 'heat') racket.heat.A.visible = racket.heat.B.visible = false; });
    // camera kick
    const s = camState(); gsap.fromTo(camera, { fov: 30.8 }, { fov: 32, duration: 0.5, ease: 'elastic.out(1,0.4)', onUpdate: () => camera.updateProjectionMatrix() });
  }
  function toggleTurntable() {
    turntable = !turntable; controls.autoRotate = turntable; syncDock();
    toast(turntable ? '360 turntable on' : 'Turntable off');
  }

  /* ------------------------------------------------------------------ hotspots + exploded-layer tags */
  let pins = [], ltags = [];
  function buildPins() {
    pins.forEach(p => p.node.remove()); pins = [];
    (mold.hotspots || []).forEach((h, i) => {
      const n = el('div', { class: 'pin', title: h.label }, String(i + 1));
      n.addEventListener('click', () => focusHotspot(h));
      $('#labels').append(n); pins.push({ node: n, h });
    });
  }
  function buildLayerTags() {
    ltags.forEach(t => t.node.remove()); ltags = [];
    racket.layers.forEach((L, i) => { const n = el('div', { class: 'ltag' }, (i + 1) + '  ' + L.name); n.style.opacity = 0; $('#labels').append(n); ltags.push({ node: n, L }); });
  }
  function pinsVisible() { const on = state.scene.hotspots && (state.mode === 'studio' || state.mode === 'heat'); pins.forEach(p => p.on = on); }
  function focusHotspot(h) {
    $('#card h4').textContent = h.label; $('#card p').textContent = h.text; $('#card').classList.add('show');
    if (state.mode === 'exploded') return;
    const w = racket.root.localToWorld(new THREE.Vector3(h.pos[0], h.pos[1], h.pos[2]));
    const side = h.face === 'B' ? -1 : h.face === 'A' ? 1 : 0;
    const az = side > 0 ? 0.35 : side < 0 ? Math.PI - 0.35 : (h.pos[0] >= 0 ? Math.PI / 2 - 0.2 : -Math.PI / 2 + 0.2);
    tweenCam({ az, pol: 1.45, d: 52, tx: w.x, ty: w.y, tz: w.z }, 1.0);
    state.viewFace = side < 0 ? 'B' : 'A'; refreshFaceTabs(); updateHud();
  }
  function updatePins() {
    const w = innerWidth, h = innerHeight, v = new THREE.Vector3();
    const shift = $('#side').classList.contains('closed') ? 0 : 0;
    for (const p of pins) {
      const hs = p.h; v.set(hs.pos[0], hs.pos[1], hs.pos[2]); racket.root.localToWorld(v);
      const toCam = camera.position.clone().sub(v);
      const sign = hs.face === 'A' ? 1 : hs.face === 'B' ? -1 : 0;
      const facing = sign === 0 ? true : toCam.z * sign > 4;
      v.project(camera);
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      p.node.style.transform = `translate(${x}px,${y}px)`; p.node.style.left = 0; p.node.style.top = 0;
      const vis = p.on && facing && v.z < 1 && !anim; p.node.style.opacity = vis ? 1 : 0; p.node.style.pointerEvents = vis ? 'auto' : 'none';
    }
    const show = explode.t > 0.7 && state.mode === 'exploded', svg = $('#leaders');
    if (!ltags.length) return;
    if (!show) { for (const t of ltags) t.node.style.opacity = 0; svg.innerHTML = ''; return; }
    const A = ltags.map(t => { v.set(150, 300, t.L.z * explode.t); racket.root.localToWorld(v); v.project(camera); return [(v.x * 0.5 + 0.5) * w, (-v.y * 0.5 + 0.5) * h]; });
    const xR = Math.max(...A.map(p => p[0])) + 110, yC = A.reduce((s, p) => s + p[1], 0) / A.length;
    let lines = '';
    ltags.forEach((t, i) => {
      const ty = yC + (i - (ltags.length - 1) / 2) * 32;
      t.node.style.transform = `translate(${xR}px,${ty - 11}px)`; t.node.style.opacity = 1;
      lines += `<path d="M${A[i][0]},${A[i][1]} L${xR - 40},${ty} L${xR - 2},${ty}" fill="none" stroke="#1e8aa6" stroke-width="1" stroke-dasharray="3 3"/><circle cx="${A[i][0]}" cy="${A[i][1]}" r="2.5" fill="#19d3ff"/>`;
    });
    svg.innerHTML = lines;
  }

  /* ------------------------------------------------------------------ sidebar UI */
  const SWATCHES = ['#d11f3f', '#1b6fb0', '#f4b400', '#1fa56b', '#ff5a1f', '#8a4dff', '#2ee6a6', '#e8e8ea'];
  const RELIEFS = [['hex', 'Hexagon 3D'], ['star', 'Star grit'], ['spin', 'Spin blades'], ['sand', 'Micro-sand'], ['smooth', 'Glossy smooth']];
  const CORES = [['#141416', 'Black'], ['#f2f2f2', 'White'], ['#c8202e', 'Red'], ['#1b4fd8', 'Blue']];
  const timers = {};
  const sched = (key, fn) => { if (timers[key]) return; timers[key] = requestAnimationFrame(() => { timers[key] = 0; fn(); }); };
  function rebuildFace(side) { sched('face' + side, () => racket.setFace(side, state.faces[side], state.ui[side])); }
  function editFace(prop, val, redraw = true) {
    const sides = state.link ? ['A', 'B'] : [state.selFace];
    for (const s of sides) {
      if (prop === '_ui') continue;
      state.faces[s][prop] = val;
      if (prop === 'weave') { const kind = TEXGEN.WEAVES[val].kind; if ((kind === 'color' || kind === 'glass' || kind === 'alu') && !state.faces[s].tint) state.faces[s].tint = '#d11f3f'; }
      if (prop === 'relief' && val !== 'smooth' && !(state.faces[s].reliefStrength > 0.02)) state.faces[s].reliefStrength = 1;
      if (redraw) rebuildFace(s);
    }
  }
  function editUI(prop, val) { const sides = state.link ? ['A', 'B'] : [state.selFace]; for (const s of sides) { if (prop.startsWith('g_')) state.ui[s].groups[prop.slice(2)] = val; else state.ui[s][prop] = val; rebuildFace(s); } }

  const ctl = {};
  function slider(label, min, max, step, get, set, fmt = v => (+v).toFixed(2)) {
    const val = el('span', { class: 'val mono' }); const inp = el('input', { type: 'range', min, max, step });
    const upd = () => { inp.value = get(); val.textContent = fmt(get()); };
    inp.addEventListener('input', () => { set(+inp.value); val.textContent = fmt(+inp.value); });
    const wrap = el('div', {}, el('label', { class: 'f' }, label, val), inp); wrap.refresh = upd; upd(); return wrap;
  }
  function chips(items, get, set, cls = 'chips') {
    const box = el('div', { class: cls }); const btns = items.map(([v, t]) => { const b = el('button', {}, t); b.addEventListener('click', () => { set(v); upd(); }); b.dataset.v = v; box.append(b); return b; });
    const upd = () => btns.forEach(b => b.classList.toggle('on', b.dataset.v === String(get()))); box.refresh = upd; upd(); return box;
  }
  function swatches(list, get, set, onPick) {
    const box = el('div', { class: 'sw' }), btns = list.map(c => { const b = el('button', { style: `background:${c}`, title: c }); b.dataset.v = c; b.addEventListener('click', () => { set(c); upd(); }); box.append(b); return b; });
    const pick = el('input', { type: 'color' }); pick.addEventListener('input', () => { set(pick.value); upd(); }); box.append(pick);
    const upd = () => { const g = (get() || '').toLowerCase(); btns.forEach(b => b.classList.toggle('on', b.dataset.v === g)); try { pick.value = g; } catch (e) { } }; box.refresh = upd; upd(); return box;
  }
  function tog(label, get, set) { const i = el('input', { type: 'checkbox' }); i.checked = get(); i.addEventListener('change', () => set(i.checked)); const w = el('label', { class: 'tog' }, i, label); w.refresh = () => { i.checked = get(); }; return w; }
  function section(title, open, ...kids) { const d = el('details', {}, el('summary', {}, title), el('div', { class: 'sec' }, ...kids)); if (open) d.open = true; return d; }

  let faceBody;
  function buildUI() {
    const sc = $('#scroll'); sc.innerHTML = '';
    // mold
    const sel = el('select'); Object.values(MOLD_REGISTRY).forEach(m => sel.append(el('option', { value: m.id }, `${m.brand} ${m.model}`)));
    sel.addEventListener('change', () => loadMold(sel.value)); sel.value = state.moldId; ctl.moldSel = sel;
    const spec = el('table', { class: 'spec' }); ctl.spec = spec;
    ctl.tagline = el('div', { style: 'color:var(--mut);margin-top:8px;font-size:11.5px' });
    sc.append(section('Mold', true, el('label', { class: 'f' }, 'Racket mold'), sel, ctl.tagline, spec));
    // faces
    const tabs = chips([['A', 'Face A  -  Attack (+Z)'], ['B', 'Face B  -  Control (-Z)']], () => state.selFace, v => { state.selFace = v; state.viewFace = state.viewFace; refreshFaceControls(); }, 'seg');
    ctl.tabs = tabs;
    const link = tog('Link faces (symmetric racket)', () => state.link, v => { state.link = v; if (v) { const s = state.selFace, o = s === 'A' ? 'B' : 'A'; const keep = state.faces[o].decals; state.faces[o] = { ...clone(state.faces[s]), decals: keep }; rebuildFace(o); } });
    ctl.link = link;
    faceBody = el('div'); sc.append(section('Dual-face inspector', true, tabs, link, el('button', { class: 'btn', style: 'margin-top:10px', onclick: flip }, 'Flip camera A / B  (F)'), faceBody));
    refreshFaceControls();
    // graphics
    ctl.gfx = el('div'); sc.append(section('Graphics & decals', false, ctl.gfx)); buildGfx();
    // core & frame
    ctl.cf = el('div'); sc.append(section('EVA core & frame', false, ctl.cf)); buildCoreFrame();
    // scene
    sc.append(section('Studio & output', false,
      el('label', { class: 'f' }, 'Lighting environment'),
      chips([['studio', 'Studio'], ['arena', 'Arena'], ['neutral', 'Neutral']], () => state.scene.env, v => { state.scene.env = v; setEnv(v); }),
      slider('Exposure', 0.4, 2, 0.01, () => state.scene.exposure, v => { state.scene.exposure = v; renderer.toneMappingExposure = v; }),
      tog('Soft shadows', () => state.scene.shadows, v => { state.scene.shadows = v; key.castShadow = v; shadowCatch.visible = v; }),
      tog('Hotspot callouts', () => state.scene.hotspots, v => { state.scene.hotspots = v; pinsVisible(); }),
      el('label', { class: 'f' }, 'Grip colour'),
      swatches(['#16161a', '#e8e8ea', '#d11f3f', '#1b6fb0', '#2ee6a6'], () => state.grip, v => { state.grip = v; racket.setGripColor(v); }),
      el('div', { class: 'row', style: 'margin-top:14px' }, el('button', { class: 'btn', onclick: shot }, 'Save PNG'), el('button', { class: 'btn', onclick: copyCfg }, 'Copy config JSON'))
    ));
  }
  function buildGfx() {
    const b = ctl.gfx; b.innerHTML = '';
    const ui = () => state.ui[state.selFace];
    b.append(tog('Centre brand logo', () => ui().groups.logo, v => editUI('g_logo', v)), tog('Bridge typography', () => ui().groups.type, v => editUI('g_type', v)), tog('Accent stripes / rings', () => ui().groups.stripe, v => editUI('g_stripe', v)));
    const t = el('input', { type: 'text', placeholder: 'Custom wordmark (replaces logo)', maxlength: 14 }); t.value = ui().customText; t.addEventListener('input', () => editUI('customText', t.value.toUpperCase()));
    b.append(el('label', { class: 'f' }, 'Custom wordmark'), t, el('label', { class: 'f' }, 'Logo / ink colour'),
      swatches(['#f4f4f6', '#0a2a50', '#0b0b0e', '#f4b400', '#d11f3f'], () => ui().logoColor, v => editUI('logoColor', v)));
  }
  function buildCoreFrame() {
    const b = ctl.cf; b.innerHTML = '';
    const coreItems = CORES.map(([c, n]) => [c, n]).concat([['layered', 'Layered']]);
    b.append(el('label', { class: 'f' }, 'EVA core colour (visible inside every drilled hole)'),
      chips(coreItems, () => state.core.kind === 'layered' ? 'layered' : state.core.color, v => {
        if (v === 'layered') state.core = { kind: 'layered', color: '#ffffff', layers: [{ color: '#f2f2f2', from: 0, to: 0.3 }, { color: '#1a1a1c', from: 0.3, to: 0.7 }, { color: v === 'layered' ? '#ff5a1f' : v, from: 0.7, to: 1 }] };
        else state.core = { kind: 'solid', color: v };
        racket.setCore(state.core);
      }),
      el('label', { class: 'f' }, 'Frame finish'),
      chips([['gloss', 'Gloss'], ['matte', 'Matte']], () => state.frame.finish, v => { state.frame.finish = v; racket.setFrame(state.frame); }),
      el('label', { class: 'f' }, 'Frame weave'),
      chips([['3k-twill', '3K'], ['12k-flat', '12K'], ['18k-flat', '18K']], () => state.frame.weave, v => { state.frame.weave = v; racket.setFrame(state.frame); }),
      el('label', { class: 'f' }, 'Frame stripe colour'),
      swatches(SWATCHES, () => (state.frame.stripe || {}).color, v => { state.frame.stripe = state.frame.stripe || { from: 0.3, to: 0.36 }; state.frame.stripe.color = v; racket.setFrame(state.frame); }));
  }
  function refreshFaceControls() {
    const s = state.selFace, F = () => state.faces[s];
    faceBody.innerHTML = '';
    const weaveSel = el('select'); Object.entries(TEXGEN.WEAVES).forEach(([k, w]) => weaveSel.append(el('option', { value: k }, w.label)));
    weaveSel.value = F().weave; weaveSel.addEventListener('change', () => { editFace('weave', weaveSel.value); refreshFaceControls(); });
    const kind = TEXGEN.WEAVES[F().weave].kind, tintable = kind === 'color' || kind === 'glass' || kind === 'alu';
    const sw = swatches(SWATCHES, () => F().tint, v => editFace('tint', v));
    if (!tintable) sw.style.opacity = 0.35;
    faceBody.append(
      el('label', { class: 'f' }, 'Carbon weave / laminate'), weaveSel,
      el('label', { class: 'f' }, tintable ? 'Tint (threads / anodised coat)' : 'Tint (needs coloured carbon, glass or aluminised)'), sw,
      el('label', { class: 'f' }, '3D surface relief'),
      chips(RELIEFS, () => F().relief, v => { editFace('relief', v); refreshFaceControls(); }),
      slider('Relief strength', 0, 1.5, 0.01, () => F().reliefStrength == null ? 1 : F().reliefStrength, v => editFace('reliefStrength', v)),
      slider('Weave scale', 0.8, 4, 0.05, () => F().weaveScale || 1.8, v => editFace('weaveScale', v), v => (+v).toFixed(2) + 'x'),
      slider('Clear-coat gloss', 0, 1, 0.01, () => F().gloss == null ? 0.4 : F().gloss, v => editFace('gloss', v)),
      tog('Shiny mirror border', () => !!F().border, v => { editFace('border', v); refreshFaceControls(); }));
    if (F().border) faceBody.append(slider('Border width', 4, 26, 0.5, () => F().borderMm || 12, v => editFace('borderMm', v), v => (+v).toFixed(1) + ' mm'));
    ctl.tabs.refresh && ctl.tabs.refresh();
    if (ctl.gfx) buildGfx();
  }
  function refreshFaceTabs() { if (ctl.tabs) { ctl.tabs.refresh(); refreshFaceControls(); } }
  function refreshUI() {
    buildUI();
    ctl.spec.innerHTML = '';
    const S = mold.specs || {}, rows = [['Shape', S.shape], ['Weight', S.weightG && S.weightG + ' g'], ['Balance', S.balanceMm && S.balanceMm + ' mm'], ['Length', S.lengthMm && S.lengthMm + ' mm'], ['Width', S.widthMm && S.widthMm + ' mm'], ['Thickness', S.thicknessMm && S.thicknessMm + ' mm'], ['Core', S.core], ['Face A', S.faceA], ['Face B', S.faceB], ['Drilling', racket.geo.holes.length + ' holes']];
    rows.forEach(([k, v]) => v && ctl.spec.append(el('tr', {}, el('td', {}, k), el('td', {}, v))));
    ctl.tagline.textContent = mold.tagline || '';
  }

  /* ------------------------------------------------------------------ dock */
  function buildDock() {
    const d = $('#dock'); d.innerHTML = '';
    const B = (t, k, fn, attrs = {}) => { const b = el('button', attrs, el('span', {}, t), k ? el('kbd', {}, k) : null); b.addEventListener('click', fn); return b; };
    d.append(
      el('div', { class: 'g' }, B('Flip A/B', 'F', flip, { id: 'bFlip' }), B('Reset view', 'R', () => tweenCam(homeView(state.viewFace), 1))),
      el('div', { class: 'g' }, ...[['studio', 'Studio', '1'], ['exploded', 'Exploded CAD', '2'], ['heat', 'Heatmap', '3'], ['wire', 'Wireframe', '4'], ['xray', 'X-Ray', '5']].map(([m, t, k]) => { const b = B(t, k, () => setMode(state.mode === m && m !== 'studio' ? 'studio' : m)); b.dataset.mode = m; return b; })),
      el('div', { class: 'g' }, B('Air smash', 'S', smash, { id: 'bSmash' }), B('360 turntable', 'T', toggleTurntable, { id: 'bTurn' })));
    const sub = $('#sub'); sub.innerHTML = '';
    const seg = chips([['sweet', 'Sweet spot'], ['flex', 'Flex / stiffness']], () => state.heatKind, v => { state.heatKind = v; racket.setHeatKind(v); }, 'seg'); seg.style.minWidth = '260px';
    const air = tog('Airflow vectors', () => state.airflow, v => { state.airflow = v; racket.airflowOn = v; if (racket.airflow) racket.airflow.visible = v && state.mode === 'heat'; });
    sub.append(seg, air);
  }
  function syncDock() { const t = $('#bTurn'); if (t) t.classList.toggle('on', turntable); }
  addEventListener('keydown', e => {
    if (/input|textarea|select/i.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'f') flip(); else if (k === 's') smash(); else if (k === 't') toggleTurntable(); else if (k === 'r') tweenCam(homeView(state.viewFace), 1);
    else if ('12345'.includes(k) && k) setMode(['studio', 'exploded', 'heat', 'wire', 'xray'][+k - 1]);
  });
  $('#sidetog').addEventListener('click', () => { $('#side').classList.toggle('closed'); setTimeout(resize, 0); gsap.delayedCall(0.4, resize); });

  /* ------------------------------------------------------------------ output */
  function shot() { renderer.render(scene, camera); canvas.toBlob(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `${mold.id}-${state.viewFace}.png`; a.click(); toast('PNG saved'); }); }
  function copyCfg() {
    const cfg = JSON.stringify({ mold: mold.id, faces: state.faces, core: state.core, frame: state.frame, grip: state.grip, ui: state.ui }, null, 1);
    (navigator.clipboard ? navigator.clipboard.writeText(cfg) : Promise.reject()).then(() => toast('Config copied'), () => { const t = document.createElement('textarea'); t.value = cfg; document.body.append(t); t.select(); try { document.execCommand('copy'); toast('Config copied'); } catch (e) { toast('Copy failed'); } t.remove(); });
  }

  /* ------------------------------------------------------------------ main loop */
  const clock = new THREE.Clock(); let frames = 0, fpsT = 0;
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    if (racket) {
      racket.heatUniforms.uTime.value = t; racket.updateAirflow(t);
      if (!anim && state.mode !== 'exploded') rig.position.y = Math.sin(t * 0.9) * 0.35;
      if (anim && trail.active) { tmpA.set(0, 458, 0); tmpB.set(0, 372, 0); racket.root.localToWorld(tmpA); racket.root.localToWorld(tmpB); trail.push(tmpA, tmpB); }
      updatePins();
    }
    controls.update(); renderer.render(scene, camera);
    frames++; fpsT += dt; if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' FPS  ·  ' + renderer.info.render.triangles.toLocaleString() + ' tris'; frames = 0; fpsT = 0; }
  }

  /* ------------------------------------------------------------------ boot */
  setEnv('studio'); resize(); buildDock();
  const first = Object.keys(MOLD_REGISTRY)[0];
  requestAnimationFrame(() => setTimeout(() => {
    loadMold(first, false);
    $('#busy').style.opacity = 0; setTimeout(() => $('#busy').remove(), 600);
    frame();
  }, 30));
  window.PADEL = { MOLD_REGISTRY, registerMold, state, loadMold, setMode, flip, smash, toggleTurntable, get racket() { return racket; }, scene, camera, controls, renderer, tweenCam, homeView, editFace, rig, swing };
})();
