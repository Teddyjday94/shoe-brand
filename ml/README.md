# SLAB foot tracking (in-house)

Puts SLAB shoes on the user's feet in a phone browser, with no app and no third-party AR service.

```
camera frame ─► foot model (YOLO11n-pose, ONNX, onnxruntime-web)
             ─► 8 keypoints per foot
             ─► 3D pose per foot (PnP against a template foot; left/right picked by best fit)
             ─► One-Euro smoothing ─► three.js renders the shoe at that pose over the camera feed
```

| Piece | File |
| --- | --- |
| Keypoint definitions + template foot | `js/footspec.js` |
| Detector, PnP, smoothing (no three.js) | `js/foottrack.js` |
| Renderer (camera background, shoes, leg occluder, contact shadow) | `js/footscene.js` |
| Live page (hidden, beta) | `feet.html` + `js/feet.js` |
| Synthetic training data generator | `ml/gen.html` |
| Training / export | `ml/train.py` |
| Offline tester on videos / photos | `ml/videotest.html` |
| Dev server that saves generated data | `ml/datasrv.mjs` |

## Keypoints

`toe`, `heel`, `ball_medial`, `ball_lateral`, `instep`, `ankle`, `heel_top`, `mid_lateral`.

Medial/lateral (inner/outer), not left/right, so labels keep their meaning when an image is mirrored. The tracker decides which foot is which by fitting both a right and a mirrored left template, and keeping the better fit.

## Run it

```bash
node ml/datasrv.mjs
```

Serves the repo on :5174 and accepts generated files into `ml/data/`.

1. **Data:** open `http://localhost:5174/ml/gen.html?preview=16` and check the labelled sheet at `ml/data/preview.jpg`. Then generate:
   - `gen.html?split=train&start=0&count=12000&seed=101`
   - `gen.html?split=val&start=0&count=1000&seed=202`
   - Round 2 added bare and socked feet, any phone roll and close-ups: `split=train&start=12000&count=8000&seed=101` and `split=val&start=1000&count=800&seed=202`. Bare/socked feet are labelled with the shoe template's keypoints, i.e. where the shoe would sit.
2. **Train** on the local GPU (GTX 1080: PyTorch 2.7.1 cu126 build, which still supports Pascal):

   ```bash
   ml/.venv/Scripts/python ml/train.py --epochs 60
   ```

   To fine-tune on new data from an earlier run: `--name foot2 --weights ml/runs/foot/weights/best.pt --epochs 30`. If Windows kills a run with error 1455 (paging file), `--resume --name <run>` picks it up again.
3. **Export** to `assets/ml/foot.onnx`, which the live page loads:

   ```bash
   ml/.venv/Scripts/python ml/train.py --export
   ```
4. **Test** offline:
   - Put photos or a phone clip in `ml/data/test/`.
   - Open `videotest.html?images=ml/data/test/a.jpg,…` or `videotest.html?video=ml/data/test/clip.mp4&fps=15&out=clip`.
   - Frames land in `ml/data/vidout/<out>/`. Stitch them with:

   ```bash
   ffmpeg -framerate 15 -i ml/data/vidout/clip/f%04d.jpg -pix_fmt yuv420p clip.mp4
   ```

`ml/data/`, `ml/runs/`, `ml/.venv/` and `ml/.wheels/` are not committed.

## Known limits (first version)

- Trained on synthetic renders of the three SLAB shoes with randomised textures, legs, floors and lighting, so real-world accuracy depends on how well that transfers. Real labelled photos would be the next step.
- It covers the user's real shoe with a slightly oversized virtual one. It doesn't erase the real shoe.
- WebGPU hangs on some drivers (it does on the dev PC's GTX 1080). The detector gives each GPU run 2 s, then switches to wasm for good.
- The phone's field of view is assumed (64° on the long side). Scale and depth trade off against each other, so overlays still line up.
