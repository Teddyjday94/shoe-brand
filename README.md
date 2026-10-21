# SLAB® Footwear

A mock-up sneaker brand site in an industrial-brutalist style. Three.js, no build step.

- Scroll-driven 3D inspection of the shoe with hotspot callouts, drag to rotate, X-ray wireframe
- Three colorways from the model's `KHR_materials_variants`
- Live 1-bit "CCTV" feed rendered from the same scene
- Inventory cards with product shots rendered from the 3D model at load, size pickers and a cart drawer (nothing is sold — it's a mock-up)

## Run

```bash
node server.mjs
```

Then open http://localhost:5173. Needs Node 18+. Three.js and fonts load from CDNs.

## Credits

- 3D model: "MaterialsVariantsShoe" © Shopify, [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/), via [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
- Photos in `assets/flash.jpg` and `assets/stairs.jpg`: AI-generated (Artlist)
- SLAB is a fictional brand.
