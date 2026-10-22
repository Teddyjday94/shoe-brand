// HOME: scroll-driven 3D inspection with hotspots + buy panel
import * as THREE from 'three';
import { $, clamp, lerp, ease, pad, wait, flashClass, sizePicker, cart } from './ui.js';
import { SHOES, shoeById } from './data.js';
import { loadShoe, applyStudio, contactShadow } from './shoe.js';

/* ── inspection steps: camera pos, look target, shoe yaw/roll (copy comes from each shoe) ── */
const STEPS = [
  { mega: null, title: 'THE WHOLE<br>OBJECT',
    cam: [3.4, 1.5, 4.4], look: [0, 0.25, 0], yaw: -0.5, roll: 0 },
  { mega: ['TOE', 'BOX'], title: 'TOE BOX /<br>01', spot: 'TOE BOX',
    cam: [4.4, 1.3, 2.8], look: [0.8, 0.3, 0], yaw: -0.2, roll: 0 },
  { mega: ['LACE', 'LOCK'], title: 'LACING /<br>02', spot: 'LACING',
    cam: [0.8, 4.8, 2.6], look: [0.1, 0.4, 0], yaw: 0.3, roll: 0 },
  { mega: ['HEEL', 'CUP'], title: 'HEEL /<br>03', spot: 'HEEL CUP',
    cam: [-4.4, 1.6, 2.8], look: [-0.7, 0.4, 0], yaw: 0.1, roll: 0 },
  { mega: ['OUT', 'SOLE'], title: 'OUTSOLE /<br>04', spot: 'MIDSOLE / OUTSOLE',
    cam: [0.4, 1.4, 5.6], look: [0, 0.5, 0], yaw: 0.15, roll: -Math.PI * 0.62 },
];

/* ── which shoe + colorway: ?s=hi1&c=2 (old links used ?v= for the MK-1 colorway) ── */
const qs = new URLSearchParams(location.search);
let shoe = shoeById(qs.get('s'));
let cwIndex = clamp(+(qs.get('c') ?? qs.get('v') ?? 0) || 0, 0, shoe.colorways.length - 1);

/* ── loader overlay: the boot sequence plays once per session ── */
const booted = document.documentElement.classList.contains('booted');
if (booted) { $('#loader').remove(); document.documentElement.classList.remove('is-loading'); }
const loader = {
  log(text, state = '') {
    const li = document.createElement('li');
    li.innerHTML = `<span>&gt; ${text}</span><b>${state}</b>`;
    $('#loader-log')?.append(li);
    return li;
  },
  pct(p) {
    if (booted) return;
    $('#loader-pct').textContent = pad(Math.round(p * 100), 3);
    $('#loader-bar').style.width = (p * 100).toFixed(1) + '%';
  },
  async done() {
    try { sessionStorage.setItem('slab-booted', '1'); } catch { /* private mode: boot every time */ }
    if (booted) return;
    await wait(300);
    $('#loader').classList.add('out');
    document.documentElement.classList.remove('is-loading');
    await wait(950);
    $('#loader').remove();
  },
};
loader.log('MOUNTING SUBSTRATE', 'OK');
const meshLine = loader.log(`FETCHING ${shoe.name} / ${(shoe.bytes / 1e6).toFixed(1)} MB`, '...');

/* ── renderer / scene ── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
// phones have 3x screens; 1.5x keeps the shadowed render at full frame rate while scrolling
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
// Khronos PBR Neutral: keeps product colour true and blacks deep (ACES washed the new shoes out)
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
applyStudio(renderer, scene);
scene.environmentIntensity = 0.6;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
camera.position.set(...STEPS[0].cam);

// hard "on-camera flash" key light + hard floor shadow
const flash = new THREE.DirectionalLight(0xffffff, 2.6);
flash.position.set(2.5, 6, 3);
flash.castShadow = true;
flash.shadow.mapSize.setScalar(coarse ? 1024 : 2048);
flash.shadow.bias = -0.0003;
Object.assign(flash.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
// cool rim from behind: pulls the silhouette off the paper and shows surface relief
const rim = new THREE.DirectionalLight(0xdfe8ff, 1.3);
rim.position.set(-4, 3.5, -4.5);
scene.add(flash, rim, new THREE.AmbientLight(0xffffff, 0.25));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.85, color: 0x0d0d0d }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);
const contactG = new THREE.Group(); // turns with the shoe, stays on the floor
scene.add(contactG);

const pivot = new THREE.Group(); // yaw + roll applied here
scene.add(pivot);

/* ── load / swap shoes ── */
let model = null, loadToken = 0;
const wireMat = new THREE.MeshBasicMaterial({ color: 0xe61919, wireframe: true });
const product = () => ({ ...shoe.colorways[cwIndex], shoe, key: `${shoe.id}-${shoe.colorways[cwIndex].key}` });

