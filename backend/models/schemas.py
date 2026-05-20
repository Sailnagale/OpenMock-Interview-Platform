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
    audio_input: Optional[str] = None
    
    # Auth & Progressive Technical round tracking
    user_email: Optional[str] = None
    technical_phase: Optional[str] = "coding"
    current_question_idx: Optional[int] = 0
    current_question_text: Optional[str] = ""
    submitted_code: Optional[str] = ""
    current_score: Optional[int] = 0
    follow_ups: Optional[List[str]] = []
    technical_intro_stage: Optional[int] = 0

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str
    lm_studio_url: str

class ReportRequest(BaseModel):
    transcript: List[Message]
    technical_critiques: List[str]
    question_results: Optional[List[dict]] = []
    user_email: Optional[str] = None

class GenerateQuestionsRequest(BaseModel):
    job_role: str
    count: int = 30
    difficulty: Optional[str] = "easy"

class CodeSubmitRequest(BaseModel):
    question: str
    code: str
    language: str
    job_role: str
    lm_studio_url: Optional[str] = "http://localhost:1234"
    user_email: Optional[str] = None
    current_question_idx: Optional[int] = 0

class AuthRequest(BaseModel):
    credential: str

class SaveSessionRequest(BaseModel):
    user_email: str
    session_type: str
    history: List[Message]
    critiques: Optional[List[str]] = []
    results: Optional[List[dict]] = []
    report: Optional[str] = ""

class NextQuestionRequest(BaseModel):
    job_role: str
    current_question_idx: int
    previous_score: int
    previous_difficulty: str
    lm_studio_url: Optional[str] = "http://localhost:1234"
    user_email: Optional[str] = None