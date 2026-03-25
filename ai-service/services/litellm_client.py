import os
import json
import re
import html
import httpx

SYSTEM_PROMPT = (
    "You are a senior technical recruiter at Juspay, a fintech company building "
    "high-performance payment products. You evaluate candidates objectively and "
    "respond ONLY with valid JSON — no markdown, no explanation."
)


def _sanitize(text: str, max_len: int = 8000) -> str:
    text = html.escape(str(text).strip())
    text = re.sub(r"(ignore|disregard|forget).{0,30}(above|previous|instructions)", "", text, flags=re.I)
    return text[:max_len]


def _extract_json(raw: str) -> str:
    start = raw.find("{")
    end = raw.rfind("}")
    if start == -1 or end == -1 or end < start:
        return raw
    return raw[start:end + 1]


async def litellm_generate(prompt: str, system: str = SYSTEM_PROMPT) -> str:
    grid_key   = os.getenv("JUSPAY_GRID_API_KEY")
    grid_base  = os.getenv("JUSPAY_GRID_BASE_URL", "https://grid.ai.juspay.net/v1")
    grid_model = os.getenv("JUSPAY_GRID_MODEL", "open-fast")

    if not grid_key:
        raise RuntimeError("JUSPAY_GRID_API_KEY is not set")

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{grid_base}/chat/completions",
            headers={"Authorization": f"Bearer {grid_key}", "Content-Type": "application/json"},
            json={
                "model": grid_model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user",   "content": prompt},
                ],
                "temperature": 0.2,
                "max_tokens": 2048,
            },
        )
        resp.raise_for_status()
        raw = resp.json()["choices"][0]["message"]["content"] or ""
        print(f"[grid/{grid_model}] raw: {raw[:200]}")
        return _extract_json(raw)


ollama_generate = litellm_generate