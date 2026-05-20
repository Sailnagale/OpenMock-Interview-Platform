import uvicorn
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# --- Route Imports ---
# Make sure these files exist in your 'routes' folder
from routes import interview, technical, report, voice

# --- RAG Module Imports ---
from modules.rag.file_processor import FileProcessor
from modules.rag.vector_store import VectorStore
from modules.rag.embedder import chunk_text
from modules.rag.retriever import Retriever

# --- Intelligence Imports ---
from intelligence.nlp_processor import NLPProcessor

app = FastAPI(title="IntelliView Pro Orchestrator")

# ============================================================
# 🛡️ MIDDLEWARE (CORS)
# ============================================================
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 🧠 GLOBALS & INITIALIZATION
# ============================================================
# Initialize core engines once for the lifecycle of the app
# These will be shared across routes
vector_db = VectorStore()
retriever = Retriever()

# Initialize the NLP Processor which handles Analysis + Reports
# We pass the retriever so the report can see RAG context
nlp_processor = NLPProcessor(nlp_engine=None, retriever=retriever)

# Alias for compatibility with routes expecting 'report_service'
report_service = nlp_processor

@app.get("/")
async def health_check():
    return {
        "status": "online", 
        "message": "IntelliView Pro Backend is running.",
        "active_modules": ["RAG", "NLP", "Voice", "Technical Evaluation"]
    }

# ============================================================
# 📄 RESUME UPLOAD & PROCESSING
# ============================================================
@app.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...)):
    """
    Handles Resume uploads. Extracts text, chunks it, 
    and stores it in the Vector Database (ChromaDB).
    """
    try:
        # 1. Read raw binary content
        content = await file.read()
        
        # 2. Extract Text (Supports PDF, DOCX, TXT via FileProcessor)
        raw_text = FileProcessor.extract_text(content, file.filename)
        
        if not raw_text or not raw_text.strip():
            raise HTTPException(
                status_code=400, 
                detail="File appears to be empty or text could not be extracted."
            )

        # 3. Chunking for Vector DB precision
        chunks = chunk_text(raw_text)
        
        # 4. Store each chunk in ChromaDB
        for i, chunk in enumerate(chunks):
            vector_db.add_document(
                doc_id=f"{file.filename}_{i}",
                text=chunk,
                metadata={"source": file.filename, "type": "resume"}
            )
            
        return {
            "status": "success",
            "filename": file.filename,
            "extracted_text": raw_text, # Sent back for the Frontend Preview Modal
            "chunks_processed": len(chunks),
            "message": "Resume analyzed and stored in vector memory."
        }
    
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        print(f"Upload Error: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error.")

# ============================================================
# 📊 ANALYTICS & REPORTING
# ============================================================
# This matches the endpoint your frontend is looking for
@app.get("/api/report/generate/{session_id}")
async def get_report(session_id: str):
    """
    Generates the final 9-point report card.
    """
    try:
        # Dummy data structure to feed the generator
        # In a full app, fetch the actual history from your DB/State
        mock_candidate_data = {
            "name": "Candidate",
            "role": "Software Engineer",
            "history": [], 
            "code": []
        }

        # Calls the method inside intelligence/nlp_processor.py
        report_data = report_service.generate_comprehensive_report(mock_candidate_data)
        return report_data
    except Exception as e:
        print(f"Report Generation Error: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate report.")

# ============================================================
# 🚀 ROUTER REGISTRATION
# ============================================================
# Ensure your React 'axios' calls use these prefixes (e.g., /api/interview/...)
app.include_router(interview.router, prefix="/api/interview", tags=["Interview"])
app.include_router(technical.router, prefix="/api/technical", tags=["Technical"])
app.include_router(report.router, prefix="/api/report", tags=["Report"])
app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])

if __name__ == "__main__":
    # Start the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)