from fastapi import APIRouter
from models.schemas import ReportRequest
from services.report_service import generate_report

router = APIRouter()

@router.post("/generate-final-report")
async def generate_final_report(request: ReportRequest):
    return await generate_report(request)