async function showShoe(def, onProgress = () => {}) {
  const token = ++loadToken;
  const stageEl = $('.stage'), ls = $('#load-state');
  stageEl.classList.add('is-swapping');
  ls.classList.remove('done');
  ls.textContent = `LOADING ${def.name} ......`;
  const m = await loadShoe(def, (p) => {
    onProgress(p);
    const n = Math.round(p * 6);
    ls.textContent = `LOADING ${def.name} ` + '■'.repeat(n) + '.'.repeat(6 - n);
  });
  if (token !== loadToken) { m.dispose(); return; } // a newer pick won the race
  if (model) { pivot.remove(model.root); model.dispose(); }
  model = m;
  contactG.clear();
  contactG.add(contactShadow(m.root)); // measure before it joins the rotated pivot
  pivot.add(m.root);
  if ($('#wire').checked) m.setWire(wireMat);
  await m.setColorway(shoe.colorways[cwIndex]);
  buildHotspots();
  $('#t-tris').textContent = m.tris.toLocaleString('en');
  $('#unit').textContent = `UNIT / ${def.name}`;
  ls.textContent = `${def.name} LOADED ■■■■■■`;
  ls.classList.add('done');
  stageEl.classList.remove('is-swapping');
}

function syncUrl() {
  const u = new URL(location.href);
  u.search = shoe.id === SHOES[0].id && cwIndex === 0 ? '' : `?s=${shoe.id}&c=${cwIndex}`;
  history.replaceState(null, '', u);
}

function pickShoe(def) {
  if (def === shoe) return;
  shoe = def; cwIndex = 0; buySize = null;
  stepShown = -1; // re-render step 0's headline with the new name
  renderPickers();
  syncUrl();
  showShoe(def).catch(() => { $('#load-state').textContent = 'MESH FAILED. TRY AGAIN.'; });
}

function pickColorway(i) {
  cwIndex = i; buySize = null;
  renderPickers();
  syncUrl();
  model?.setColorway(shoe.colorways[i]);
}

showShoe(shoe, (p) => loader.pct(p * 0.95)).then(() => {
  meshLine.querySelector('b').textContent = 'OK';
  loader.log('READY. DO NOT MACHINE WASH.', '■');
  loader.pct(1);
  loader.done();
}).catch(() => {
  meshLine.querySelector('b').textContent = 'FAIL';
  loader.log('MESH FAILED. RELOAD THE PAGE.', '×');
});

$('#wire').addEventListener('change', (e) => model?.setWire(e.target.checked ? wireMat : null));

/* ── shoe + colorway pickers, buy panel ── */
function renderPickers() {
  $('#shoes').replaceChildren(...SHOES.map((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.innerHTML = `<b>${s.name}</b><small>${s.type}</small>`;
    b.setAttribute('aria-pressed', s === shoe);
    b.addEventListener('click', () => pickShoe(s));
    return b;
  }));
  $('#variants').replaceChildren(...shoe.colorways.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = pad(i + 1) + ' ' + c.name;
    b.setAttribute('aria-pressed', i === cwIndex);
    b.addEventListener('click', () => pickColorway(i));
    return b;
  }));
  updateBuy();
}

let buySize = null;
function updateBuy() {
  const p = product();
  sizePicker($('#buy-sizes'), p, (s) => { buySize = s; $('#buy-size-msg').textContent = ''; }, buySize);
  $('#buy-name').textContent = `${shoe.name} ${p.name} / ${p.stock ? pad(p.stock) + ' LEFT' : 'SOLD OUT'}`;
  $('#buy-price').textContent = '€' + p.price;
  $('#buy-tryon').href = `tryon.html?s=${shoe.id}&c=${cwIndex}`;
  const btn = $('#buy-btn');
  btn.disabled = p.stock === 0;
  btn.textContent = p.stock === 0 ? 'GONE. SORRY.' : 'RESERVE >>>';
}
$('#buy-btn').addEventListener('click', () => {
  if (!buySize) {
    $('#buy-size-msg').textContent = '← PICK ONE';
    flashClass($('#buy-sizes'), 'shake');
    return;
  }
  cart.add(product().key, buySize);
});
renderPickers();

