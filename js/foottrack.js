// SLAB foot tracker: camera frame → feet keypoints (YOLO pose, ONNX) → 6-DoF pose per foot.
// No three.js in here: plain maths, so it runs the same in the live page and the video tester.
import { NUM_KPT, TEMPLATE_RIGHT, TEMPLATE_LEFT } from './footspec.js';

const ORT_VERSION = '1.20.1';
const ORT_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

/* ───────────────────────── detection ───────────────────────── */

export async function createDetector({ modelUrl, size = 384, prefer = ['webgpu', 'wasm'] } = {}) {
  const ort = await import(`${ORT_BASE}ort.webgpu.min.mjs`);
  ort.env.wasm.wasmPaths = ORT_BASE;
  let session = null, backend = null;
  for (const ep of prefer) {
    try {
      session = await ort.InferenceSession.create(modelUrl, { executionProviders: [ep], graphOptimizationLevel: 'all' });
      backend = ep;
      break;
    } catch (e) { console.warn(`foot model: ${ep} unavailable`, e); }
  }
  if (!session) throw new Error('No ONNX backend available');

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const input = new Float32Array(3 * size * size);
  const inName = session.inputNames[0], outName = session.outputNames[0];

  /** source: video / canvas / image; returns feet in source pixel coordinates */
  async function detect(source, sw, sh, { minScore = 0.4 } = {}) {
    // letterbox into size×size, grey padding like the training pipeline
    const k = Math.min(size / sw, size / sh), w = Math.round(sw * k), h = Math.round(sh * k);
    const ox = (size - w) / 2, oy = (size - h) / 2;
    g.fillStyle = 'rgb(114,114,114)';
    g.fillRect(0, 0, size, size);
    g.drawImage(source, ox, oy, w, h);
    const px = g.getImageData(0, 0, size, size).data, n = size * size;
    let lum = 0;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      input[i] = px[p] / 255; input[n + i] = px[p + 1] / 255; input[2 * n + i] = px[p + 2] / 255;
      lum += px[p] * 0.299 + px[p + 1] * 0.587 + px[p + 2] * 0.114;
    }
    const t0 = performance.now();
    const res = await session.run({ [inName]: new ort.Tensor('float32', input, [1, 3, size, size]) });
    const ms = performance.now() - t0;
    const out = res[outName], [, ch, count] = out.dims, d = out.data; // [1, 5 + 3K, N]
    const cands = [];
    for (let j = 0; j < count; j++) {
      const s = d[4 * count + j];
      if (s < minScore) continue;
      const cx = d[j], cy = d[count + j], bw = d[2 * count + j], bh = d[3 * count + j];
      const kps = [];
      for (let q = 0; q < NUM_KPT; q++) {
        const b = 5 + q * 3;
        kps.push([(d[b * count + j] - ox) / k, (d[(b + 1) * count + j] - oy) / k, d[(b + 2) * count + j]]);
      }
      cands.push({ score: s, box: [(cx - bw / 2 - ox) / k, (cy - bh / 2 - oy) / k, (cx + bw / 2 - ox) / k, (cy + bh / 2 - oy) / k], kps });
    }
    if (ch !== 5 + 3 * NUM_KPT) console.warn('unexpected model output channels', ch);
    return { feet: nms(cands, 0.45).slice(0, 2), ms, backend, brightness: lum / n / 255 };
  }
  return { detect, backend };
}

