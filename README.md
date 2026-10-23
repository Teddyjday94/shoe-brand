# SLAB® Footwear

A mock-up sneaker brand site in an industrial-brutalist style. Three.js, no build step.

| Page | What's on it |
| --- | --- |
| `index.html` | Scroll-driven 3D inspection with hotspot callouts, drag to rotate, X-ray, model + colorway + size + reserve. `?s=hi1&c=2` opens a shoe and colorway. |
| `shop.html` | All shoes, grouped by model, with size pickers; shipping / returns / sizing |
| `tryon.html` | "See it in your room": life-size AR on phones (Quick Look / Scene Viewer / WebXR via model-viewer), QR hand-off on desktop |
| `lab.html` | Live render of any shoe on a pallet in a loading dock, three switchable security cameras, spec sheet |

## The line

| Shoe | Style | Colorways |
| --- | --- | --- |
| MK-1 | Low runner | Midnight, Beach, Street (material variants in the model) |
| HI-1 | Mid-top court | Ice, Brick, Smoke (texture tint) |
| TRK-1 | Chunky trainer | Rave, Acid, Blackout (texture tint) |

To add a shoe: drop its `.glb` in `assets/`, add an entry to `SHOES` in `js/data.js` (colorways use `variant` for models with `KHR_materials_variants`, otherwise a `tint` of hue / saturation / lightness), and render its product shots (`assets/<shoe>-<colorway>.png`, 1200×900, transparent).
| `rules.html` | The four rules + FAQ |

The cart lives in `localStorage`, so it follows you between pages. Nothing is sold — it's a mock-up.

## Code

- `js/ui.js` — shared on every page: cart + drawer, size picker, cursor, reveals
- `js/data.js` — products, prices, stock, sizes
- `js/shoe.js` — loads and normalises the 3D model, colorway switching
- `js/home.js`, `js/shop.js`, `js/lab.js` — one per page
- `js/tryon.js` — Try On page
- `assets/<shoe>-<colorway>.png` — product shots rendered from the 3D models
- `assets/ar/<shoe>-<colorway>.glb` — standalone AR models: 30 cm (US M 9), colorway and detail baked in
## Run

```bash
node server.mjs
```

Then open http://localhost:5173. Needs Node 18+. Three.js and fonts load from CDNs.

## Deploy

Static files, no build. Pushes to `main` deploy to production on Vercel: https://shoe-brand-amber.vercel.app

## Credits

- MK-1: "MaterialsVariantsShoe" © Shopify, [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/), via [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
- HI-1: ["Sneaker"](https://www.sloyd.ai/free-3d-models/model/sneaker-bsvvqs9l) by ShaderSculptor, generated with Sloyd, [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- TRK-1: ["A sleek, edgy sneaker with angular shapes, neon colors"](https://www.sloyd.ai/free-3d-models/model/a-sleek-edgy-sneaker-with-angular-shapes-neon-colors-oyqsgfgl) by PurpleShade3D, generated with Sloyd, [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Studio lighting: ["Studio Small 09"](https://polyhaven.com/a/studio_small_09) HDRI by Poly Haven, CC0 (`assets/studio.hdr`)
- `assets/film.mp4`: 15s product film rendered frame by frame from the site's own 3D scene and encoded with ffmpeg
- Photos in `assets/flash.jpg` and `assets/stairs.jpg`: AI-generated (Artlist)
- SLAB is a fictional brand.
