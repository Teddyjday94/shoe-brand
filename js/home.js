// HOME: scroll-driven 3D inspection with hotspots + buy panel
import * as THREE from 'three';
import { $, $$, clamp, lerp, ease, pad, wait, flashClass, sizePicker, cart } from './ui.js';
import { PRODUCTS, productByVariant } from './data.js';
import { loadShoe, studioEnvironment } from './shoe.js';

/* ── inspection steps: camera pos, look target, shoe yaw/roll ── */
const STEPS = [
  { mega: ['SLAB', 'MK—1<sup>®</sup>'], title: 'THE WHOLE<br>OBJECT',
    copy: 'One shoe. 412 grams. No air bubble, no story about a mountain. Just a sole you could build a wall on.',
    cam: [3.4, 1.5, 4.4], look: [0, 0.25, 0], yaw: -0.5, roll: 0 },
  { mega: ['TOE', 'BOX'], title: 'TOE BOX /<br>01', spot: 'TOE BOX',
    copy: 'Suede over mesh over a TPU cage. Kick a kerb. Kick another one. The cage is there so you can stop being careful.',
    cam: [4.4, 1.3, 2.8], look: [0.8, 0.3, 0], yaw: -0.2, roll: 0 },
  { mega: ['LACE', 'LOCK'], title: 'LACING /<br>02', spot: 'LACING',
    copy: '140cm of flat waxed cord through seven eyelets. Tie it once in October. Untie it in March.',
    cam: [0.8, 4.8, 2.6], look: [0.1, 0.4, 0], yaw: 0.3, roll: 0 },
  { mega: ['HEEL', 'CUP'], title: 'HEEL /<br>03', spot: 'HEEL CUP',
    copy: 'A moulded counter that holds your heel like a vice holds a pipe. Firm for the first fortnight. Then it is yours.',
    cam: [-4.4, 1.6, 2.8], look: [-0.7, 0.4, 0], yaw: 0.1, roll: 0 },
  { mega: ['OUT', 'SOLE'], title: 'OUTSOLE /<br>04', spot: 'MIDSOLE / OUTSOLE',
    copy: '4mm lugs in hazard rubber. Grip on wet ramps, gravel, oil. The pattern is not decorative. Nothing here is.',
    cam: [0.4, 1.4, 5.6], look: [0, 0.5, 0], yaw: 0.15, roll: -Math.PI * 0.62 },
];

/* ── loader overlay ── */
const loader = {
  log(text, state = '') {
    const li = document.createElement('li');
    li.innerHTML = `<span>&gt; ${text}</span><b>${state}</b>`;
    $('#loader-log').append(li);
    return li;
  },
  pct(p) {
    $('#loader-pct').textContent = pad(Math.round(p * 100), 3);
    $('#loader-bar').style.width = (p * 100).toFixed(1) + '%';
  },
  async done() {
    await wait(300);
    $('#loader').classList.add('out');
    document.documentElement.classList.remove('is-loading');
    await wait(900);
    $('#loader').remove();
  },
};
loader.log('MOUNTING SUBSTRATE', 'OK');
const meshLine = loader.log('FETCHING MESH / 7.8 MB', '...');

/* ── renderer / scene ── */
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.environment = studioEnvironment(renderer);
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
camera.position.set(...STEPS[0].cam);

// hard "on-camera flash" key light + hard floor shadow
const flash = new THREE.DirectionalLight(0xffffff, 2.6);
flash.position.set(2.5, 6, 3);
flash.castShadow = true;
flash.shadow.mapSize.set(1024, 1024);
Object.assign(flash.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
scene.add(flash, new THREE.AmbientLight(0xffffff, 0.25));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.85, color: 0x0d0d0d }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const pivot = new THREE.Group(); // yaw + roll applied here
scene.add(pivot);

/* ── load ── */
let model = null, currentVariant = clamp(+(new URLSearchParams(location.search).get('v') || 0), 0, PRODUCTS.length - 1);
const wireMat = new THREE.MeshBasicMaterial({ color: 0xe61919, wireframe: true });

loadShoe((p) => loader.pct(p * 0.95)).then(async (m) => {
  model = m;
  meshLine.querySelector('b').textContent = 'OK';
  pivot.add(m.root);
  $('#t-tris').textContent = m.tris.toLocaleString('en');
  $('#load-state').textContent = 'MESH LOADED ■■■■■■';
  $('#load-state').classList.add('done');
  buildHotspots();
  await selectVariant(currentVariant);
  loader.log('READY. DO NOT MACHINE WASH.', '■');
  loader.pct(1);
  loader.done();
}).catch(() => {
  meshLine.querySelector('b').textContent = 'FAIL';
  loader.log('MESH FAILED. RELOAD THE PAGE.', '×');
});

async function selectVariant(i) {
  currentVariant = i;
  $$('#variants button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  updateBuy();
  if (model) await model.selectVariant(i);
}

$('#wire').addEventListener('change', (e) => model?.setWire(e.target.checked ? wireMat : null));

/* ── colorway + buy panel ── */
PRODUCTS.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = pad(p.variant + 1) + ' ' + p.name;
  b.setAttribute('aria-pressed', p.variant === currentVariant);
  b.addEventListener('click', () => { buySize = null; selectVariant(p.variant); });
  $('#variants').append(b);
});