function iou(a, b) {
  const x0 = Math.max(a[0], b[0]), y0 = Math.max(a[1], b[1]), x1 = Math.min(a[2], b[2]), y1 = Math.min(a[3], b[3]);
  const i = Math.max(0, x1 - x0) * Math.max(0, y1 - y0);
  return i / ((a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i);
}
function nms(c, thr) {
  c.sort((a, b) => b.score - a.score);
  const keep = [];
  for (const x of c) if (keep.every((k) => iou(k.box, x.box) < thr)) keep.push(x);
  return keep;
}

/* ───────────────────────── 3D pose (PnP) ─────────────────────────
   Camera convention here is OpenCV's: x right, y down, z forward.
   pose = { r: rotation vector [3], t: translation [3] (metres) } maps foot → camera. */

export function intrinsics(w, h, longSideFovDeg = 64) {
  const long = Math.max(w, h);
  const f = (long / 2) / Math.tan((longSideFovDeg * Math.PI) / 360);
  return { fx: f, fy: f, cx: w / 2, cy: h / 2, w, h };
}

export function rodrigues([rx, ry, rz]) {
  const th = Math.hypot(rx, ry, rz);
  if (th < 1e-9) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const x = rx / th, y = ry / th, z = rz / th, c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [
    c + x * x * C, x * y * C - z * s, x * z * C + y * s,
    y * x * C + z * s, c + y * y * C, y * z * C - x * s,
    z * x * C - y * s, z * y * C + x * s, c + z * z * C,
  ];
}
function matToRvec(R) {
  const tr = R[0] + R[4] + R[8], th = Math.acos(Math.min(1, Math.max(-1, (tr - 1) / 2)));
  if (th < 1e-6) return [0, 0, 0];
  if (Math.PI - th < 1e-4) { // near 180°: axis from the diagonal
    const x = Math.sqrt(Math.max(0, (R[0] + 1) / 2)), y = Math.sign(R[1] || 1) * Math.sqrt(Math.max(0, (R[4] + 1) / 2)), z = Math.sign(R[2] || 1) * Math.sqrt(Math.max(0, (R[8] + 1) / 2));
    return [x * th, y * th, z * th];
  }
  const k = th / (2 * Math.sin(th));
  return [(R[7] - R[5]) * k, (R[2] - R[6]) * k, (R[3] - R[1]) * k];
}

function project(p, X, K, out) {
  const R = rodrigues(p.slice(0, 3));
  for (let i = 0; i < X.length; i++) {
    const [x, y, z] = X[i];
    const xc = R[0] * x + R[1] * y + R[2] * z + p[3];
    const yc = R[3] * x + R[4] * y + R[5] * z + p[4];
    const zc = R[6] * x + R[7] * y + R[8] * z + p[5];
    const iz = 1 / Math.max(zc, 1e-4);
    out[2 * i] = K.fx * xc * iz + K.cx;
    out[2 * i + 1] = K.fy * yc * iz + K.cy;
  }
  return out;
}

function residuals(p, X, uv, w, K, buf) {
  project(p, X, K, buf);
  let e = 0;
  const r = new Float64Array(2 * X.length);
  for (let i = 0; i < X.length; i++) {
    r[2 * i] = (buf[2 * i] - uv[i][0]) * w[i];
    r[2 * i + 1] = (buf[2 * i + 1] - uv[i][1]) * w[i];
    e += r[2 * i] ** 2 + r[2 * i + 1] ** 2;
  }
  return { r, e };
}

function solve6(A, b) { // Gaussian elimination, 6×6
  const n = 6, M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c] || 1e-12;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / d; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((row, i) => row[n] / (M[i][i] || 1e-12));
}

/** Levenberg–Marquardt on reprojection error. Returns refined params and mean pixel error. */
function lm(p0, X, uv, w, K, iters = 20) {
  let p = p0.slice(), lambda = 1e-2;
  const buf = new Float64Array(2 * X.length);
  let { r, e } = residuals(p, X, uv, w, K, buf);
  const steps = [1e-4, 1e-4, 1e-4, 1e-4, 1e-4, 1e-4];
  for (let it = 0; it < iters; it++) {
    const J = [];
    for (let k = 0; k < 6; k++) {
      const pp = p.slice(), pm = p.slice();
      pp[k] += steps[k]; pm[k] -= steps[k];
      const a = residuals(pp, X, uv, w, K, buf).r, b = residuals(pm, X, uv, w, K, buf).r;
      J.push(a.map((v, i) => (v - b[i]) / (2 * steps[k])));
    }
    const JtJ = [...Array(6)].map((_, i) => [...Array(6)].map((__, j) => J[i].reduce((s, v, q) => s + v * J[j][q], 0)));
    const Jtr = [...Array(6)].map((_, i) => J[i].reduce((s, v, q) => s + v * r[q], 0));
    let improved = false;
    for (let tries = 0; tries < 6; tries++) {
      const A = JtJ.map((row, i) => row.map((v, j) => (i === j ? v * (1 + lambda) + 1e-9 : v)));
      const dp = solve6(A, Jtr.map((v) => -v));
      const pn = p.map((v, i) => v + dp[i]);
      if (pn[5] <= 0.05) { lambda *= 10; continue; } // never behind the camera
      const cand = residuals(pn, X, uv, w, K, buf);
      if (cand.e < e) { p = pn; r = cand.r; e = cand.e; lambda = Math.max(lambda / 3, 1e-7); improved = true; break; }
      lambda *= 10;
    }
    if (!improved) break;
  }
  const wsum = w.reduce((s, v) => s + v * v, 0) || 1;
  return { p, err: Math.sqrt(e / wsum) };
}

