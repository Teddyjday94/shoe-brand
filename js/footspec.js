// The foot model's 8 keypoints. Shared by the data generator and the browser tracker so both
// agree on what each point means. Coordinates are in the normalised shoe space used by
// js/shoe.js (toe +X, up +Y, sole on y=0, 3 units long); for a RIGHT foot the lateral
// (outer) side is +Z, the medial (inner) side -Z. A left foot is the same with z mirrored,
// so "medial" and "lateral" keep their meaning on both feet (and under image flips).
export const KEYPOINTS = [
  'toe',          // 0 front-most point of the toe box
  'heel',         // 1 rear-most point of the heel, near the sole
  'ball_medial',  // 2 widest point, inner side
  'ball_lateral', // 3 widest point, outer side
  'instep',       // 4 top of the foot over the lacing
  'ankle',        // 5 centre of the collar opening (where the leg enters)
  'heel_top',     // 6 top of the heel counter
  'mid_lateral',  // 7 outer midsole edge under the arch
];
export const NUM_KPT = KEYPOINTS.length;

// The tracker's 3D foot: the average of the three shoes' measured keypoints (normalised
// space, from measureKeypoints), scaled to metres. RIGHT foot; mirror z for the left.
// Its frame matches the AR models in assets/ar (toe +X, up +Y, sole y=0, 0.1 m per unit).
const AVG = [
  [1.37, 0.28, 0], [-1.45, 0.3, 0], [0.62, 0.28, -0.52], [0.62, 0.28, 0.52],
  [0.25, 1.03, 0], [-0.65, 1.32, 0], [-1.27, 1.39, 0], [-0.23, 0.13, 0.34],
];
export const TEMPLATE_RIGHT = AVG.map(([x, y, z]) => [x * 0.1, y * 0.1, z * 0.1]);
export const TEMPLATE_LEFT = TEMPLATE_RIGHT.map(([x, y, z]) => [x, y, -z]);

// raycast probes (normalised space): [origin, direction] — first surface hit is the point.
// 'ankle' is not a surface point: it's computed from the collar (see measureKeypoints).
export const PROBES = {
  toe: [[6, 0.28, 0], [-1, 0, 0]],
  heel: [[-6, 0.3, 0], [1, 0, 0]],
  ball_medial: [[0.62, 0.28, -6], [0, 0, 1]],
  ball_lateral: [[0.62, 0.28, 6], [0, 0, -1]],
  instep: [[0.25, 6, 0], [0, -1, 0]],
  mid_lateral: [[-0.3, 0.1, 6], [0, 0, -1]],
};

// measure keypoints on a loaded shoe root (identity transform, normalised space)
export function measureKeypoints(THREE, root) {
  const ray = new THREE.Raycaster();
  root.updateMatrixWorld(true);
  const hit = (o, d) => {
    ray.set(new THREE.Vector3(...o), new THREE.Vector3(...d).normalize());
    const h = ray.intersectObject(root, true)[0];
    return h ? h.point.clone() : null;
  };
  const p = {};
  for (const [k, [o, d]] of Object.entries(PROBES)) p[k] = hit(o, d);
  // a few models have cut-outs exactly where a probe passes: try nearby lines too
  if (!p.mid_lateral) {
    for (const [x, y] of [[-0.5, 0.18], [-0.1, 0.18], [-0.6, 0.08], [0.1, 0.1]]) { p.mid_lateral = hit([x, y, 6], [0, 0, -1]); if (p.mid_lateral) break; }
  }
  // heel_top: the highest point that's still at the very back. Scanning from behind and
  // keeping only hits near the heel skips pull tabs and the tongue in front of the opening.
  const heelX = p.heel?.x ?? -1.45;
  for (let y = 2.4; y > 0.3; y -= 0.02) {
    const h = hit([-6, y, 0], [1, 0, 0]);
    if (h && h.x < heelX + 0.35) { p.heel_top = h; break; }
  }
  p.heel_top ||= new THREE.Vector3(heelX, 1.2, 0);
  // ankle: centre of the collar opening — a fixed share of the length in front of the heel,
  // just below the collar rim (where the leg actually enters)
  p.ankle = new THREE.Vector3(heelX + 0.8, p.heel_top.y * 0.95, 0);
  return KEYPOINTS.map((k) => p[k] || new THREE.Vector3());
}
