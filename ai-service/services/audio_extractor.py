import asyncio
import os
import tempfile

FFMPEG_BIN = os.getenv("FFMPEG_BIN", "ffmpeg")

async def extract_audio(video_path: str) -> str:
    """Extract audio from video file. Returns path to temp WAV file."""
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    audio_path = tmp.name
    tmp.close()

    cmd = [
        FFMPEG_BIN, "-y",
        "-i", video_path,
        "-vn",                  # no video
        "-acodec", "pcm_s16le", # WAV PCM
        "-ar", "16000",         # 16kHz — optimal for Whisper
        "-ac", "1",             # mono
        audio_path,
    ]

    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()

    if proc.returncode != 0:
        os.unlink(audio_path)
        raise RuntimeError(f"ffmpeg failed: {stderr.decode()}")

    return audio_path
