from io import BytesIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_SIDE = 1280
# กันไฟล์ที่แกล้งประกาศขนาดใหญ่มาก (decompression bomb)
Image.MAX_IMAGE_PIXELS = 40_000_000


class InvalidImage(ValueError):
    pass


def open_image(data: bytes) -> Image.Image:
    try:
        image = Image.open(BytesIO(data))
        image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise InvalidImage("ไฟล์นี้ไม่ใช่รูปภาพ หรือรูปเสีย") from e
    # หมุนตาม EXIF ก่อน (ถ้ามี) แล้วค่อยทิ้ง EXIF ตอน encode ใหม่
    return ImageOps.exif_transpose(image).convert("RGB")


def to_public_webp(image: Image.Image) -> bytes:
    """encode ใหม่เป็น WebP ไม่มี metadata ใดๆ ติดไป — กันพิกัด GPS ในรูปหลุดสู่สาธารณะ"""
    image = image.copy()
    image.thumbnail((MAX_SIDE, MAX_SIDE))
    out = BytesIO()
    image.save(out, "WEBP", quality=80, method=4)
    return out.getvalue()
