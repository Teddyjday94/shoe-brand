// ON YOUR FEET (beta): live camera → foot tracker → shoes on both feet
import { createDetector, intrinsics, FeetTracker } from './foottrack.js';
import { FootScene } from './footscene.js';
import { SHOES, shoeById } from './data.js';

const $ = (s) => document.querySelector(s);
const video = $('#cam'), view = $('#view'), dbg = $('#debug');
const qs = new URLSearchParams(location.search);
let shoe = shoeById(qs.get('s')), cw = Math.min(+(qs.get('c') || 0) || 0, shoe.colorways.length - 1);
let facing = 'environment', debug = false, stream = null;

const scene = new FootScene(view, { preserve: true });
const tracker = new FeetTracker();
let detector = null, K = null, last = { feet: [], ms: 0, brightness: 0.5 }, tracks = [];

/* ── pickers ── */
function pickers() {
  const mk = (el, items, on, click, label) => el.replaceChildren(...items.map((it, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = label(it, i); b.setAttribute('aria-pressed', on(it, i));
    b.onclick = () => click(it, i);
    return b;
  }));
  mk($('#shoes'), SHOES, (s) => s === shoe, (s) => { shoe = s; cw = 0; pickers(); load(); }, (s) => s.name);
  mk($('#colors'), shoe.colorways, (_, i) => i === cw, (_, i) => { cw = i; pickers(); load(); }, (c) => c.name);
}
const load = () => scene.setProduct(shoe.id, shoe.colorways[cw].key);

/* ── camera ── */
async function startCamera() {
  stream?.getTracks().forEach((t) => t.stop());
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  await video.play();
  K = intrinsics(video.videoWidth, video.videoHeight);
  scene.resize(K);
  dbg.width = K.w; dbg.height = K.h;
  scene.setSource(video);
}

/* ── detection loop (as fast as the model goes) ── */
async function detectLoop() {
  while (true) {
    if (video.readyState >= 2 && K) {
      last = await detector.detect(video, K.w, K.h);
      tracks = tracker.update(last.feet, K, performance.now());
    } else await new Promise((r) => setTimeout(r, 50));
  }
}

/* ── render loop (every display frame; poses are smoothed between detections) ── */
let prevT = performance.now(), frames = 0, fps = 0, fpsT = prevT;
function render(t) {
  requestAnimationFrame(render);
  const dt = Math.min(0.1, (t - prevT) / 1000); prevT = t;
  scene.update(tracks, last.brightness, dt);
  scene.render();
  $('#hint').style.opacity = tracks.length ? 0 : 1;
  frames++;
  if (t - fpsT > 500) { fps = Math.round((frames * 1000) / (t - fpsT)); frames = 0; fpsT = t; }
  if (debug) drawDebug();
}

const COLORS = ['#ff2a2a', '#2a7bff', '#ffd400', '#00e0a0', '#ff00ff', '#00ffff', '#ff8800', '#ffffff'];
function drawDebug() {
  const g = dbg.getContext('2d');
  g.clearRect(0, 0, dbg.width, dbg.height);
  for (const f of last.feet) {
    g.strokeStyle = '#0f0'; g.lineWidth = 2;
    g.strokeRect(f.box[0], f.box[1], f.box[2] - f.box[0], f.box[3] - f.box[1]);
    f.kps.forEach(([x, y, c], i) => { if (c < 0.35) return; g.fillStyle = COLORS[i]; g.beginPath(); g.arc(x, y, 6, 0, 7); g.fill(); });
  }
  $('#stats').textContent = `${detector.backend} / model ${last.ms.toFixed(0)}ms / ${fps} fps / feet ${last.feet.length} / ` +
    tracks.map((t) => `${t.pose.side[0]} err ${t.pose.err.toFixed(1)}`).join(' ');
}

/* ── controls ── */
$('#dbg').onclick = (e) => {
  debug = !debug;
  e.currentTarget.setAttribute('aria-pressed', debug);
  $('#stats').style.display = debug ? 'block' : 'none';
  if (!debug) dbg.getContext('2d').clearRect(0, 0, dbg.width, dbg.height);
};
$('#flip').onclick = async () => { facing = facing === 'environment' ? 'user' : 'environment'; await startCamera(); };
$('#snap').onclick = () => {
  const a = document.createElement('a');
  a.href = view.toDataURL('image/jpeg', 0.92);
  a.download = `slab-${shoe.id}-${shoe.colorways[cw].key}.jpg`;
  a.click();
};

$('#go').onclick = async () => {
  const msg = $('#start-msg');
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera access. Try Safari on iPhone or Chrome on Android.');
    msg.textContent = 'STARTING CAMERA…';
    await startCamera();
    msg.textContent = 'LOADING FOOT MODEL…';
    detector = await createDetector({ modelUrl: new URL('assets/ml/foot.onnx', location.href).href });
    await load();
    $('#start').remove();
    detectLoop();
    requestAnimationFrame(render);
  } catch (e) {
    msg.textContent = e.name === 'NotAllowedError' ? 'CAMERA BLOCKED. ALLOW CAMERA ACCESS IN YOUR BROWSER SETTINGS.' : String(e.message || e).toUpperCase();
  }
};
pickers();
