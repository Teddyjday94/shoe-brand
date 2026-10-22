// Renders tracked feet: camera image as background, the chosen shoe on each foot.
// The virtual camera copies the tracker's intrinsics, so 3D poses land on the right pixels.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { applyStudio, contactShadow } from './shoe.js';
import { TEMPLATE_RIGHT } from './footspec.js';
import { arModel } from './data.js';

const BASE = new URL('../', import.meta.url);
const loader = new GLTFLoader();
// OpenCV camera (y down, z forward) → three.js camera (y up, z back): a 180° turn about X
const CV_TO_GL = new THREE.Quaternion(1, 0, 0, 0);

export class FootScene {
  constructor(canvas, { preserve = false } = {}) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: preserve });
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.02, 20);
    applyStudio(this.renderer, this.scene);
    this.key = new THREE.DirectionalLight(0xffffff, 1.6);
    this.key.position.set(0.3, 1, 0.6); // camera space: roughly the phone's own light direction
    this.camera.add(this.key);
    this.scene.add(this.camera, new THREE.AmbientLight(0xffffff, 0.3));
    // one slot per foot; each holds a shoe, a leg occluder and a contact shadow
    this.slots = { right: this.#slot(), left: this.#slot() };
    this.fit = 1.06; // a touch larger than the template so the real shoe hides inside
  }

  #slot() {
    const g = new THREE.Group();
    g.matrixAutoUpdate = false;
    g.visible = false;
    // depth-only cylinder where the leg leaves the shoe: hides the inside of the collar
    const ankle = TEMPLATE_RIGHT[5];
    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.042, 0.6, 24),
      new THREE.MeshBasicMaterial({ colorWrite: false }),
    );
    leg.position.set(ankle[0], ankle[1] + 0.3, ankle[2]);
    leg.renderOrder = -2;
    g.add(leg);
    this.scene.add(g);
    return { g, shoe: null, shadow: null, opacity: 0 };
  }

  setSource(el) {
    const tex = el instanceof HTMLVideoElement ? new THREE.VideoTexture(el) : new THREE.CanvasTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.bg = tex;
    this.scene.background = tex;
  }

  resize(K) {
    this.renderer.setSize(K.w, K.h, false);
    this.camera.aspect = K.w / K.h;
    this.camera.fov = (2 * Math.atan(K.h / 2 / K.fy) * 180) / Math.PI;
    this.camera.updateProjectionMatrix();
  }

  async setProduct(shoeId, colorKey) {
    const gltf = await loader.loadAsync(new URL(arModel(shoeId, colorKey), BASE).href);
    for (const side of ['right', 'left']) {
      const s = this.slots[side];
      if (s.shoe) { s.g.remove(s.shoe, s.shadow); }
      const shoe = side === 'right' ? gltf.scene : gltf.scene.clone(true);
      shoe.scale.set(this.fit, this.fit, this.fit * (side === 'left' ? -1 : 1));
      s.shoe = shoe;
      s.shadow = contactShadow(gltf.scene, 0.45);
      s.g.add(shoe, s.shadow);
    }
  }

  /** tracks: FeetTracker output. brightness: 0..1 average of the camera frame */
  update(tracks, brightness = 0.5, dt = 1 / 30) {
    this.scene.environmentIntensity = 0.25 + brightness * 0.9;
    this.key.intensity = 0.6 + brightness * 1.6;
    const bySide = {};
    for (const tr of tracks) if (!bySide[tr.pose.side] || tr.pose.err < bySide[tr.pose.side].pose.err) bySide[tr.pose.side] = tr;
    for (const side of ['right', 'left']) {
      const s = this.slots[side], tr = bySide[side];
      const target = tr ? 1 : 0;
      s.opacity += (target - s.opacity) * Math.min(1, dt * 12); // quick fade in/out, no popping
      s.g.visible = s.opacity > 0.02;
      if (tr) {
        const q = new THREE.Quaternion(...tr.pose.q);
        const qGL = CV_TO_GL.clone().multiply(q);
        const p = new THREE.Vector3(tr.pose.t[0], -tr.pose.t[1], -tr.pose.t[2]);
        s.g.matrix.compose(p, qGL, new THREE.Vector3(1, 1, 1));
        s.g.matrixWorldNeedsUpdate = true;
      }
      s.shoe?.traverse((o) => {
        if (!o.isMesh) return;
        o.material.transparent = s.opacity < 0.99;
        o.material.opacity = s.opacity;
      });
    }
  }

  render() { this.renderer.render(this.scene, this.camera); }
}
