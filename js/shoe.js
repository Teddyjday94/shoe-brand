// loads any shoe in the line, normalised: toe points +X, 3 units long, sole on y=0
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const BASE = new URL('../', import.meta.url);
const loader = new GLTFLoader();

export function studioEnvironment(renderer) {
  return new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}

// hue-rotate / saturate / lighten a colour in YIQ space (for single-texture models)
const TINT_GLSL = (v) => `
  {
    vec3 yiq = mat3(0.299, 0.596, 0.211, 0.587, -0.274, -0.523, 0.114, -0.322, 0.312) * ${v};
    float cs = cos(uTintHue), sn = sin(uTintHue);
    yiq.yz = mat2(cs, sn, -sn, cs) * yiq.yz * uTintSat;
    ${v} = max(mat3(1.0, 1.0, 1.0, 0.956, -0.272, -1.106, 0.621, -0.647, 1.703) * yiq * uTintLight, 0.0);
  }`;

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
          [].concat(o.userData.mat).forEach((m) => {
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
