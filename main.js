import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const pad = (n, l = 2) => String(n).padStart(l, '0');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const flashClass = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

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

/* ── product data ── */
const SIZES = [38, 39, 40, 41, 42, 43, 44, 45, 46];
const PRODUCT_META = {
  midnight: { price: 189, stock: 12, gone: [46], note: 'NIGHT SHIFT' },
  beach: { price: 179, stock: 3, gone: [38, 44, 45], note: 'SALT DAMAGE' },
  street: { price: 169, stock: 0, gone: SIZES, note: 'ALREADY GONE' },
};
const metaFor = (name) => PRODUCT_META[name.toLowerCase()] || { price: 175, stock: 7, gone: [], note: '' };

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
    await wait(350);
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
renderer.shadowMap.type = THREE.PCFShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 100);
camera.position.set(...STEPS[0].cam);

// hard "on-camera flash" key light + hard floor shadow
const flash = new THREE.DirectionalLight(0xffffff, 2.6);
flash.position.set(2.5, 6, 3);
flash.castShadow = true;
flash.shadow.mapSize.set(1024, 1024);
Object.assign(flash.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
flash.shadow.radius = 1;
scene.add(flash, new THREE.AmbientLight(0xffffff, 0.25));

const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.85, color: 0x0d0d0d }));
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// visible only to the CCTV camera (layer 1)
const grid = new THREE.GridHelper(14, 28, 0xffffff, 0x777777);
grid.layers.set(1);
scene.add(grid);

const pivot = new THREE.Group(); // yaw + roll applied here
scene.add(pivot);

/* ── load model ── */
let shoe, parser, variantNames = [], currentVariant = 0;
const thumbs = [];
const wireMat = new THREE.MeshBasicMaterial({ color: 0xe61919, wireframe: true });

new GLTFLoader().load('assets/shoe.glb', async (gltf) => {
  shoe = gltf.scene;
  parser = gltf.parser;
  meshLine.querySelector('b').textContent = 'OK';

  // normalise: longest horizontal axis → X, length 3 units, sitting on y=0
  let box = new THREE.Box3().setFromObject(shoe);
  let size = box.getSize(new THREE.Vector3());
  if (size.z > size.x) shoe.rotation.y = Math.PI / 2;
  box = new THREE.Box3().setFromObject(shoe);
  size = box.getSize(new THREE.Vector3());
  shoe.scale.multiplyScalar(3 / size.x);
  box = new THREE.Box3().setFromObject(shoe);
  const c = box.getCenter(new THREE.Vector3());
  shoe.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));
  shoe.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.mat = o.material; } });
  const holder = new THREE.Group();
  holder.add(shoe);
  pivot.add(holder);

  // toe always points +X: the heel collar is the tallest part, so flip if it's on +X
  if (heightNear(1.1) > heightNear(-1.1)) holder.rotation.y = Math.PI;

  const ext = gltf.userData.gltfExtensions?.KHR_materials_variants;
  variantNames = ext ? ext.variants.map((v) => v.name) : ['DEFAULT'];

  let tris = 0;
  shoe.traverse((o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  $('#t-tris').textContent = Math.round(tris).toLocaleString('en');
  $('#load-state').textContent = 'MESH LOADED ■■■■■■';
  $('#load-state').classList.add('done');

  buildHotspots();
  const pourLine = loader.log(`POURING ${variantNames.length} COLORWAYS`, '...');
  for (let i = 0; i < variantNames.length; i++) thumbs[i] = await snapshot(i);
  pourLine.querySelector('b').textContent = 'OK';
  await selectVariant(0);
  buildVariantUI();
  buildProducts();
  loader.log('READY. DO NOT MACHINE WASH.', '■');
  loader.pct(1);
  loader.done();
}, (e) => {
  loader.pct(Math.min(e.loaded / (e.total || 7833592), 1) * 0.9);
}, () => {
  meshLine.querySelector('b').textContent = 'FAIL';
  loader.log('MESH FAILED. RELOAD THE PAGE.', '×');
});

