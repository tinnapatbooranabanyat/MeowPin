"""ดาวน์โหลดโมเดลตรวจจับวัตถุ SSD-MobileNet v1 (COCO, ~29 MB) จาก ONNX Model Zoo อย่างเป็นทางการ

รัน: python scripts/download_model.py
"""

import urllib.request
from pathlib import Path

URL = (
    "https://github.com/onnx/models/raw/main/validated/vision/"
    "object_detection_segmentation/ssd-mobilenetv1/model/ssd_mobilenet_v1_12.onnx"
)
DEST = Path(__file__).resolve().parent.parent / "models" / "ssd_mobilenet_v1_12.onnx"


def main() -> None:
    if DEST.exists():
        print(f"มีโมเดลอยู่แล้ว: {DEST}")
        return
    DEST.parent.mkdir(parents=True, exist_ok=True)
    print(f"กำลังดาวน์โหลด {URL}")
    urllib.request.urlretrieve(URL, DEST)
    print(f"เสร็จแล้ว: {DEST} ({DEST.stat().st_size / 1_000_000:.1f} MB)")


if __name__ == "__main__":
    main()