/* ── 3D hotspots: surface points found by raycasting, projected to DOM each frame ── */
const ray = new THREE.Raycaster();
const spots = [];
function buildHotspots() {
  spots.length = 0;
  $('#hotspots').replaceChildren();
  pivot.rotation.set(0, 0, 0); pivot.position.set(0, 0, 0);
  pivot.updateMatrixWorld(true);
  const probes = [
    [1, [6, 0.35, 0], [-1, 0, 0]],      // toe: from the front
    [2, [0.35, 6, 0], [0, -1, 0]],      // laces: from above
    [3, [-6, 0.55, 0], [1, 0, 0]],      // heel: from behind
    [4, [0.1, 0.12, 6], [0, 0, -1]],    // midsole: from the side
  ];
  probes.forEach(([step, from, dir]) => {
    ray.set(new THREE.Vector3(...from), new THREE.Vector3(...dir));
    const hit = ray.intersectObject(model.root, true)[0];
    if (!hit) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    b.innerHTML = `<i>${pad(step)}</i><span>${STEPS[step].spot}</span>`;
    b.setAttribute('aria-label', `Inspect ${STEPS[step].spot}`);
    b.addEventListener('click', () => scrollToStep(step));
    $('#hotspots').append(b);
    spots.push({ step, el: b, local: pivot.worldToLocal(hit.point.clone()), hidden: false });
  });
}
const tmp = new THREE.Vector3();
// canvas box relative to the stage — measured on resize, never per frame (avoids forced layout)
const box = { x: 0, y: 0, w: 1, h: 1 };
function updateHotspots(stepNow, frameNo) {
  if (!spots.length) return;
  const rolled = Math.abs(pivot.rotation.x) > 0.3;
  spots.forEach((s) => {
    tmp.copy(s.local);
    pivot.localToWorld(tmp);
    // occlusion check every few frames: anything between camera and the point?
    if (frameNo % 6 === 0) {
      const dist = tmp.distanceTo(camera.position);
      ray.set(camera.position, tmp.clone().sub(camera.position).normalize());
      const hit = ray.intersectObject(model.root, true)[0];
      s.hidden = rolled || (hit && hit.distance < dist - 0.06);
    }
    const p = tmp.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * box.w + box.x;
    const y = (-p.y * 0.5 + 0.5) * box.h + box.y;
    s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    s.el.classList.toggle('is-hidden', s.hidden || p.z > 1);
    s.el.classList.toggle('is-active', s.step === stepNow);
    s.el.classList.toggle('is-overview', stepNow === 0);
  });
}

/* ── drag to rotate (adds to scroll yaw, with inertia) ──
   Touch only counts as a drag once the finger is clearly moving sideways,
   so a vertical scroll that starts on the shoe doesn't spin it. */
let dragYaw = 0, dragVel = 0, dragging = false, pending = null, lastX = 0;
canvas.addEventListener('pointerdown', (e) => {
  dragVel = 0;
  if (e.pointerType === 'touch') { pending = { id: e.pointerId, x: e.clientX, y: e.clientY }; return; }
  dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (pending && e.pointerId === pending.id) {
    const dx = e.clientX - pending.x, dy = e.clientY - pending.y;
    if (Math.abs(dy) > 8) { pending = null; return; }            // it's a scroll
    if (Math.abs(dx) > 10) { pending = null; dragging = true; lastX = e.clientX; }
    else return;
  }
  if (!dragging) return;
  const dx = (e.clientX - lastX) * 0.008;
  dragYaw += dx; dragVel = dx; lastX = e.clientX;
});
const endDrag = () => { dragging = false; pending = null; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', () => { endDrag(); dragVel = 0; }); // browser took the gesture for scrolling

/* ── scroll progress through the inspection section ──
   Measured from cached offsets + scrollY (no layout reads on scroll), and against the
   sticky stage's own height rather than innerHeight, which jumps when mobile toolbars collapse. */
const section = $('#inspect'), stage = $('.stage');
const range = { top: 0, len: 1, stick: 0 };
let progress = 0, smooth = 0, stepShown = -1;
function measure() {
  range.stick = parseFloat(getComputedStyle(stage).top) || 0;
  range.top = section.offsetTop;
  range.len = Math.max(1, section.offsetHeight - stage.offsetHeight);
  const cr = canvas.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  Object.assign(box, { x: cr.left - sr.left, y: cr.top - sr.top, w: cr.width, h: cr.height });
}
function readScroll() {
  progress = clamp((scrollY + range.stick - range.top) / range.len, 0, 1);
}
addEventListener('scroll', readScroll, { passive: true });

function scrollToStep(i) {
  const top = range.top - range.stick + range.len * (i / (STEPS.length - 1));
  scrollTo({ top: top + 1, behavior: 'smooth' });
}

function showStep(i) {
  if (i === stepShown) return;
  stepShown = i;
  const s = STEPS[i];
  const mega = $('#mega');
  const words = s.mega || ['SLAB', shoe.name.replace('-', '—') + '<sup>®</sup>'];
  mega.innerHTML = words.map((t) => `<span>${t}</span>`).join('');
  flashClass(mega, 'glitch');
  $('#step-num').textContent = pad(i + 1);
  $('#step-title').innerHTML = s.title;
  $('#step-copy').textContent = shoe.steps[i];
}

/* ── resize ── */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // pull back on narrow/tall viewports so the shoe fits
  camera.zoom = camera.aspect < 1 ? 0.62 : 1;
  camera.updateProjectionMatrix();
  measure();
  readScroll();
}
new ResizeObserver(resize).observe(canvas);
new ResizeObserver(() => { measure(); readScroll(); }).observe(document.body);