let buySize = null;
function updateBuy() {
  const p = productByVariant(currentVariant);
  sizePicker($('#buy-sizes'), p, (s) => { buySize = s; $('#buy-size-msg').textContent = ''; }, buySize);
  $('#buy-name').textContent = `${p.name} / ${p.stock ? pad(p.stock) + ' LEFT' : 'SOLD OUT'}`;
  $('#buy-price').textContent = '€' + p.price;
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
  cart.add(productByVariant(currentVariant).key, buySize);
});
updateBuy();

/* ── 3D hotspots: surface points found by raycasting, projected to DOM each frame ── */
const ray = new THREE.Raycaster();
const spots = [];
function buildHotspots() {
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
function updateHotspots(stepNow, frameNo) {
  if (!spots.length) return;
  const cr = canvas.getBoundingClientRect(), sr = canvas.parentElement.getBoundingClientRect();
  const rolled = Math.abs(pivot.rotation.x) > 0.3;
  spots.forEach((s) => {
    tmp.copy(s.local);
    pivot.localToWorld(tmp);
    // occlusion check every few frames: anything between camera and the point?
    if (frameNo % 4 === 0) {
      const dist = tmp.distanceTo(camera.position);
      ray.set(camera.position, tmp.clone().sub(camera.position).normalize());
      const hit = ray.intersectObject(model.root, true)[0];
      s.hidden = rolled || (hit && hit.distance < dist - 0.06);
    }
    const p = tmp.clone().project(camera);
    const x = (p.x * 0.5 + 0.5) * cr.width + (cr.left - sr.left);
    const y = (-p.y * 0.5 + 0.5) * cr.height + (cr.top - sr.top);
    s.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    s.el.classList.toggle('is-hidden', s.hidden || p.z > 1);
    s.el.classList.toggle('is-active', s.step === stepNow);
    s.el.classList.toggle('is-overview', stepNow === 0);
  });
}

/* ── drag to rotate (adds to scroll yaw, with inertia) ── */
let dragYaw = 0, dragVel = 0, dragging = false, lastX = 0;
canvas.addEventListener('pointerdown', (e) => { dragging = true; lastX = e.clientX; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = (e.clientX - lastX) * 0.008;
  dragYaw += dx; dragVel = dx; lastX = e.clientX;
});
const endDrag = () => { dragging = false; };
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

/* ── scroll progress through the inspection section ── */
const section = $('#inspect');
let progress = 0, stepShown = -1;
function readScroll() {
  const r = section.getBoundingClientRect();
  progress = clamp(-r.top / (r.height - innerHeight), 0, 1);
}
addEventListener('scroll', readScroll, { passive: true });

function scrollToStep(i) {
  const top = section.offsetTop + (section.offsetHeight - innerHeight) * (i / (STEPS.length - 1));
  scrollTo({ top: top + 1, behavior: 'smooth' });
}

function showStep(i) {
  if (i === stepShown) return;
  stepShown = i;
  const s = STEPS[i];
  const mega = $('#mega');
  mega.innerHTML = s.mega.map((t) => `<span>${t}</span>`).join('');
  flashClass(mega, 'glitch');
  $('#step-num').textContent = pad(i + 1);
  $('#step-title').innerHTML = s.title;
  $('#step-copy').textContent = s.copy;
}

/* ── resize ── */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // pull back on narrow/tall viewports so the shoe fits
  camera.zoom = camera.aspect < 1 ? 0.62 : 1;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

/* ── loop ── */
const v3 = (a) => new THREE.Vector3(...a);
const look = new THREE.Vector3();
let frames = 0, fpsT = performance.now(), frameNo = 0, stageVisible = true;
new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; }).observe(canvas);

function frame(t) {
  requestAnimationFrame(frame);
  frameNo++;
  if (!stageVisible) return;

  const f = progress * (STEPS.length - 1);
  const i = Math.min(Math.floor(f), STEPS.length - 2);
  const k = ease(clamp(f - i, 0, 1));
  const A = STEPS[i], B = STEPS[i + 1];
  const stepNow = Math.round(f);
  showStep(stepNow);

  camera.position.lerp(v3(A.cam).lerp(v3(B.cam), k), 0.12);
  look.lerp(v3(A.look).lerp(v3(B.look), k), 0.12);
  camera.lookAt(look);

  if (!dragging) { dragYaw += dragVel; dragVel *= 0.94; }
  const idle = Math.sin(t * 0.0004) * 0.06;
  pivot.rotation.y = lerp(A.yaw, B.yaw, k) + dragYaw + idle;
  pivot.rotation.x = lerp(A.roll, B.roll, k);
  pivot.position.y = Math.abs(Math.sin(pivot.rotation.x)) * 0.75;
  floor.visible = Math.abs(pivot.rotation.x) < 0.2;

  renderer.render(scene, camera);
  pivot.updateMatrixWorld(true);
  updateHotspots(stepNow, frameNo);

  $('#progress-bar').style.width = (progress * 100).toFixed(1) + '%';
  $('#t-x').textContent = camera.position.x.toFixed(2);
  $('#t-y').textContent = camera.position.y.toFixed(2);
  $('#t-z').textContent = camera.position.z.toFixed(2);
  $('#t-yaw').textContent = pad(((THREE.MathUtils.radToDeg(pivot.rotation.y) % 360) + 360) % 360 | 0, 3) + '°';
  frames++;
  if (t - fpsT > 500) {
    const fps = Math.round((frames * 1000) / (t - fpsT));
    const el = $('#t-fps');
    el.textContent = pad(fps);
    el.className = fps > 40 ? 'ok' : 'red';
    frames = 0; fpsT = t;
  }
}
readScroll();
requestAnimationFrame(frame);
