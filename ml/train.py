"""Train the SLAB foot keypoint model (YOLO11n-pose, 1 class, 8 keypoints).

    ml/.venv/Scripts/python ml/train.py              # train
    ml/.venv/Scripts/python ml/train.py --export     # export best.pt -> assets/ml/foot.onnx
    ml/.venv/Scripts/python ml/train.py --name foot2 --weights ml/runs/foot/weights/best.pt --epochs 30
    ml/.venv/Scripts/python ml/train.py --name foot3 --weights ml/runs/foot2/weights/best.pt --real 12 --limit 8000 --epochs 30

Data comes from ml/gen.html (synthetic) under ml/data/synth/{images,labels}/{train,val}.
Keypoint order and meaning: ml/footspec.js.
"""
import argparse
import json
import shutil
from pathlib import Path

ML = Path(__file__).resolve().parent
DATA = ML / "data" / "synth"
REAL = ML / "data" / "real"  # labelled real frames (ml/prep_real.py + ml/label.html)
RUNS = ML / "runs"
IMGSZ = 384  # small enough for phones; feet are large in frame


def real_split() -> tuple[list[Path], list[Path]]:
    """YOLO labels from the labeller (ml/label.html → ml/data/real/ann/*.json).

    Returns (train images, val images). Val is the last 15% of each clip (neighbouring frames
    are near-duplicates, so a random split would flatter the score) and every 5th photo."""
    lab = REAL / "labels"
    lab.mkdir(parents=True, exist_ok=True)
    clips: dict[str, list[Path]] = {}
    for a in sorted((REAL / "ann").glob("*.json")):
        d = json.loads(a.read_text())
        if d["status"] == "skip":
            continue
        w, h = d["w"], d["h"]
        lines = []
        for f in d["feet"]:
            pts = [(x, y) for x, y, v in f["kps"] if v]
            # box: the dots span the shoe from toe to heel and floor to collar; pad a little
            x0, x1, y0, y1 = min(p[0] for p in pts), max(p[0] for p in pts), min(p[1] for p in pts), max(p[1] for p in pts)
            px, py = (x1 - x0) * 0.06 + 4, (y1 - y0) * 0.06 + 4
            x0, x1, y0, y1 = max(0, x0 - px), min(w, x1 + px), max(0, y0 - py), min(h, y1 + py)
            kps = " ".join(f"{x / w:.5f} {y / h:.5f} {v}" if v else "0 0 0" for x, y, v in f["kps"])
            lines.append(f"0 {(x0 + x1) / 2 / w:.5f} {(y0 + y1) / 2 / h:.5f} {(x1 - x0) / w:.5f} {(y1 - y0) / h:.5f} {kps}")
        (lab / f"{a.stem}.txt").write_text("\n".join(lines))  # "no feet" frames: empty = background
        clip = "photo" if a.stem.startswith("photo_") else a.stem.rsplit("_", 1)[0]
        clips.setdefault(clip, []).append(REAL / "images" / f"{a.stem}.jpg")
    train, val = [], []
    for clip, imgs in clips.items():
        if clip == "photo":
            for i, p in enumerate(imgs):
                (val if i % 5 == 4 else train).append(p)
        else:
            cut = round(len(imgs) * 0.85)
            train += imgs[:cut]
            val += imgs[cut:]
    return train, val


def dataset_yaml(limit: int = 0, real: int = 0) -> Path:
    y = ML / "data" / "foot.yaml"
    train, val = "images/train", "images/val"
    if limit or real:
        imgs = sorted((DATA / "images" / "train").glob("*.jpg"))
        if limit:  # quick runs: N images spread across the whole set (it was generated in rounds)
            imgs = imgs[:: max(1, len(imgs) // limit)][:limit]
        if real:
            # the labelled real frames, repeated so a few hundred count against thousands of renders
            rtrain, rval = real_split()
            imgs += rtrain * real
            vimgs = rval + sorted((DATA / "images" / "val").glob("*.jpg"))[:400]
            print(f"real frames: {len(rtrain)} train (x{real}), {len(rval)} val")
            vl = ML / "data" / "val_real.txt"
            vl.write_text("\n".join(p.as_posix() for p in vimgs), encoding="utf-8")
            val = vl.as_posix()
        lst = ML / "data" / "train_list.txt"
        lst.write_text("\n".join(p.as_posix() for p in imgs), encoding="utf-8")
        train = lst.as_posix()
    # medial/lateral keep their meaning under a horizontal flip (a mirrored left foot is a
    # right foot), so flip_idx is the identity.
    y.write_text(
        f"path: {DATA.as_posix()}\n"
        f"train: {train}\n"
        f"val: {val}\n"
        "kpt_shape: [8, 3]\n"
        "flip_idx: [0, 1, 2, 3, 4, 5, 6, 7]\n"
        "names:\n  0: foot\n",
        encoding="utf-8",
    )
    return y


def train(epochs: int, batch: int, resume: bool, limit: int, name: str, workers: int, weights: str, real: int):
    from ultralytics import YOLO

    if resume:
        model = YOLO(RUNS / name / "weights" / "last.pt")
        model.train(resume=True)
        return
    # COCO body-pose pretraining transfers well to feet; --weights fine-tunes an earlier foot run
    model = YOLO(weights or ML / "yolo11n-pose.pt")
    model.train(
        data=str(dataset_yaml(limit, real)),
        epochs=epochs,
        imgsz=IMGSZ,
        batch=batch,
        device=0,
        workers=workers,  # each Windows worker loads its own CUDA runtime: keep this low
        project=str(RUNS),
        name=name,
        exist_ok=True,
        patience=20,
        cos_lr=True,
        close_mosaic=8,
        # synthetic → real: lean on colour/geometry augmentation
        hsv_h=0.03, hsv_s=0.7, hsv_v=0.5,
        degrees=15, translate=0.15, scale=0.5, shear=2.0, perspective=0.0005,
        fliplr=0.5, mosaic=1.0, mixup=0.05,
        pose=12.0, kobj=1.0,
        plots=True,
    )


def export(name: str):
    from ultralytics import YOLO

    best = RUNS / name / "weights" / "best.pt"
    model = YOLO(best)
    onnx = Path(model.export(format="onnx", imgsz=IMGSZ, opset=12, simplify=True, dynamic=False))
    out = ML.parent / "assets" / "ml"
    out.mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx, out / "foot.onnx")
    print("exported", out / "foot.onnx", round((out / "foot.onnx").stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="train on N synthetic images spread across the set (quick runs)")
    ap.add_argument("--real", type=int, default=0, help="add the labelled real frames, repeated this many times")
    ap.add_argument("--name", default="foot", help="run name under ml/runs/")
    ap.add_argument("--workers", type=int, default=1, help="data loader processes (Windows paging-file limits)")
    ap.add_argument("--weights", default="", help="start from these weights (e.g. ml/runs/foot/weights/best.pt)")
    a = ap.parse_args()
    export(a.name) if a.export else train(a.epochs, a.batch, a.resume, a.limit, a.name, a.workers, a.weights, a.real)
