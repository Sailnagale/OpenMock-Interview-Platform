from pydantic import BaseModel
from typing import List, Optional

class Message(BaseModel):
    role: str
    content: str

class InterviewState(BaseModel):
    user_input: Optional[str] = ""   # ✅ make optional
    history: List[Message]
    job_role: Optional[str] 
    interview_type: str
    current_question_id: Optional[str] = None

    # ✅ ADD THIS
    audio_input: Optional[str] = None

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str
    lm_studio_url: str

class ReportRequest(BaseModel):
    transcript: List[Message]
    technical_critiques: List[str]
    question_results: Optional[List[dict]] = []

class GenerateQuestionsRequest(BaseModel):
    job_role: str
    count: int = 30

class CodeSubmitRequest(BaseModel):
    question: str
    code: str
    language: str
    job_role: str