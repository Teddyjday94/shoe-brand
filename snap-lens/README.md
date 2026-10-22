# SLAB® Snapchat foot try-on lenses

Three lens files, one per shoe, ready for Snap's **Lens Studio** footwear template. Each lens puts the pair on the user's feet with Snap's foot tracking and switches colorway from a carousel.

| File | Shoe | Inside (right + left of each) | Size |
| --- | --- | --- | --- |
| `slab-mk1-lens.glb` | MK-1 low runner | `R_MIDNIGHT` `L_MIDNIGHT` `R_BEACH` `L_BEACH` `R_STREET` `L_STREET` | 1.7 MB |
| `slab-hi1-lens.glb` | HI-1 mid-top | `R_ICE` `L_ICE` `R_BRICK` `L_BRICK` `R_SMOKE` `L_SMOKE` | 3.2 MB |
| `slab-trk1-lens.glb` | TRK-1 chunky trainer | `R_RAVE` `L_RAVE` `R_ACID` `L_ACID` `R_BLACKOUT` `L_BLACKOUT` | 2.4 MB |

All three are well under Snap's 8 MB lens limit. In every file:

- **Real size**: 30 cm long (US M 9), sole on the ground (y = 0).
- **Axes**: toe points **+X**, up is **+Y**, the wearer's right is **+Z**.
- **Left = mirrored right**: `L_*` is the same mesh mirrored, so the six shoes share one geometry and the size stays small.
- **Colour is baked in**: each colorway has its own material (`MK-1_MIDNIGHT` and so on). There are no custom shaders, so Lens Studio sees what the site shows.

## Before you start

- A Snapchat account, signed in at [my-lenses.snapchat.com](https://my-lenses.snapchat.com).
- **Lens Studio** (free, Windows or Mac) from [ar.snap.com/lens-studio](https://ar.snap.com/lens-studio). Foot tracking needs **4.34 or later**.
- The Snapchat app on your phone, to test the lens.

## Build one lens (repeat for each shoe)

1. **Start from the template.** Open Lens Studio. On the home screen, open the **Footwear Try-On** sample project. Save it as `SLAB MK-1`.
2. **Import the shoes.** Drag `slab-mk1-lens.glb` into the **Asset Browser**, then drag it from there into the scene. You'll see six shoes: `R_` and `L_` for each colorway.
   - The shoes should import at about 30 cm long. If they come in tiny (0.3 cm), set the imported object's scale to **100**.
3. **Replace the template shoe.** In the **Scene Hierarchy**, find the objects marked `[REPLACE_ME]` under the foot tracking objects:
   - Delete the template shoe meshes.
   - Drag `R_MIDNIGHT` under the **right** foot's object and `L_MIDNIGHT` under the **left**.
4. **Fit to the foot guide.**
   - In the **Foot Tracking** component, turn on **Add Default Occluder**. The grey feet that appear are the guide.
   - Move, rotate and scale each shoe until it **fully covers** its occluder foot, the way a shoe covers a foot. The toe should line up with the toes and the heel cup with the heel.
   - Usually you only need to rotate the shoe 90° on Y so its toe (+X) points along the guide's toe direction, then nudge it down until the sole sits under the foot.
   - If the mirrored shoe ends up on the wrong foot, swap `R_` and `L_`.
5. **Turn on Erase Shoes.** In the **Foot Tracking** component, enable **Erase Shoes**. It removes the user's real shoes from the camera feed, so ours sit cleanly. Leave **Occlude Feet** on if you want jeans to hang over the collar.
6. **Add the other colorways.** The template's **Shoe Controller** object has a **Shoe Scene Object** list, and the **Carousel** object has an icon list.
   - For each colorway: duplicate the foot tracking object, put that colorway's `R_` and `L_` shoes under it, and add it to the **Shoe Scene Object** list.
   - Add an icon for it in the **Carousel**. Use `assets/<shoe>-<colorway>.png` from this repo, e.g. `assets/mk1-beach.png`.
   - Copy the fit (position, rotation, scale) from the first colorway, so all three sit identically.
7. **Test on your feet.** Use **Pair to Snapchat** (top bar) to send the lens to your phone. Point the phone down at your feet and walk a few steps:
   - The shoes should stay locked to your feet.
   - The carousel should switch colorways.
   - If they slide forward or back, adjust the fit in step 4.
8. **Publish.** Click **Publish Lens**. Give it a name (`SLAB MK-1 TRY ON`), the icon (`assets/mk1-midnight.png`) and a preview image, set visibility to **Public**, and submit.
   - Snap reviews lenses before they go live, usually within a few days.

## Put it on the site

When a lens is approved, open it in [my-lenses.snapchat.com](https://my-lenses.snapchat.com) and copy its **share link** (`https://www.snapchat.com/lens/…`). Paste it into `js/data.js`:

```js
export const SNAP_LENSES = {
  mk1: 'https://www.snapchat.com/lens/…',
  hi1: null,
  trk1: null,
};
```

The **Try On** page (`tryon.html`) picks it up automatically:

- **Phones** get an **OPEN IN SNAPCHAT** button.
- **Desktops** get a QR code to scan with Snapchat.
- Shoes without a link yet show **LENS IN REVIEW**.

## Rebuilding these files

These were exported from the site's own 3D pipeline (`js/shoe.js`), so if a model or colorway changes in `js/data.js`, they should be re-exported to match. The same pipeline writes the room-AR files in `assets/ar/`.
