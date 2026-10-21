// LAB: live security-camera feed of the MK-1 sitting on a pallet in Dock B
import * as THREE from 'three';
import { $, $$, clamp, pad } from './ui.js';
import { PRODUCTS } from './data.js';
import { loadShoe, studioEnvironment } from './shoe.js';

const canvas = $('#cctv');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1d1d1b);
scene.fog = new THREE.Fog(0x1d1d1b, 40, 90);
scene.environment = studioEnvironment(renderer);
scene.environmentIntensity = 0.35;

/* ── canvas textures (painted, not downloaded) ── */
function tex(w, h, draw, repeat) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function speckle(g, w, h, n, alpha) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * alpha})`;
    g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}
function hazard(g, w, h) {
  g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#111';
  for (let x = -h; x < w + h; x += h) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h / 2, h); g.lineTo(x + h, 0); g.lineTo(x + h / 2, 0); g.fill(); }
}

async function buildDock() {
  // wait for the stencil font so the painted text isn't Arial
  await Promise.race([document.fonts.load('120px "Archivo Black"'), new Promise((r) => setTimeout(r, 1500))]);
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const add = (geo, mat, pos, rot = [0, 0, 0], shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos); m.rotation.set(...rot);
    m.castShadow = shadow; m.receiveShadow = true;
    scene.add(m);
    return m;
  };

  // floor: sealed concrete with joints + yellow bay lines
  const floorTex = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#8e8c86'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 9000, 0.12);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2;
    g.strokeRect(1, 1, w - 2, h - 2);
  }, [8, 8]);
  add(new THREE.PlaneGeometry(90, 90), std({ map: floorTex, roughness: 0.8 }), [0, 0, 0], [-Math.PI / 2, 0, 0], false);
  const paint = std({ color: 0xf2c200, roughness: 0.6 });
  add(new THREE.PlaneGeometry(0.5, 40), paint, [-10, 0.01, 6], [-Math.PI / 2, 0, 0], false);
  add(new THREE.PlaneGeometry(0.5, 40), paint, [10, 0.01, 6], [-Math.PI / 2, 0, 0], false);
  const keepClear = tex(512, 128, (g, w, h) => {
    hazard(g, w, h);
    g.fillStyle = '#111'; g.fillRect(w * 0.18, h * 0.22, w * 0.64, h * 0.56);
    g.fillStyle = '#f2c200'; g.font = '56px "Archivo Black", Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('KEEP CLEAR', w / 2, h / 2 + 2);
  });
  add(new THREE.PlaneGeometry(19.5, 4.8), std({ map: keepClear, roughness: 0.6 }), [0, 0.012, -6.2], [-Math.PI / 2, 0, 0], false);

  // back wall: painted block
  const wallTex = tex(512, 512, (g, w, h) => {
    g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, w, h);
    speckle(g, w, h, 5000, 0.08);
    g.strokeStyle = 'rgba(0,0,0,.18)'; g.lineWidth = 3;
    for (let y = 0; y <= h; y += 64) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      for (let x = (y / 64) % 2 ? 64 : 0; x <= w; x += 128) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 64); g.stroke(); }
    }
  }, [6, 3]);
  const wallMat = std({ map: wallTex });
  add(new THREE.PlaneGeometry(90, 40), wallMat, [0, 20, -9], [0, 0, 0], false);
  add(new THREE.PlaneGeometry(60, 40), wallMat, [-30, 20, 21], [0, Math.PI / 2, 0], false);
  // wall kick stripe
  const stripeTex = tex(512, 64, hazard, [10, 1]);
  add(new THREE.PlaneGeometry(90, 1.6), std({ map: stripeTex }), [0, 0.8, -8.98], [0, 0, 0], false);

  // roller door with stencil
  const doorTex = tex(1024, 1024, (g, w, h) => {
    g.fillStyle = '#6f7478'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 28) {
      g.fillStyle = 'rgba(255,255,255,.10)'; g.fillRect(0, y, w, 4);
      g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, y + 22, w, 6);
    }
    speckle(g, w, h, 4000, 0.1);
    g.fillStyle = '#f2c200'; g.font = '300px "Archivo Black", Arial Black'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('B', w / 2, h * 0.42);
    g.font = '96px "Archivo Black", Arial Black';
    g.fillText('DOCK', w / 2, h * 0.17);
    g.fillStyle = '#111'; g.font = '40px "JetBrains Mono", monospace';
    g.fillText('MAX 3.2M / SLAB® INBOUND', w / 2, h * 0.62);
  });
  add(new THREE.PlaneGeometry(22, 24), std({ map: doorTex, roughness: 0.55, metalness: 0.3 }), [0, 12, -8.9], [0, 0, 0], false);
  const postTex = tex(64, 512, (g, w, h) => {
    g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#111';
    for (let y = -w; y < h; y += w * 1.4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w * 0.7); g.lineTo(w, y + w * 1.4); g.lineTo(0, y + w * 0.7); g.fill(); }
  });
  const postMat = std({ map: postTex, roughness: 0.5 });
  add(new THREE.BoxGeometry(1.2, 25, 1.2), postMat, [-11.6, 12.5, -8.4]);
  add(new THREE.BoxGeometry(1.2, 25, 1.2), postMat, [11.6, 12.5, -8.4]);
  add(new THREE.BoxGeometry(24.4, 1.2, 1.2), std({ color: 0x2a2a2a }), [0, 25.4, -8.4]);
  const rubber = std({ color: 0x151515, roughness: 0.95 });
  add(new THREE.BoxGeometry(1.6, 2.2, 0.9), rubber, [-8, 1.1, -8.4]);
  add(new THREE.BoxGeometry(1.6, 2.2, 0.9), rubber, [8, 1.1, -8.4]);

  // wall sign
  const signTex = tex(512, 320, (g, w, h) => {
    g.fillStyle = '#f2c200'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(10, 10, w - 20, h - 20);
    g.fillStyle = '#111'; g.textAlign = 'center';
    g.font = '64px "Archivo Black", Arial Black'; g.fillText('CCTV', w / 2, 120);
    g.font = '30px "JetBrains Mono", monospace'; g.fillText('IN OPERATION', w / 2, 180);
    g.fillText('NO SHOES LEAVE', w / 2, 230); g.fillText('UNSCANNED', w / 2, 266);
  });
  add(new THREE.PlaneGeometry(5.6, 3.5), std({ map: signTex, roughness: 0.4 }), [-17, 11, -8.95], [0, 0, 0], false);

  // pallet: three bearers + top deck boards
  const wood = (k) => std({ color: new THREE.Color().setHSL(0.075, 0.42, 0.3 + k * 0.06), roughness: 0.85 });
  [-4.4, 0, 4.4].forEach((z, n) => add(new THREE.BoxGeometry(12, 1.0, 1.1), wood(n % 2), [0, 0.5, z]));
  for (let i = 0; i < 7; i++) add(new THREE.BoxGeometry(12, 0.24, 1.25), wood((i * 7) % 3 / 2), [0, 1.12, -4.4 + i * (8.8 / 6)]);

  // branded shoebox beside the shoe
  const boxTex = tex(512, 256, (g, w, h) => {
    g.fillStyle = '#e61919'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0d0d0d'; g.fillRect(0, h * 0.68, w, h * 0.32);
    g.fillStyle = '#f4f4f0'; g.font = '120px "Archivo Black", Arial Black'; g.textBaseline = 'alphabetic';
    g.fillText('SLAB', 24, 140);
    g.font = '28px "JetBrains Mono", monospace';
    g.fillText('MK-1 / EU 42 / BATCH 004', 24, h * 0.86);
  });
  const boxSide = std({ map: boxTex, roughness: 0.7 }), boxPlain = std({ color: 0xe61919, roughness: 0.7 }), boxDark = std({ color: 0x0d0d0d, roughness: 0.7 });
  const shoebox = new THREE.Mesh(new THREE.BoxGeometry(3.6, 1.3, 2.2), [boxPlain, boxPlain, boxDark, boxDark, boxSide, boxSide]);
  shoebox.position.set(-2.6, 1.24 + 0.65, -2.6); shoebox.rotation.y = 0.18;
  shoebox.castShadow = shoebox.receiveShadow = true;
  scene.add(shoebox);

  // traffic cone
  const coneMat = std({ color: 0xff5a1f, roughness: 0.6 });
  add(new THREE.BoxGeometry(2.6, 0.25, 2.6), std({ color: 0x1a1a1a }), [9, 0.125, 4.5]);
  add(new THREE.ConeGeometry(1.1, 4.2, 32, 1, true), coneMat, [9, 2.35, 4.5]);
  add(new THREE.CylinderGeometry(0.62, 0.78, 0.7, 32, 1, true), std({ color: 0xf4f4f0, roughness: 0.4 }), [9, 2.6, 4.5]);

  // second pallet stacked with cartons, left of shot
  [-4.4, 0, 4.4].forEach((z) => add(new THREE.BoxGeometry(12, 1.0, 1.1), wood(0), [-19, 0.5, z]));
  const carton = (k) => std({ color: new THREE.Color().setHSL(0.09, 0.42, 0.5 + k * 0.05), roughness: 0.9 });
  for (let x = 0; x < 2; x++) for (let y = 0; y < 3; y++) for (let z = 0; z < 2; z++) {
    if (y === 2 && x + z === 2) continue;
    add(new THREE.BoxGeometry(5.6, 3.6, 4.4), carton((x + y + z) % 3), [-21.9 + x * 5.8, 1.0 + 1.8 + y * 3.65, -2.3 + z * 4.6]);
  }

  // lighting: one hard overhead fixture on the pallet + cool fill from the open bay
  const lamp = new THREE.SpotLight(0xfff3e0, 2.5, 0, 0.62, 0.45, 0);
  lamp.position.set(3, 22, 6);
  lamp.target.position.set(0, 1, 0);
  lamp.castShadow = true;
  lamp.shadow.mapSize.set(2048, 2048);
  lamp.shadow.bias = -0.0004;
  scene.add(lamp, lamp.target);
  scene.add(new THREE.HemisphereLight(0xdbe4ee, 0x3d3a35, 0.75));
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.6);
  fill.position.set(-10, 12, 20);
  scene.add(fill);
  // the fixture itself
  add(new THREE.BoxGeometry(6, 0.3, 1), std({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2 }), [3, 22.2, 6], [0, 0, 0], false);
}

/* ── cameras: fixed mounts that pan slowly, like the real thing ── */
const CAMS = [
  { id: 'CAM 01', label: 'PALLET 4 / CLOSE', pos: [5.4, 4.4, 6.6], look: [-0.4, 1.8, -0.7], fov: 29, pan: 0.07, speed: 0.00018 },
  { id: 'CAM 02', label: 'DOCK B / WIDE', pos: [22, 17, 22], look: [-3, 3, -2], fov: 52, pan: 0.28, speed: 0.00012 },
  { id: 'CAM 03', label: 'OVERHEAD / PALLET', pos: [0.8, 11, 2.4], look: [-0.2, 1.3, -0.4], fov: 30, pan: 0.06, speed: 0.0002 },
];
let camIdx = 0;
const camera = new THREE.PerspectiveCamera(CAMS[0].fov, 16 / 9, 0.1, 200);
const base = new THREE.Vector3(), target = new THREE.Vector3();

function aimCamera(t) {
  const c = CAMS[camIdx];
  camera.position.set(...c.pos);
  base.set(...c.look).sub(camera.position);
  // pan with dwell at each end: clamp a stretched sine
  const a = clamp(Math.sin(t * c.speed) * 1.5, -1, 1) * c.pan;
  base.applyAxisAngle(new THREE.Vector3(0, 1, 0), a);
  target.copy(camera.position).add(base);
  camera.lookAt(target);
}

function setCam(i) {
  camIdx = i;
  const c = CAMS[i];
  camera.fov = c.fov;
  camera.updateProjectionMatrix();
  $('#cam-id').textContent = c.id;
  $('#cam-label').textContent = c.label;
  $$('#cams button').forEach((b, j) => b.setAttribute('aria-pressed', j === i));
  const feed = $('.cctv');
  feed.classList.remove('is-cut'); void feed.offsetWidth; feed.classList.add('is-cut');
}
CAMS.forEach((c, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<b>${c.id}</b><samp>${c.label}</samp>`;
  b.setAttribute('aria-pressed', i === 0);
  b.addEventListener('click', () => setCam(i));
  $('#cams').append(b);
});

