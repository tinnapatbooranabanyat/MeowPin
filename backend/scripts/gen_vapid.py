"""สร้างคีย์ VAPID สำหรับแจ้งเตือนเด้งบนมือถือ — พิมพ์ออกมาเป็นบรรทัด .env (ห้ามเอาคีย์ลับขึ้น git)

ใช้: python scripts/gen_vapid.py
"""

import base64

from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid02


def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


vapid = Vapid02()
vapid.generate_keys()
private_raw = vapid.private_key.private_numbers().private_value.to_bytes(32, "big")
public_raw = vapid.public_key.public_bytes(serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint)
print(f"VAPID_PUBLIC_KEY={b64(public_raw)}")
print(f"VAPID_PRIVATE_KEY={b64(private_raw)}")
print("VAPID_SUBJECT=https://meowpin-th.vercel.app")