/* ── loop ── */
const v3 = (a) => new THREE.Vector3(...a);
const look = new THREE.Vector3(...STEPS[0].look);
const progressBar = $('#progress-bar');
const tele = { x: $('#t-x'), y: $('#t-y'), z: $('#t-z'), yaw: $('#t-yaw') };
let frames = 0, fpsT = performance.now(), frameNo = 0, stageVisible = true, lastT = performance.now();
new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; }).observe(canvas);
const teleOn = () => $('.tele').offsetParent !== null; // hidden on phones: skip its DOM writes
let showTele = true;

function frame(t) {
  requestAnimationFrame(frame);
  frameNo++;
  // frame-rate independent damping, so 60Hz and 120Hz screens feel the same
  const dt = Math.min((t - lastT) / 1000, 0.1);
  lastT = t;
  if (!stageVisible) return;

  // glide toward the scroll position instead of following each (uneven) scroll event
  smooth += (progress - smooth) * (1 - Math.exp(-dt * 7));
  if (Math.abs(progress - smooth) < 1e-4) smooth = progress;

  const f = smooth * (STEPS.length - 1);
  const i = Math.min(Math.floor(f), STEPS.length - 2);
  const u = clamp(f - i, 0, 1);
  const k = lerp(u, ease(u), 0.5); // half-eased: moves the whole way, no parking at each step
  const A = STEPS[i], B = STEPS[i + 1];
  const stepNow = Math.round(f);
  showStep(stepNow);

  const follow = 1 - Math.exp(-dt * 10);
  camera.position.lerp(v3(A.cam).lerp(v3(B.cam), k), follow);
  look.lerp(v3(A.look).lerp(v3(B.look), k), follow);
  camera.lookAt(look);

  if (!dragging) { dragYaw += dragVel * dt * 60; dragVel *= Math.exp(-dt * 3.7); }
  const idle = Math.sin(t * 0.0004) * 0.06;
  pivot.rotation.y = lerp(A.yaw, B.yaw, k) + dragYaw + idle;
  pivot.rotation.x = lerp(A.roll, B.roll, k);
  pivot.position.y = Math.abs(Math.sin(pivot.rotation.x)) * 0.75;
  floor.visible = contactG.visible = Math.abs(pivot.rotation.x) < 0.2;
  contactG.rotation.y = pivot.rotation.y;

  renderer.render(scene, camera);
  pivot.updateMatrixWorld(true);
  updateHotspots(stepNow, frameNo);

  progressBar.style.transform = `scaleX(${smooth.toFixed(4)})`;
  if (frameNo % 30 === 0) showTele = teleOn();
  if (showTele && frameNo % 4 === 0) {
    tele.x.textContent = camera.position.x.toFixed(2);
    tele.y.textContent = camera.position.y.toFixed(2);
    tele.z.textContent = camera.position.z.toFixed(2);
    tele.yaw.textContent = pad(((THREE.MathUtils.radToDeg(pivot.rotation.y) % 360) + 360) % 360 | 0, 3) + '°';
  }
  frames++;
  if (t - fpsT > 500) {
    const fps = Math.round((frames * 1000) / (t - fpsT));
    const el = $('#t-fps');
    el.textContent = pad(fps);
    el.className = fps > 40 ? 'ok' : 'red';
    frames = 0; fpsT = t;
  }
}
measure();
readScroll();
smooth = progress; // landing mid-section (reload, back button) shouldn't fly in from step 1
requestAnimationFrame(frame);
