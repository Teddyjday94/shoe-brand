"""Pick real frames to label and pre-fill them with the current model's guesses.

    ml/.venv/Scripts/python ml/prep_real.py

Writes ml/data/real/images/<name>.jpg, ml/data/real/pred/<name>.json and
ml/data/real/frames.json (the list ml/label.html works through). Labels the
user corrects land in ml/data/real/ann/<name>.json; train.py --real turns
them into a YOLO set.
"""
import json
from pathlib import Path

import cv2
from ultralytics import YOLO

ML = Path(__file__).resolve().parent
TEST = ML / "data" / "test"
REAL = ML / "data" / "real"
MAX_SIDE = 1280


def frames():
    """(name, image) pairs: every Nth frame of each clip, plus the stills."""
    clips = [  # (prefix, extracted frame folder, keep every Nth)
        ("feet1", TEST / "feet1", 4),  # barefoot, landscape, toes left
        ("feet2", TEST / "feet2", 6),  # socks, portrait, looking down
    ]
    for prefix, folder, step in clips:
        for i, p in enumerate(sorted(folder.glob("*.jpg"))):
            if i % step == 0:
                yield f"{prefix}_{p.stem}", cv2.imread(str(p))
    # phone screen recordings of the live page: keep the camera area only (below the title
    # bar, above the buttons), 3 frames a second
    for rec in sorted(TEST.glob("rec*.mp4")):
        cap = cv2.VideoCapture(str(rec))
        step = max(1, round(cap.get(cv2.CAP_PROP_FPS) / 3))
        i = 0
        while True:
            ok, f = cap.read()
            if not ok:
                break
            if i % step == 0:
                h = f.shape[0]
                yield f"{rec.stem}_{i:04d}", f[int(h * 0.07):int(h * 0.72)]
            i += 1
    for p in sorted(TEST.glob("*.jpg")):
        if p.stem.startswith(("u0", "c0", "own-")):
            yield f"photo_{p.stem.replace('-', '_')}", cv2.imread(str(p))


def main():
    model = YOLO(ML / "runs" / "foot2" / "weights" / "best.pt", task="pose")
    (REAL / "images").mkdir(parents=True, exist_ok=True)
    (REAL / "pred").mkdir(parents=True, exist_ok=True)
    names = []
    for name, img in frames():
        h, w = img.shape[:2]
        k = min(1.0, MAX_SIDE / max(h, w))
        if k < 1:
            img = cv2.resize(img, (round(w * k), round(h * k)), interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(REAL / "images" / f"{name}.jpg"), img, [cv2.IMWRITE_JPEG_QUALITY, 92])
        r = model.predict(img, imgsz=384, conf=0.15, iou=0.4, max_det=2, device="cpu", verbose=False)[0]
        feet = []
        for b, kp in zip(r.boxes, r.keypoints):
            xy, cf = kp.xy[0].tolist(), kp.conf[0].tolist()
            feet.append({"score": round(float(b.conf), 3), "kps": [[round(x, 1), round(y, 1), round(c, 2)] for (x, y), c in zip(xy, cf)]})
        (REAL / "pred" / f"{name}.json").write_text(json.dumps({"w": img.shape[1], "h": img.shape[0], "feet": feet}))
        names.append(name)
    (REAL / "frames.json").write_text(json.dumps(names))
    print(len(names), "frames ready in", REAL)


if __name__ == "__main__":
    main()
