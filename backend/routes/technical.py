from fastapi import APIRouter
from models.schemas import GenerateQuestionsRequest, CodeSubmitRequest, CodeAnalysisRequest, NextQuestionRequest
from services.technical_service import (
    generate_questions_service,
    submit_code_service,
    analyze_code_service,
    next_question_service
)

router = APIRouter()

@router.post("/generate-questions")
async def generate_questions(request: GenerateQuestionsRequest):
    return await generate_questions_service(request)


@router.post("/submit-code-answer")
async def submit_code_answer(request: CodeSubmitRequest):
    return await submit_code_service(request)


@router.post("/analyze-code-and-ask")
async def analyze_code_and_ask(request: CodeAnalysisRequest):
    return await analyze_code_service(request)

@router.post("/next-question")
async def get_next_question(request: NextQuestionRequest):
    return await next_question_service(request)