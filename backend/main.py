from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import interview, technical, report, voice   # 👈 added voice

app = FastAPI(title="IntelliView Pro Orchestrator")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview.router)
app.include_router(technical.router)
app.include_router(report.router)
app.include_router(voice.router)   # 👈 added