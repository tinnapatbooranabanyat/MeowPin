from functools import lru_cache

from supabase import Client, create_client

from .config import settings


class NotConfigured(RuntimeError):
    pass


@lru_cache(maxsize=1)
def get_client() -> Client:
    if not settings.supabase_url or not settings.supabase_secret_key:
        raise NotConfigured("ยังไม่ได้ตั้งค่า SUPABASE_URL / SUPABASE_SECRET_KEY ใน backend/.env")
    return create_client(settings.supabase_url, settings.supabase_secret_key)


def public_photo_url(path: str | None) -> str | None:
    if not path:
        return None
    return f"{settings.supabase_url}/storage/v1/object/public/{settings.photo_bucket}/{path}"