/* ── shoe ── */
let model = null, variant = 0;
PRODUCTS.forEach((p) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = pad(p.variant + 1) + ' ' + p.name;
  b.setAttribute('aria-pressed', p.variant === 0);
  b.addEventListener('click', async () => {
    variant = p.variant;
    $$('#feed-variants button').forEach((x, j) => x.setAttribute('aria-pressed', j === variant));
    $('#feed-variant').textContent = 'MK-1 / ' + p.name;
    await model?.selectVariant(variant);
  });
  $('#feed-variants').append(b);
});

const waitEl = $('#cctv-wait');
Promise.all([buildDock(), loadShoe((p) => { waitEl.querySelector('b').textContent = pad(Math.round(p * 100), 3) + '%'; })])
  .then(async ([, m]) => {
    model = m;
    m.root.position.set(0.4, 1.24, -0.4);
    m.root.rotation.y = -0.35;
    m.root.traverse((o) => { if (o.isMesh) o.receiveShadow = true; });
    scene.add(m.root);
    await m.selectVariant(variant);
    waitEl.classList.add('is-done');
  })
  .catch(() => { waitEl.querySelector('b').textContent = 'NO SIGNAL'; });

/* ── size + loop ── */
function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);

let visible = true;
new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
const clock = $('#cctv-time');
const stamp = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}  ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};
function frame(t) {
  requestAnimationFrame(frame);
  if (!visible) return;
  aimCamera(t);
  renderer.render(scene, camera);
  clock.textContent = stamp();
}
setCam(0);
requestAnimationFrame(frame);