// starting rotations: foot forward along the 2D heel→toe direction, tipped away from the
// camera by a few angles, "up" towards the camera. Built directly as a rotation matrix.
function initialRotations(dir2d) {
  const out = [];
  const fx0 = dir2d[0], fy0 = dir2d[1];
  for (const tilt of [0.25, 0.6, 0.95, 1.25]) {
    const f = [fx0 * Math.cos(tilt), fy0 * Math.cos(tilt), Math.sin(tilt)]; // forward, camera coords
    let u = [-f[0] * -f[2], -f[1] * -f[2], -1 + f[2] * f[2]];               // -z with the forward part removed
    const ul = Math.hypot(...u) || 1; u = u.map((v) => v / ul);
    const s = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]]; // f × u = foot +Z
    // columns are the foot's X (forward), Y (up), Z (right) axes expressed in camera space
    const R = [f[0], u[0], s[0], f[1], u[1], s[1], f[2], u[2], s[2]];
    out.push(matToRvec(R));
  }
  return out;
}

/**
 * Pose one detected foot. Tries the right and the mirrored left template and keeps whichever
 * reprojects better (that's also how left/right is decided). `prev` seeds tracking.
 */
export function solveFoot(foot, K, prev = null, { minKpConf = 0.35 } = {}) {
  const uv = foot.kps.map((k) => [k[0], k[1]]);
  const w = foot.kps.map((k) => (k[2] >= minKpConf ? Math.sqrt(k[2]) : 0));
  if (w.filter((v) => v > 0).length < 5) return null;

  // physical prior: the camera sees the top of the shoe, not its sole from underneath. A pose
  // whose "up" points away from the camera is a mirror-image false fit, so it's penalised.
  const facing = (p) => {
    const R = rodrigues(p.slice(0, 3)), t = p.slice(3), tl = Math.hypot(...t);
    return (-(R[1] * t[0] + R[4] * t[1] + R[7] * t[2])) / tl; // up · (direction to camera)
  };
  const score = (r) => r.err + (facing(r.p) < -0.15 ? 40 : 0);
  const fit = (T, starts) => {
    let best = null;
    for (const s of starts) {
      const r = lm(s, T, uv, w, K, 12);
      if (!best || score(r) < score(best)) best = r;
    }
    if (!best) return null;
    const out = lm(best.p, T, uv, w, K, 25);
    return { ...out, score: score(out) };
  };

  let results;
  if (prev) {
    const T = prev.side === 'left' ? TEMPLATE_LEFT : TEMPLATE_RIGHT;
    results = [{ side: prev.side, ...fit(T, [[...prev.r, ...prev.t]]) }];
    // if tracking degrades, fall back to a fresh search below
    if (results[0].err > 14) results = null;
  }
  if (!results) {
    const toe = foot.kps[0], heel = foot.kps[1];
    const dx = toe[0] - heel[0], dy = toe[1] - heel[1], len = Math.hypot(dx, dy) || 1;
    // depth from apparent length (template ≈ 0.28 m heel→toe)
    const cx = uv.reduce((s, v, i) => s + v[0] * w[i], 0) / w.reduce((s, v) => s + v, 0);
    const cy = uv.reduce((s, v, i) => s + v[1] * w[i], 0) / w.reduce((s, v) => s + v, 0);
    const z = Math.min(4, Math.max(0.15, (K.fx * 0.28) / len));
    const t0 = [((cx - K.cx) / K.fx) * z, ((cy - K.cy) / K.fy) * z, z];
    const starts = initialRotations([dx / len, dy / len]).map((r) => [...r, ...t0]);
    results = [
      { side: 'right', ...fit(TEMPLATE_RIGHT, starts) },
      { side: 'left', ...fit(TEMPLATE_LEFT, starts) },
    ];
  }
  const best = results.reduce((a, b) => (b.score < a.score ? b : a));
  return { side: best.side, r: best.p.slice(0, 3), t: best.p.slice(3), err: best.err };
}

