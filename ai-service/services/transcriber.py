import asyncio
import os

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")

_model = None

def _load_model():
    global _model
    if _model is not None:
        return _model
    try:
        import whisper
        print(f"INFO: Loading Whisper model '{WHISPER_MODEL}'...")
        _model = whisper.load_model(WHISPER_MODEL)
        return _model
    except ImportError:
        raise RuntimeError("Whisper not installed — video interview transcription unavailable")
    except Exception as e:
        raise RuntimeError(f"Whisper unavailable: {e}") from e

async def transcribe(audio_path: str) -> dict:
    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _transcribe_sync, audio_path)

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
