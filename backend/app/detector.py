from dataclasses import dataclass
from functools import lru_cache

from typing import TYPE_CHECKING

import numpy as np
from PIL import Image

from .config import settings

# id ของ COCO แบบ 90 คลาสที่ SSD-MobileNet ใช้
COCO_CAT = 17
COCO_LABELS = {1: "person", 16: "bird", 17: "cat", 18: "dog", 88: "teddy bear"}
MAX_INPUT_SIDE = 640


@dataclass
class Detection:
    is_cat: bool
    score: float
    other_label: str | None = None


if TYPE_CHECKING:
    import onnxruntime as ort


@lru_cache(maxsize=1)
def _session() -> "ort.InferenceSession":
    # import ตอนใช้ครั้งแรกเท่านั้น (ใช้แค่ตอน Gemini ใช้ไม่ได้) — import อย่างเดียวก็ 10 วินาทีบน Render ฟรี
    import onnxruntime as ort

    if not settings.model_path.exists():
        raise RuntimeError(
            f"ไม่พบโมเดลที่ {settings.model_path} — รัน python scripts/download_model.py ก่อน"
        )
    # Render แบบฟรีได้ CPU แค่ 0.1 คอร์ — หลาย thread มีแต่แย่งกันเอง
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    return ort.InferenceSession(str(settings.model_path), options, providers=["CPUExecutionProvider"])


def warm_up() -> None:
    _session()


def detect_cat(image: Image.Image) -> Detection:
    """ตรวจว่ามีแมวในรูปไหม — โมเดลรับ uint8 NHWC ขนาดใดก็ได้ แล้วย่อเป็น 300x300 เอง"""
    # โมเดลย่อเหลือ 300x300 เองอยู่แล้ว — ย่อก่อนให้เบาลง (ผลตรวจไม่ต่าง)
    small = image.convert("RGB")
    if max(small.size) > MAX_INPUT_SIDE:
        small = small.copy()
        small.thumbnail((MAX_INPUT_SIDE, MAX_INPUT_SIDE))
    pixels = np.asarray(small, dtype=np.uint8)[None]
    _boxes, classes, scores, _num = _session().run(None, {"inputs": pixels})
    classes, scores = classes[0].astype(int), scores[0]

    cat_scores = scores[classes == COCO_CAT]
    best_cat = float(cat_scores.max()) if cat_scores.size else 0.0
    if best_cat >= settings.cat_threshold:
        return Detection(is_cat=True, score=best_cat)

    other = next((int(c) for c, s in zip(classes, scores) if c != COCO_CAT and s >= 0.4), None)
    return Detection(is_cat=False, score=best_cat, other_label=COCO_LABELS.get(other) if other else None)
