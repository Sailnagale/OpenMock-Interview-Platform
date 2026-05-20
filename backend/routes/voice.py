from fastapi import APIRouter
from pydantic import BaseModel
from models.schemas import InterviewState
from services.voice_service import voice_interview
from utils.voice_utils import text_to_speech_chunk

router = APIRouter()

class TTSRequest(BaseModel):
    text: str

# ============================================================
# 🎤 Voice Interview Endpoint
# ============================================================
@router.post("/voice-interview")
async def voice_interview_route(state: InterviewState):
    return voice_interview(state)

# ============================================================
# 🔊 TTS Generation Endpoint
# ============================================================
@router.post("/tts")
async def tts_route(request: TTSRequest):
    audio_b64 = text_to_speech_chunk(request.text)
    return {"audio": audio_b64}