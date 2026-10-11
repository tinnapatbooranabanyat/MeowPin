from dataclasses import dataclass
from functools import lru_cache

import numpy as np
import onnxruntime as ort
from PIL import Image

from .config import settings

# id ของ COCO แบบ 90 คลาสที่ SSD-MobileNet ใช้
COCO_CAT = 17
COCO_LABELS = {1: "person", 16: "bird", 17: "cat", 18: "dog", 88: "teddy bear"}


@dataclass
class Detection:
    is_cat: bool
    score: float
    other_label: str | None = None


@lru_cache(maxsize=1)
def _session() -> ort.InferenceSession:
    if not settings.model_path.exists():
        raise RuntimeError(
            f"ไม่พบโมเดลที่ {settings.model_path} — รัน python scripts/download_model.py ก่อน"
        )
    return ort.InferenceSession(str(settings.model_path), providers=["CPUExecutionProvider"])


def warm_up() -> None:
    _session()


def detect_cat(image: Image.Image) -> Detection:
    """ตรวจว่ามีแมวในรูปไหม — โมเดลรับ uint8 NHWC ขนาดใดก็ได้ แล้วย่อเป็น 300x300 เอง"""
    pixels = np.asarray(image.convert("RGB"), dtype=np.uint8)[None]
    _boxes, classes, scores, _num = _session().run(None, {"inputs": pixels})
    classes, scores = classes[0].astype(int), scores[0]

    cat_scores = scores[classes == COCO_CAT]
    best_cat = float(cat_scores.max()) if cat_scores.size else 0.0
    if best_cat >= settings.cat_threshold:
        return Detection(is_cat=True, score=best_cat)

    other = next((int(c) for c, s in zip(classes, scores) if c != COCO_CAT and s >= 0.4), None)
    return Detection(is_cat=False, score=best_cat, other_label=COCO_LABELS.get(other) if other else None)
