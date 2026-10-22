"""Train the SLAB foot keypoint model (YOLO11n-pose, 1 class, 8 keypoints).

    ml/.venv/Scripts/python ml/train.py              # train
    ml/.venv/Scripts/python ml/train.py --export     # export best.pt -> assets/ml/foot.onnx

Data comes from ml/gen.html (synthetic) under ml/data/synth/{images,labels}/{train,val}.
Keypoint order and meaning: ml/footspec.js.
"""
import argparse
import shutil
from pathlib import Path

ML = Path(__file__).resolve().parent
DATA = ML / "data" / "synth"
RUNS = ML / "runs"
IMGSZ = 384  # small enough for phones; feet are large in frame


def dataset_yaml(limit: int = 0) -> Path:
    y = ML / "data" / "foot.yaml"
    train = "images/train"
    if limit:  # quick runs: train on the first N images only
        lst = ML / "data" / f"train_first{limit}.txt"
        imgs = sorted((DATA / "images" / "train").glob("*.jpg"))[:limit]
        lst.write_text("\n".join(p.as_posix() for p in imgs), encoding="utf-8")
        train = lst.as_posix()
    # medial/lateral keep their meaning under a horizontal flip (a mirrored left foot is a
    # right foot), so flip_idx is the identity.
    y.write_text(
        f"path: {DATA.as_posix()}\n"
        f"train: {train}\n"
        "val: images/val\n"
        "kpt_shape: [8, 3]\n"
        "flip_idx: [0, 1, 2, 3, 4, 5, 6, 7]\n"
        "names:\n  0: foot\n",
        encoding="utf-8",
    )
    return y


def train(epochs: int, batch: int, resume: bool, limit: int, name: str, workers: int):
    from ultralytics import YOLO

    if resume:
        model = YOLO(RUNS / name / "weights" / "last.pt")
        model.train(resume=True)
        return
    model = YOLO(ML / "yolo11n-pose.pt")  # COCO body-pose pretraining transfers well to feet
    model.train(
        data=str(dataset_yaml(limit)),
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
    ap.add_argument("--limit", type=int, default=0, help="train on the first N images only (quick runs)")
    ap.add_argument("--name", default="foot", help="run name under ml/runs/")
    ap.add_argument("--workers", type=int, default=1, help="data loader processes (Windows paging-file limits)")
    a = ap.parse_args()
    export(a.name) if a.export else train(a.epochs, a.batch, a.resume, a.limit, a.name, a.workers)
