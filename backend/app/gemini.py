"""เรียก Gemini (generateContent) แบบขอผลเป็น JSON — ใช้ร่วมกันทั้งสรุปรีวิวและตรวจรูปแมว"""

import json
import logging

import httpx

from .config import settings

log = logging.getLogger("meowpin.gemini")

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


class GeminiError(RuntimeError):
    pass


def _body(system: str, parts: list[dict], schema: dict, max_tokens: int, with_thinking: bool) -> dict:
    config: dict = {
        "responseMimeType": "application/json",
        "responseSchema": schema,
        "temperature": 0.2,
        "maxOutputTokens": max_tokens,
    }
    if with_thinking:
        # งานสั้นๆ ไม่ต้องคิดเยอะ — ประหยัดโควตา (low ใช้ได้ทั้ง 3.8 Flash และ 3.5 Flash-Lite)
        config["thinkingConfig"] = {"thinkingLevel": "low"}
    return {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": config,
    }


def _post(body: dict, timeout: float) -> httpx.Response:
    return httpx.post(
        GEMINI_URL.format(model=settings.gemini_model),
        headers={"x-goog-api-key": settings.gemini_api_key},
        json=body,
        timeout=timeout,
    )


def generate_json(system: str, parts: list[dict], schema: dict, *, max_tokens: int = 2048, timeout: float = 40) -> dict:
    if not settings.gemini_api_key:
        raise GeminiError("ยังไม่ได้ตั้งค่า GEMINI_API_KEY")
    try:
        res = _post(_body(system, parts, schema, max_tokens, with_thinking=True), timeout)
        # ถ้ารุ่นที่เลือกไม่รับการตั้งค่า thinking ให้ลองใหม่แบบไม่ใส่
        if res.status_code == 400 and "thinking" in res.text.lower():
            res = _post(_body(system, parts, schema, max_tokens, with_thinking=False), timeout)
    except httpx.HTTPError as e:
        log.warning("gemini request failed: %s", e)
        raise GeminiError("เรียก AI ไม่สำเร็จ") from e
    if res.status_code != 200:
        log.warning("gemini %s: %s", res.status_code, res.text[:300])
        raise GeminiError("เรียก AI ไม่สำเร็จ")
    try:
        parts_out = res.json()["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts_out if not p.get("thought"))
        out = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        log.warning("gemini unexpected response: %s", res.text[:300])
        raise GeminiError("AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้") from e
    if not isinstance(out, dict):
        raise GeminiError("AI ตอบกลับมาในรูปแบบที่อ่านไม่ได้")
    return out
