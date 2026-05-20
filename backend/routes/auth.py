import base64
import json
import os
import re
from fastapi import APIRouter, HTTPException
from models.schemas import AuthRequest, SaveSessionRequest

router = APIRouter()

USER_DB_DIR = "./db_data/users"

def decode_google_id_token(token: str):
    """
    Decodes the payload of a Google JWT credentials token safely.
    Does not require external OAuth libraries, which facilitates offline dev.
    """
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        payload_b64 = parts[1]
        # Pad payload_b64 for valid base64 decoding
        payload_b64 += "=" * ((4 - len(payload_b64) % 4) % 4)
        payload_json = base64.b64decode(payload_b64).decode("utf-8")
        return json.loads(payload_json)
    except Exception as e:
        print("Error decoding Google token:", e)
        return None

def get_user_dir(email: str) -> str:
    """Returns safe path to user storage folder."""
    safe_email = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    user_path = os.path.join(USER_DB_DIR, safe_email)
    os.makedirs(user_path, exist_ok=True)
    return user_path

@router.post("/google-login")
async def google_login(request: AuthRequest):
    """
    Receives Google OAuth credential token, decodes user info,
    and initializes their isolated storage environment.
    """
    payload = decode_google_id_token(request.credential)
    if not payload:
        raise HTTPException(status_code=400, detail="Invalid Google credentials token.")
    
    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=400, detail="Credential payload lacks an email.")
    
    user_dir = get_user_dir(email)
    profile_path = os.path.join(user_dir, "profile.json")
    
    profile = {
        "email": email,
        "name": payload.get("name", "User"),
        "picture": payload.get("picture", ""),
        "given_name": payload.get("given_name", "")
    }
    
    with open(profile_path, "w") as f:
        json.dump(profile, f, indent=2)
        
    return {
        "status": "success",
        "user": profile
    }

@router.get("/history/{email}")
async def get_user_history(email: str):
    """
    Loads all previous interview sessions and stats for this user.
    """
    user_dir = get_user_dir(email)
    history_path = os.path.join(user_dir, "sessions.json")
    
    if not os.path.exists(history_path):
        return []
        
    try:
        with open(history_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading sessions for {email}: {e}")
        return []

@router.post("/save-session")
async def save_session(request: SaveSessionRequest):
    """
    Persists interview data (chats, verdicts, critiques, final report)
    to the user's isolated local history directory.
    """
    user_dir = get_user_dir(request.user_email)
    history_path = os.path.join(user_dir, "sessions.json")
    
    sessions = []
    if os.path.exists(history_path):
        try:
            with open(history_path, "r") as f:
                sessions = json.load(f)
        except Exception as e:
            print("Failed to read existing sessions:", e)
            
    # Structure session record
    import time
    session_record = {
        "id": f"sess_{int(time.time())}",
        "timestamp": time.time(),
        "session_type": request.session_type,
        "history": [m.model_dump() for m in request.history],
        "critiques": request.critiques,
        "results": request.results,
        "report": request.report
    }
    
    sessions.append(session_record)
    
    with open(history_path, "w") as f:
        json.dump(sessions, f, indent=2)
        
    # Inject into RAG context by storing summary of this session in user RAG collections
    try:
        from modules.rag.vector_store import VectorStore
        from routes.auth import get_collection_name
        
        user_coll = get_collection_name(request.user_email)
        vector_db = VectorStore(collection_name=user_coll)
        
        # Embed key strengths/weaknesses if report is present
        report_text = request.report if request.report else "Interview session completed."
        doc_id = f"past_session_{session_record['id']}"
        vector_db.add_document(
            doc_id=doc_id,
            text=f"Historical performance summary ({request.session_type} round):\n{report_text}",
            metadata={"source": "past_session", "type": "history_rag"}
        )
    except Exception as err:
        print(f"Failed to index session summary into user RAG: {err}")
        
    return {
        "status": "success",
        "session_id": session_record["id"]
    }

def get_collection_name(email: str) -> str:
    """Helper to convert email into ChromaDB compliant collection name."""
    if not email:
        return "interview_data"
    clean = re.sub(r'[^a-zA-Z0-9_-]', '_', email)
    name = f"user_{clean}"[:63]
    return name
