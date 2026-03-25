from fastapi import APIRouter
from fastapi.responses import StreamingResponse, HTMLResponse
from models.schemas import InterviewState
from services.interview_service import start_followup

router = APIRouter()

@router.get("/", response_class=HTMLResponse)
async def root():
    return "<h1>IntelliView Backend is Online</h1>"

@router.post("/start-or-followup")
async def start_or_followup(state: InterviewState):
    return start_followup(state)