const ray = new THREE.Raycaster();
function heightNear(x) {
  pivot.rotation.set(0, 0, 0); pivot.position.set(0, 0, 0);
  pivot.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(x, 10, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(shoe, true)[0];
  return hit ? hit.point.y : 0;
}

async function selectVariant(i) {
  currentVariant = i;
  if (!shoe || !parser) return;
  const jobs = [];
  shoe.traverse((o) => {
    const ext = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants;
    if (!ext) return;
    const m = ext.mappings.find((m) => m.variants.includes(i));
    jobs.push((async () => {
      o.userData.mat = m ? await parser.getDependency('material', m.material) : o.userData.mat;
      if (!wireOn) o.material = o.userData.mat;
    })());
  });
  await Promise.all(jobs);
  $$('#variants button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  $('#cctv-variant').textContent = 'VARIANT ' + variantNames[i].toUpperCase();
  updateBuy();
}

// side-profile product render of one colorway, transparent PNG
async function snapshot(i) {
  await selectVariant(i);
  const snapCam = new THREE.PerspectiveCamera(26, 4 / 3, 0.1, 50);
  snapCam.position.set(0.2, 1.6, 7.4);
  snapCam.lookAt(0, 0.45, 0);
  const prevRot = pivot.rotation.clone(), prevPos = pivot.position.clone();
  pivot.rotation.set(0, 0, 0); pivot.position.set(0, 0, 0);
  renderer.setSize(800, 600, false);
  renderer.render(scene, snapCam);
  const url = renderer.domElement.toDataURL('image/png');
  pivot.rotation.copy(prevRot); pivot.position.copy(prevPos);
  resize();
  return url;
}

let wireOn = false;
$('#wire').addEventListener('change', (e) => {
  wireOn = e.target.checked;
  shoe?.traverse((o) => { if (o.isMesh) o.material = wireOn ? wireMat : o.userData.mat; });
});

function buildVariantUI() {
  const row = $('#variants');
  row.innerHTML = '';
  variantNames.forEach((name, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = pad(i + 1) + ' ' + name;
    b.setAttribute('aria-pressed', i === currentVariant);
    b.addEventListener('click', () => { selectVariant(i); buySize = null; renderBuySizes(); });
    row.append(b);
  });
  renderBuySizes();
}

/* ── size picker (shared by readout + cards) ── */
function sizePicker(container, variant, onPick, selected = null) {
  const gone = metaFor(variantNames[variant]).gone;
  container.innerHTML = '';
  container.setAttribute('role', 'radiogroup');
  SIZES.forEach((s) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = s;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', s === selected);
    if (gone.includes(s)) { b.disabled = true; b.innerHTML = `<s>${s}</s>`; }
    b.addEventListener('click', () => {
      container.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
      onPick(s);
    });
    container.append(b);
  });
}

let buySize = null;
function renderBuySizes() {
  sizePicker($('#buy-sizes'), currentVariant, (s) => { buySize = s; $('#buy-size-msg').textContent = ''; }, buySize);
}
function updateBuy() {
  if (!variantNames.length) return;
  const name = variantNames[currentVariant];
  const m = metaFor(name);
  $('#buy-name').textContent = `${name.toUpperCase()} / ${m.stock ? pad(m.stock) + ' LEFT' : 'SOLD OUT'}`;
  $('#buy-price').textContent = '€' + m.price;
  const btn = $('#buy-btn');
  btn.disabled = m.stock === 0;
  btn.textContent = m.stock === 0 ? 'GONE. SORRY.' : 'RESERVE >>>';
}
$('#buy-btn').addEventListener('click', () => {
  if (!buySize) {
    $('#buy-size-msg').textContent = '← PICK ONE';
    flashClass($('#buy-sizes'), 'shake');
    return;
  }
  addToCart(currentVariant, buySize);
});

/* ── inventory ── */
function buildProducts() {
  const wrap = $('#products');
  wrap.innerHTML = '';
  variantNames.forEach((name, i) => {
    const meta = metaFor(name);
    const soldOut = meta.stock === 0;
    let size = null;
    const el = document.createElement('article');
    el.className = 'card' + (soldOut ? ' is-gone' : '');
    el.innerHTML = `
      <div class="card__media">
        <samp class="card__id">SKU / MK1-${pad(i + 1, 3)}</samp>
        <samp class="card__stock ${meta.stock < 5 ? 'is-low' : ''}">${soldOut ? 'SOLD OUT' : pad(meta.stock) + ' LEFT'}</samp>
        <span class="card__num" aria-hidden="true">${pad(i + 1)}</span>
        <img src="${thumbs[i]}" alt="MK-1 sneaker in ${name} colorway, side profile render">
        <samp class="card__note">${meta.note}</samp>
      </div>
      <div class="card__body">
        <div class="card__row"><h3 class="card__name">MK-1 / ${name.toUpperCase()}</h3><span class="card__price">€${meta.price}</span></div>
        <div class="card__sizes"><samp>SIZE / EU <span class="red" data-msg></span></samp><div class="sizes" data-sizes></div></div>
        <div class="card__actions">
          <button class="btn" type="button" data-view>VIEW IN 3D</button>
          <button class="btn btn--buy" type="button" data-buy ${soldOut ? 'disabled' : ''}>${soldOut ? 'GONE' : 'RESERVE'}</button>
        </div>
      </div>`;
    sizePicker(el.querySelector('[data-sizes]'), i, (s) => { size = s; el.querySelector('[data-msg]').textContent = ''; });
    el.querySelector('[data-view]').addEventListener('click', () => {
      selectVariant(i);
      buySize = null; renderBuySizes();
      scrollToStep(0);
    });
    el.querySelector('[data-buy]').addEventListener('click', () => {
      if (soldOut) return;
      if (!size) {
        el.querySelector('[data-msg]').textContent = '← PICK ONE';
        flashClass(el.querySelector('[data-sizes]'), 'shake');
        return;
      }
      addToCart(i, size);
    });
    wrap.append(el);
  });
}

/* ── cart + drawer ── */
const cart = [];
let cartId = 0;
function addToCart(variant, size) {
  const name = variantNames[variant];
  cart.push({ id: ++cartId, variant, size, name, price: metaFor(name).price });
  renderCart();
  flashClass($('.bar__cart'), 'bump');
  openDrawer();
}
function renderCart() {
  const list = $('#drawer-list');
  $('#cart-count').textContent = pad(cart.length);
  $('#drawer-count').textContent = pad(cart.length) + (cart.length === 1 ? ' ITEM' : ' ITEMS');
  $('#drawer-total').textContent = '€' + cart.reduce((a, b) => a + b.price, 0);
  $('#checkout').disabled = cart.length === 0;
  $('#checkout-out').textContent = '';
  if (!cart.length) {
    list.innerHTML = '<li class="drawer__empty"><b>EMPTY.</b><samp>NOTHING RESERVED. THE SLAB WAITS.</samp></li>';
    return;
  }
  list.innerHTML = cart.map((it, n) => `
    <li class="line">
      <img src="${thumbs[it.variant]}" alt="">
      <div>
        <samp>${pad(n + 1)} / SKU MK1-${pad(it.variant + 1, 3)}</samp>
        <b>MK-1 / ${it.name.toUpperCase()}</b>
        <samp>EU ${it.size} · €${it.price}</samp>
      </div>
      <button type="button" class="line__x" data-id="${it.id}" aria-label="Remove MK-1 ${it.name} EU ${it.size}">×</button>
    </li>`).join('');
}
$('#drawer-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-id]');
  if (!b) return;
  cart.splice(cart.findIndex((it) => it.id === +b.dataset.id), 1);
  renderCart();
});
$('#checkout').addEventListener('click', () => {
  $('#checkout-out').textContent = '>>> THIS IS A MOCK-UP. NO SHOES EXIST. NO MONEY MOVED.';
});

