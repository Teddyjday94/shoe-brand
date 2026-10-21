# SLAB® Footwear

A mock-up sneaker brand site in an industrial-brutalist style. Three.js, no build step.

| Page | What's on it |
| --- | --- |
| `index.html` | Scroll-driven 3D inspection with hotspot callouts, drag to rotate, X-ray, colorway + size + reserve. `?v=1` opens a colorway. |
| `shop.html` | Three colorways with size pickers, shipping / returns / sizing |
| `lab.html` | Live render of the shoe on a pallet in a loading dock, three switchable security cameras, spec sheet |
| `rules.html` | The four rules + FAQ |

The cart lives in `localStorage`, so it follows you between pages. Nothing is sold — it's a mock-up.

## Code

- `js/ui.js` — shared on every page: cart + drawer, size picker, cursor, reveals
- `js/data.js` — products, prices, stock, sizes
- `js/shoe.js` — loads and normalises the 3D model, colorway switching
- `js/home.js`, `js/shop.js`, `js/lab.js` — one per page
- `assets/mk1-*.png` — product shots rendered from the 3D model

## Run

```bash
node server.mjs
```

Then open http://localhost:5173. Needs Node 18+. Three.js and fonts load from CDNs.

## Credits

- 3D model: "MaterialsVariantsShoe" © Shopify, [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/), via [Khronos glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets)
- Photos in `assets/flash.jpg` and `assets/stairs.jpg`: AI-generated (Artlist)
- SLAB is a fictional brand.
