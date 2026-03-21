import asyncio
import os
import whisper
from functools import lru_cache

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")  # tiny | base | small | medium | large

@lru_cache(maxsize=1)
def _load_model():
    return whisper.load_model(WHISPER_MODEL)

async def transcribe(audio_path: str) -> dict:
    """
    Run Whisper transcription in a thread pool to avoid blocking the event loop.
    Returns: { text, language, segments }
    """
    loop = asyncio.get_running_loop()
    result = await loop.run_in_executor(None, _transcribe_sync, audio_path)
    return result

def _transcribe_sync(audio_path: str) -> dict:
    model = _load_model()
    result = model.transcribe(audio_path, fp16=False, verbose=False)
    return {
        "text":     result["text"].strip(),
        "language": result.get("language", "en"),
        "segments": [
            {"start": s["start"], "end": s["end"], "text": s["text"].strip()}
            for s in result.get("segments", [])
        ],
    }