const drawer = $('#drawer'), scrim = $('#scrim'), cartBtn = $('.bar__cart');
function openDrawer() {
  scrim.hidden = false;
  drawer.inert = false;
  drawer.setAttribute('aria-hidden', 'false');
  cartBtn.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => document.documentElement.classList.add('drawer-open'));
  $('#drawer-close').focus({ preventScroll: true });
}
function closeDrawer() {
  document.documentElement.classList.remove('drawer-open');
  drawer.inert = true;
  drawer.setAttribute('aria-hidden', 'true');
  cartBtn.setAttribute('aria-expanded', 'false');
  setTimeout(() => { scrim.hidden = true; }, 300);
}
cartBtn.addEventListener('click', () => (drawer.inert ? openDrawer() : closeDrawer()));
$('#drawer-close').addEventListener('click', closeDrawer);
scrim.addEventListener('click', closeDrawer);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !drawer.inert) closeDrawer(); });
renderCart();

/* ── 3D hotspots: surface points found by raycasting, projected to DOM each frame ── */
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
  const wrap = $('#hotspots');
  probes.forEach(([step, from, dir]) => {
    ray.set(new THREE.Vector3(...from), new THREE.Vector3(...dir));
    const hit = ray.intersectObject(shoe, true)[0];
    if (!hit) return;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'spot';
    b.innerHTML = `<i>${pad(step)}</i><span>${STEPS[step].spot}</span>`;
    b.setAttribute('aria-label', `Inspect ${STEPS[step].spot}`);
    b.addEventListener('click', () => scrollToStep(step));
    wrap.append(b);
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
      const hit = ray.intersectObject(shoe, true)[0];
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

/* ── CCTV: second camera → small render target → 1-bit Bayer dither ── */
const cctvCanvas = $('#cctv');
const cctx = cctvCanvas.getContext('2d');
const CW = cctvCanvas.width, CH = cctvCanvas.height;
const rt = new THREE.WebGLRenderTarget(CW, CH);
const px = new Uint8Array(CW * CH * 4);
const img = cctx.createImageData(CW, CH);
const cctvCam = new THREE.PerspectiveCamera(70, CW / CH, 0.05, 100);
cctvCam.layers.enable(1);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
let cctvVisible = false;
new IntersectionObserver(([e]) => { cctvVisible = e.isIntersecting; }).observe(cctvCanvas);

function renderCCTV(t) {
  const a = t * 0.00012;
  cctvCam.position.set(Math.cos(a) * 3.1, 2.3, Math.sin(a) * 3.1);
  cctvCam.lookAt(0, 0.35, 0);
  // render targets skip tone mapping, so dim the lights or the shoe clips to pure white
  const envI = scene.environmentIntensity, flashI = flash.intensity;
  scene.environmentIntensity = 0.12; flash.intensity = 0.9;
  renderer.setRenderTarget(rt);
  renderer.render(scene, cctvCam);
  renderer.readRenderTargetPixels(rt, 0, 0, CW, CH, px);
  renderer.setRenderTarget(null);
  scene.environmentIntensity = envI; flash.intensity = flashI;
  const d = img.data;
  const noise = Math.random() * 0.03;
  for (let y = 0; y < CH; y++) {
    const sy = CH - 1 - y; // GL rows are bottom-up
    for (let x = 0; x < CW; x++) {
      const i = (sy * CW + x) * 4;
      let l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
      if (px[i + 3] === 0) l = 0.0; // empty background = dark dock
      else l = Math.pow(l, 0.8) * 0.95 + noise - 0.04;
      const on = l > BAYER[(y & 3) * 4 + (x & 3)];
      const o = (y * CW + x) * 4;
      d[o] = d[o + 1] = d[o + 2] = on ? 234 : 10;
      d[o + 3] = 255;
    }
  }
  // occasional tracking glitch: shift a band sideways
  if (Math.random() < 0.04) {
    const y0 = (Math.random() * CH) | 0, hh = 3 + ((Math.random() * 8) | 0), sh = ((Math.random() - 0.5) * 30) | 0;
    for (let y = y0; y < Math.min(CH, y0 + hh); y++) {
      const row = d.slice(y * CW * 4, (y + 1) * CW * 4);
      for (let x = 0; x < CW; x++) {
        const sx = (x - sh + CW) % CW;
        for (let k = 0; k < 4; k++) d[(y * CW + x) * 4 + k] = row[sx * 4 + k];
      }
    }
  }
  cctx.putImageData(img, 0, 0);
  const s = Math.floor(t / 1000);
  $('#cctv-time').textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(Math.floor((t % 1000) / 40))}`;
}

/* ── loop ── */
const v3 = (a) => new THREE.Vector3(...a);
const look = new THREE.Vector3();
let frames = 0, fpsT = performance.now(), frameNo = 0, stageVisible = true;
new IntersectionObserver(([e]) => { stageVisible = e.isIntersecting; }).observe(canvas);

function frame(t) {
  requestAnimationFrame(frame);
  frameNo++;

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

  if (stageVisible) {
    renderer.render(scene, camera);
    pivot.updateMatrixWorld(true);
    updateHotspots(stepNow, frameNo);
  }
  if (cctvVisible && shoe && frameNo % 2 === 0) renderCCTV(t);

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

/* ── active nav link + reveal-on-enter ── */
const navLinks = $$('.bar__nav a');
const navIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('is-current', a.getAttribute('href') === '#' + e.target.id));
  });
}, { rootMargin: '-45% 0px -50% 0px' });
navLinks.forEach((a) => { const t = $(a.getAttribute('href')); if (t) navIO.observe(t); });

const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); revealIO.unobserve(e.target); } });
}, { rootMargin: '0px 0px -12% 0px' });
$$('.h2, .manifesto li, .table tr, .serif').forEach((el, n) => {
  el.classList.add('reveal');
  el.style.setProperty('--d', (n % 7) * 60 + 'ms');
  revealIO.observe(el);
});

/* ── crosshair cursor ── */
const cur = $('.cursor');
if (cur && matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const cx = $('.cursor__x'), cy = $('.cursor__y'), cl = $('.cursor__label');
  addEventListener('pointermove', (e) => {
    cur.classList.add('is-on');
    cx.style.transform = `translateY(${e.clientY}px)`;
    cy.style.transform = `translateX(${e.clientX}px)`;
    cl.style.transform = `translate(${e.clientX + 10}px, ${e.clientY + 10}px)`;
    const hot = e.target.closest('a, button, label, input, canvas');
    cur.classList.toggle('is-hot', !!hot);
    cl.textContent = hot === canvas ? '[ DRAG ]' : hot ? '[ CLICK ]' : `X${pad(e.clientX, 4)} / Y${pad(e.clientY, 4)}`;
  });
  document.addEventListener('pointerleave', () => cur.classList.remove('is-on'));
}

/* ── signup (mock) ── */
$('#signup').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#signup-out').textContent = '>>> LOGGED. NO SPAM. NO PROMISES. (THIS IS A MOCK-UP — NOTHING WAS SENT.)';
  e.target.reset();
});