/* ───────────────────────── smoothing ───────────────────────── */

// One-Euro filter: heavy smoothing when still, light when moving (no lag on fast motion)
class OneEuro {
  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1.0) { Object.assign(this, { minCutoff, beta, dCutoff, x: null, dx: 0 }); }
  static a(cut, dt) { const tau = 1 / (2 * Math.PI * cut); return 1 / (1 + tau / dt); }
  filter(v, dt) {
    if (this.x === null) { this.x = v; return v; }
    const dv = (v - this.x) / dt;
    this.dx += OneEuro.a(this.dCutoff, dt) * (dv - this.dx);
    const cut = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(cut, dt) * (v - this.x);
    return this.x;
  }
}

/** Keeps two feet as stable tracks across frames; smooths their poses. */
export class FeetTracker {
  constructor({ lostAfterMs = 350 } = {}) { this.tracks = []; this.lostAfterMs = lostAfterMs; }

  update(feet, K, now) {
    const used = new Set();
    // match detections to existing tracks by box centre
    for (const tr of this.tracks) {
      let bi = -1, bd = Infinity;
      feet.forEach((f, i) => {
        if (used.has(i)) return;
        const c = [(f.box[0] + f.box[2]) / 2, (f.box[1] + f.box[3]) / 2];
        const d = Math.hypot(c[0] - tr.c[0], c[1] - tr.c[1]);
        if (d < bd) { bd = d; bi = i; }
      });
      if (bi >= 0 && bd < Math.max(K.w, K.h) * 0.25) { used.add(bi); tr.apply(feet[bi], K, now); }
    }
    feet.forEach((f, i) => { if (!used.has(i) && this.tracks.length < 2) { const tr = new Track(); tr.apply(f, K, now); this.tracks.push(tr); } });
    this.tracks = this.tracks.filter((tr) => now - tr.seen < this.lostAfterMs);
    return this.tracks.filter((tr) => tr.pose);
  }
}

let nextId = 1;
class Track {
  constructor() {
    this.id = nextId++;
    this.pose = null; this.raw = null; this.c = [0, 0]; this.seen = 0; this.last = 0;
    this.ft = [new OneEuro(1.0, 0.8), new OneEuro(1.0, 0.8), new OneEuro(0.8, 0.6)];
    this.q = null;
  }
  apply(foot, K, now) {
    this.c = [(foot.box[0] + foot.box[2]) / 2, (foot.box[1] + foot.box[3]) / 2];
    this.seen = now;
    const sol = solveFoot(foot, K, this.raw);
    if (!sol || sol.err > 18) return; // keep the last good pose rather than a bad fit
    this.raw = sol;
    const dt = Math.max(1 / 120, (now - (this.last || now - 33)) / 1000);
    this.last = now;
    const t = sol.t.map((v, i) => this.ft[i].filter(v, dt));
    // rotation: slerp towards the new orientation, faster when it changes a lot
    const qn = rvecToQuat(sol.r);
    if (!this.q) this.q = qn;
    else {
      if (dot4(this.q, qn) < 0) qn.forEach((v, i) => { qn[i] = -v; });
      const ang = 2 * Math.acos(Math.min(1, Math.abs(dot4(this.q, qn))));
      const alpha = Math.min(1, 0.25 + ang * 2.5);
      this.q = slerp(this.q, qn, alpha);
    }
    this.pose = { side: sol.side, q: this.q, t, err: sol.err, kps: foot.kps };
  }
}
function rvecToQuat([x, y, z]) {
  const th = Math.hypot(x, y, z);
  if (th < 1e-9) return [0, 0, 0, 1];
  const s = Math.sin(th / 2) / th;
  return [x * s, y * s, z * s, Math.cos(th / 2)];
}
const dot4 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
function slerp(a, b, t) {
  let d = dot4(a, b);
  if (d > 0.9995) { const r = a.map((v, i) => v + (b[i] - v) * t); const l = Math.hypot(...r); return r.map((v) => v / l); }
  d = Math.min(1, Math.max(-1, d));
  const th = Math.acos(d) * t, c = b.map((v, i) => v - a[i] * d), cl = Math.hypot(...c);
  return a.map((v, i) => v * Math.cos(th) + (c[i] / cl) * Math.sin(th));
}
