from fastapi import APIRouter
from models.schemas import InterviewState
from services.voice_service import voice_interview

router = APIRouter()


# ============================================================
# 🎤 Voice Interview Endpoint
# ============================================================
@router.post("/voice-interview")
async def voice_interview_route(state: InterviewState):
    return voice_interview(state)