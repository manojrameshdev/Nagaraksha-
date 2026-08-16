"""Audio Transcription route using Groq Whisper API (whisper-large-v3-turbo).

Accepts audio files (WAV, MP3, WebM, M4A, OGG) or base64 audio payload and converts voice to text
in any language (Hindi, Kannada, Tamil, Telugu, Marathi, Bengali, English, etc.).
"""
from __future__ import annotations

import os
import tempfile
import httpx
from fastapi import APIRouter, File, UploadFile, Form
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class AudioBase64Request(BaseModel):
    audio_b64: str
    filename: Optional[str] = "audio.webm"
    language: Optional[str] = None


@router.post("/api/transcribe")
async def transcribe_audio(
    file: Optional[UploadFile] = File(None),
    language: Optional[str] = Form(None),
):
    """Transcribe uploaded audio file using Groq Whisper API."""
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return {
            "text": None,
            "source": "none",
            "error": "GROQ_API_KEY not configured. Falling back to browser speech recognition.",
        }

    if not file:
        return {"text": None, "source": "none", "error": "No audio file provided."}

    content = await file.read()
    if not content:
        return {"text": None, "source": "none", "error": "Empty audio file."}

    # Write temporary audio file to disk for httpx multipart upload
    ext = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        with open(tmp_path, "rb") as audio_file:
            files = {"file": (file.filename or f"audio{ext}", audio_file, file.content_type or "audio/webm")}
            data = {"model": "whisper-large-v3-turbo", "response_format": "verbose_json"}
            if language:
                data["language"] = language

            resp = httpx.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {key}"},
                files=files,
                data=data,
                timeout=60,
            )

        if resp.status_code == 200:
            result = resp.json()
            text = result.get("text", "").strip()
            detected_lang = result.get("language", "auto")
            return {
                "text": text,
                "language": detected_lang,
                "duration": result.get("duration", 0),
                "source": "groq-whisper",
            }
        else:
            return {
                "text": None,
                "source": "groq-error",
                "error": f"Groq Whisper returned HTTP {resp.status_code}: {resp.text}",
            }
    except (httpx.HTTPError, OSError, ValueError, KeyError) as exc:
        return {"text": None, "source": "exception", "error": str(exc)}
    finally:
        if os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except OSError:
                pass


@router.post("/api/transcribe-b64")
async def transcribe_b64(body: AudioBase64Request):
    """Transcribe base64 encoded audio using Groq Whisper API."""
    import base64

    key = os.environ.get("GROQ_API_KEY")
    if not key:
        return {
            "text": None,
            "source": "none",
            "error": "GROQ_API_KEY not configured.",
        }

    b64 = body.audio_b64
    if "," in b64:
        b64 = b64.split(",", 1)[1]

    try:
        raw_bytes = base64.b64decode(b64)
        ext = os.path.splitext(body.filename or "audio.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(raw_bytes)
            tmp_path = tmp.name

        try:
            with open(tmp_path, "rb") as audio_file:
                files = {"file": (body.filename or f"audio{ext}", audio_file, "audio/webm")}
                data = {"model": "whisper-large-v3-turbo", "response_format": "verbose_json"}
                if body.language:
                    data["language"] = body.language

                resp = httpx.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {key}"},
                    files=files,
                    data=data,
                    timeout=60,
                )

            if resp.status_code == 200:
                result = resp.json()
                return {
                    "text": result.get("text", "").strip(),
                    "language": result.get("language", "auto"),
                    "duration": result.get("duration", 0),
                    "source": "groq-whisper",
                }
            else:
                return {"text": None, "source": "groq-error", "error": resp.text}
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
    except (httpx.HTTPError, OSError, ValueError, KeyError) as exc:
        return {"text": None, "source": "exception", "error": str(exc)}

