// loads any shoe in the line, normalised: toe points +X, 3 units long, sole on y=0
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

const BASE = new URL('../', import.meta.url);
const loader = new GLTFLoader();
const coarse = matchMedia('(pointer: coarse)').matches;

export function studioEnvironment(renderer) {
  return new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}

// photographed studio (Poly Haven "Studio Small 09", CC0): real softboxes in the reflections.
// The procedural room is used until it arrives, so nothing waits on it.
export function applyStudio(renderer, scene) {
  scene.environment = studioEnvironment(renderer);
  return new RGBELoader().loadAsync(new URL('assets/studio.hdr', BASE).href).then((hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromEquirectangular(hdr).texture;
    hdr.dispose(); pmrem.dispose();
  }).catch(() => { /* keep the procedural room */ });
}

// soft contact shadow where the sole meets the floor — the hard flash shadow alone
// leaves the shoe looking pasted on. A blurred ellipse, sized to the shoe's footprint.
export function contactShadow(root, opacity = 0.6) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 64, 4, 128, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(0.55, 'rgba(0,0,0,.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.setTransform(1, 0, 0, 0.5, 0, 32); // squash the circle into an ellipse
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity, depthWrite: false, toneMapped: false }),
  );
  plane.rotation.x = -Math.PI / 2;
  plane.scale.set(size.x * 1.08, size.z * 2.2, 1);
  plane.position.y = 0.004;
  plane.renderOrder = -1;
  return plane;
}

// hue-rotate / saturate / lighten a colour in YIQ space (for single-texture models)
const TINT_GLSL = (v) => `
  {
    vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * ${v};
    float cs = cos(uTintHue), sn = sin(uTintHue);
    yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz * uTintSat;
    ${v} = max(mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq * uTintLight, 0.0);
  }`;

/* ── detail pass for models that ship with only a colour texture ──
   Derives the maps they're missing from that texture, once, at load:
   - normal map from luminance (Sobel), so printed panels and seams catch light
   - roughness map: matte body, glossier on bright saturated trims
   - emissive mask: the bright, saturated piping glows */
const DETAIL_SIZE = coarse ? 1024 : 2048; // full texture resolution on desktop, half on phones
function deriveMaps(image, { bump = 1.5, roughness = 0.6, glow = 0 }) {
  const N = DETAIL_SIZE;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(image, 0, 0, N, N);
  const src = g.getImageData(0, 0, N, N).data;

  const lum = new Float32Array(N * N), sat = new Float32Array(N * N), val = new Float32Array(N * N);
  for (let i = 0, p = 0; i < N * N; i++, p += 4) {
    const r = src[p] / 255, gg = src[p + 1] / 255, b = src[p + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    lum[i] = 0.299 * r + 0.587 * gg + 0.114 * b;
    val[i] = mx;
    sat[i] = mx > 0 ? (mx - mn) / mx : 0;
  }

  const make = () => { const d = g.createImageData(N, N); return d; };
  const nrm = make(), rgh = make(), emi = make();
  const at = (x, y) => lum[((y + N) % N) * N + ((x + N) % N)];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const i = y * N + x, p = i * 4;
      // Sobel gradient of luminance as height
      const dx = (at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const dy = (at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)) - (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      let nx = -dx * bump, ny = -dy * bump, nz = 1;
      const inv = 1 / Math.hypot(nx, ny, nz);
      nrm.data[p] = (nx * inv * 0.5 + 0.5) * 255;
      nrm.data[p + 1] = (ny * inv * 0.5 + 0.5) * 255;
      nrm.data[p + 2] = (nz * inv * 0.5 + 0.5) * 255;
      nrm.data[p + 3] = 255;

      const trim = Math.min(1, Math.max(0, (sat[i] * val[i] - 0.35) * 3)); // bright + saturated
      const grain = (Math.random() - 0.5) * 0.06;                         // micro-variation
      const r = Math.min(1, Math.max(0.08, roughness - trim * 0.35 + (0.5 - lum[i]) * 0.12 + grain));
      rgh.data[p] = rgh.data[p + 1] = rgh.data[p + 2] = r * 255;
      rgh.data[p + 3] = 255;

      const e = glow ? trim : 0;
      emi.data[p] = src[p] * e; emi.data[p + 1] = src[p + 1] * e; emi.data[p + 2] = src[p + 2] * e;
      emi.data[p + 3] = 255;
    }
  }

  const toTex = (data, srgb) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    cv.getContext('2d').putImageData(data, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.flipY = false; // glTF texture convention
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = 8;
    return t;
  };
  return { normal: toTex(nrm), rough: toTex(rgh), emissive: glow ? toTex(emi, true) : null };
}

