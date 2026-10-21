// loads the MK-1 model, normalised: toe points +X, 3 units long, sole on y=0
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const SHOE_URL = new URL('../assets/shoe.glb', import.meta.url).href;
export const SHOE_BYTES = 7833592;

export function studioEnvironment(renderer) {
  return new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
}

export function loadShoe(onProgress = () => {}) {
  return new Promise((resolve, reject) => {
    new GLTFLoader().load(SHOE_URL, (gltf) => {
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
      // the heel collar is the tallest part, so if it's on +X the shoe is backwards
      if (heightAt(root, 1.1) > heightAt(root, -1.1)) holder.rotation.y = Math.PI;
      root.updateMatrixWorld(true);

      let tris = 0;
      shoe.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true;
        o.userData.mat = o.material;
        tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      });

      const ext = gltf.userData.gltfExtensions?.KHR_materials_variants;
      const variantNames = ext ? ext.variants.map((v) => v.name) : ['default'];
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

      function setWire(mat) {
        wire = mat;
        shoe.traverse((o) => { if (o.isMesh) o.material = wire || o.userData.mat; });
      }

      resolve({ root, variantNames, selectVariant, setWire, tris: Math.round(tris) });
    }, (e) => onProgress(Math.min(e.loaded / (e.total || SHOE_BYTES), 1)), reject);
  });
}

const ray = new THREE.Raycaster();
function heightAt(root, x) {
  root.updateMatrixWorld(true);
  ray.set(new THREE.Vector3(x, 10, 0), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(root, true)[0];
  return hit ? hit.point.y : 0;
}