// returns an upgraded physical material: derived maps + fabric sheen + a thin clear coat
function addDetail(material, detail) {
  if (!material.map || material.normalMap || !material.map.image) return material;
  const maps = deriveMaps(material.map.image, detail);
  const m = new THREE.MeshPhysicalMaterial({
    map: material.map,
    normalMap: maps.normal,
    normalScale: new THREE.Vector2(1, -1), // glTF's green-channel convention
    roughnessMap: maps.rough,
    roughness: 1,
    metalness: 0,
    sheen: detail.sheen ?? 0.2,          // the soft edge glow knit and mesh get at grazing angles (more turns milky)
    sheenRoughness: 0.75,
    sheenColor: new THREE.Color(0xffffff),
    clearcoat: detail.clearcoat ?? 0.15, // moulded TPU / coated leather
    clearcoatRoughness: 0.35,
  });
  if (maps.emissive) {
    m.emissiveMap = maps.emissive;
    m.emissive.set(0xffffff);
    m.emissiveIntensity = detail.glow;
  }
  material.dispose();
  return m;
}

function addTint(material, uniforms) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.fragmentShader = 'uniform float uTintHue, uTintSat, uTintLight;\n' + shader.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>' + TINT_GLSL('diffuseColor.rgb'))
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>' + TINT_GLSL('totalEmissiveRadiance'));
  };
  material.customProgramCacheKey = () => 'slab-tint';
  material.needsUpdate = true;
}

export function loadShoe(shoeDef, onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    loader.load(new URL(shoeDef.file, BASE).href, (gltf) => {
      const shoe = gltf.scene;
      const parser = gltf.parser;

      let box = new THREE.Box3().setFromObject(shoe);
      let size = box.getSize(new THREE.Vector3());
      if (size.z > size.x) shoe.rotation.y = Math.PI / 2;
      box = new THREE.Box3().setFromObject(shoe);
      size = box.getSize(new THREE.Vector3());
      shoe.scale.multiplyScalar(3 / size.x);
      box = new THREE.Box3().setFromObject(shoe);
      const c = box.getCenter(new THREE.Vector3());
      shoe.position.sub(new THREE.Vector3(c.x, box.min.y, c.z));

      // root is free for callers to move; the inner holder carries the orientation fix
      const root = new THREE.Group(), holder = new THREE.Group();
      holder.add(shoe);
      root.add(holder);
      // the heel collar is usually the tallest part, so if it's on +X the shoe is backwards;
      // a shoe can override the guess with `flip`
      const backwards = shoeDef.flip ?? heightAt(root, 1.1) > heightAt(root, -1.1);
      if (backwards) holder.rotation.y = Math.PI;
      root.updateMatrixWorld(true);

      const tint = { uTintHue: { value: 0 }, uTintSat: { value: 1 }, uTintLight: { value: 1 } };
      const hasVariants = !!gltf.userData.gltfExtensions?.KHR_materials_variants;
      let tris = 0;
      shoe.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        // sharper textures at grazing angles (most of what a scroll-past camera sees)
        Object.values(o.material).forEach((v) => { if (v?.isTexture) v.anisotropy = 8; });
        if (shoeDef.detail) o.material = addDetail(o.material, shoeDef.detail);
        if (!hasVariants) addTint(o.material, tint);
        o.userData.mat = o.material;
        tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });

      let wire = null;
      async function selectVariant(i) {
        const jobs = [];
        shoe.traverse((o) => {
          const vx = o.isMesh && o.userData.gltfExtensions?.KHR_materials_variants;
          if (!vx) return;
          const m = vx.mappings.find((m) => m.variants.includes(i));
          jobs.push((async () => {
            if (m) o.userData.mat = await parser.getDependency('material', m.material);
            if (!wire) o.material = o.userData.mat;
          })());
        });
        await Promise.all(jobs);
      }

      async function setColorway(cw) {
        if (cw.variant != null) return selectVariant(cw.variant);
        tint.uTintHue.value = THREE.MathUtils.degToRad(cw.tint.hue);
        tint.uTintSat.value = cw.tint.sat;
        tint.uTintLight.value = cw.tint.light;
      }

      function setWire(mat) {
        wire = mat;
        shoe.traverse((o) => { if (o.isMesh) o.material = wire || o.userData.mat; });
      }

      function dispose() {
        shoe.traverse((o) => {
          if (!o.isMesh) return;
          o.geometry.dispose();
          [].concat(o.userData.mat ?? o.material).forEach((m) => {
            Object.values(m).forEach((v) => { if (v?.isTexture) v.dispose(); });
            m.dispose();
          });
        });
      }

      resolve({ root, def: shoeDef, setColorway, setWire, dispose, tris: Math.round(tris) });
    }, (e) => onProgress(Math.min(e.loaded / (e.total || shoeDef.bytes), 1)), reject);
  });
}

const ray = new THREE.Raycaster();
function heightAt(root, x) {
  root.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(x, 10, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(root, true)[0];
  return hit ? hit.point.y : 0;
}
