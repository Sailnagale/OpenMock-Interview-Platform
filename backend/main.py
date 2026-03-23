import os
import json
import re
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, HTMLResponse
from pydantic import BaseModel
from typing import List, Optional
import httpx
from groq import Groq
from google import genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(title="IntelliView Pro Orchestrator")

# 1. Enable CORS for Frontend/Voice Integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize AI Clients
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

# --- Data Models ---
class Message(BaseModel):
    role: str
    content: str

class InterviewState(BaseModel):
    user_input: str
    history: List[Message]
    interview_type: str  # 'hr' or 'technical'
    current_question_id: Optional[str] = None

class CodeAnalysisRequest(BaseModel):
    code: str
    language: str
    lm_studio_url: str

class ReportRequest(BaseModel):
    transcript: List[Message]
    technical_critiques: List[str]
    question_results: Optional[List[dict]] = []

# --- New Models for Technical Round ---
class GenerateQuestionsRequest(BaseModel):
    job_role: str
    count: int = 30

class CodeSubmitRequest(BaseModel):
    question: str
    code: str
    language: str
    job_role: str

# --- Helper: Load Questions ---
def get_question_by_id(category: str, q_id: str):
    try:
        with open("questions.json", "r") as f:
            data = json.load(f)
            for q in data.get(category, []):
                if q['id'] == q_id:
                    return q['question']
    except Exception:
        return "Please introduce yourself and tell me about your background."
    return "Question not found."


# --- API Endpoints ---

@app.get("/", response_class=HTMLResponse)
async def root():
    return "<h1>IntelliView Backend is Online</h1><p>Go to <a href='/docs'>/docs</a> for API testing.</p>"


@app.post("/start-or-followup")
async def start_or_followup(state: InterviewState):
    """Handles the natural flow with ultra-fast Groq responses."""
    # 1. Start of interview: Fetch from JSON
    if not state.history and state.current_question_id:
        question_text = get_question_by_id(state.interview_type, state.current_question_id)
        return {"role": "assistant", "content": question_text}

    # 2. Natural Follow-up (Real-time Streaming)
    prompt = f"You are a professional {state.interview_type.upper()} interviewer. Ask one natural follow-up question based on the user's last answer. Keep it concise."

    def generate():
        messages = [{"role": "system", "content": prompt}] + [m.model_dump() for m in state.history] + [{"role": "user", "content": state.user_input}]
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True
        )
        for chunk in completion:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    return StreamingResponse(generate(), media_type="text/event-stream")


# ============================================================
# NEW: Technical Round — Generate Questions
# ============================================================
@app.post("/generate-questions")
async def generate_questions(request: GenerateQuestionsRequest):
    """Generate role-specific technical interview questions using Groq."""
    prompt = f"""You are a senior technical interviewer. Generate exactly {request.count} coding interview questions for a "{request.job_role}" position.

Rules:
- Mix difficulty: 40% easy, 40% medium, 20% hard
- Questions must be solvable with code (no theory-only)
- Each question should be a self-contained coding task
- Cover relevant technologies for the role
- Be concise: 1-3 sentences per question
- Number them 1 through {request.count}

Return ONLY the numbered list, no extra commentary."""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You generate technical interview questions. Return only the numbered list."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )
        raw = completion.choices[0].message.content.strip()

        # Parse numbered list into array
        lines = raw.split('\n')
        questions = []
        current = ""
        for line in lines:
            line = line.strip()
            if not line:
                continue
            # Detect new numbered question (e.g., "1.", "12.", "1)")
            if re.match(r'^\d+[\.\)]\s', line):
                if current:
                    questions.append(current)
                # Remove the number prefix
                current = re.sub(r'^\d+[\.\)]\s*', '', line)
            else:
                current += " " + line
        if current:
            questions.append(current)

        # Ensure we have enough questions
        if len(questions) <1:
            raise HTTPException(status_code=500, detail="AI produced too few questions. Please try again.")

        return {"questions": questions[:request.count]}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Question generation failed: {str(e)}")


# ============================================================
# NEW: Technical Round — Submit Code & Grade
# ============================================================
@app.post("/submit-code-answer")
async def submit_code_answer(request: CodeSubmitRequest):
    """Grade a candidate's code answer using Groq. Returns verdict + feedback."""
    prompt = f"""You are a strict but fair senior {request.job_role} interviewer grading a coding submission.

QUESTION: {request.question}
LANGUAGE: {request.language}
CODE:
```
{request.code}
```

Evaluate the code and respond in this EXACT JSON format:
{{
  "verdict": "PASS" or "FAIL" or "PARTIAL",
  "score": <0-100>,
  "feedback": "<1-2 sentence explanation of what's right/wrong>",
  "follow_up": "<1 sentence clever follow-up question about their approach>"
}}
# hii hahjajsjj

Grading rules:
- PASS: Code is correct, handles edge cases, score >= 70
- PARTIAL: Code has the right idea but bugs/missing edge cases, score 30-69
- FAIL: Code is wrong, doesn't compile, or empty, score < 30
- Be fair: if code logically solves the problem, give PASS even if not perfect
- If the code is empty or just comments, give FAIL with score 0

Return ONLY the JSON object, no markdown, no extra text."""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a code grader. Return ONLY valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )
        raw = completion.choices[0].message.content.strip()

        # Parse JSON from response (handle potential markdown wrapping)
        json_str = raw
        if "```" in raw:
            json_match = re.search(r'\{[\s\S]*\}', raw)
            if json_match:
                json_str = json_match.group()

        result = json.loads(json_str)

        # Sanitize
        verdict = result.get("verdict", "FAIL").upper()
        if verdict not in ("PASS", "FAIL", "PARTIAL"):
            verdict = "PARTIAL"

        return {
            "verdict": verdict,
            "score": max(0, min(100, int(result.get("score", 0)))),
            "feedback": result.get("feedback", "No feedback provided."),
            "follow_up": result.get("follow_up", "Can you explain your approach?")
        }

    except json.JSONDecodeError:
        # Fallback if AI didn't return valid JSON
        return {
            "verdict": "PARTIAL",
            "score": 40,
            "feedback": "The AI could not fully evaluate your code. Please check for syntax issues.",
            "follow_up": "Can you walk me through your logic?"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Code grading failed: {str(e)}")


@app.post("/analyze-code-and-ask")
async def analyze_code_and_ask(request: CodeAnalysisRequest):
    """Hybrid: Local LM Studio analysis followed by a Groq Socratic question."""
    async with httpx.AsyncClient() as client:
        try:
            # Step 1: Deep Analysis (Local Inference)
            lm_res = await client.post(
                f"{request.lm_studio_url}/v1/chat/completions",
                json={
                    "messages": [{"role": "system", "content": "Analyze this code briefly for bugs and complexity."}, {"role": "user", "content": request.code}],
                    "temperature": 0.2
                },
                timeout=180.0
            )
            raw_critique = lm_res.json()['choices'][0]['message']['content']

            # Step 2: Groq generates the interviewer's question
            follow_up = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Based on this critique, ask the candidate one clever follow-up question about their logic."},
                    {"role": "user", "content": raw_critique}
                ]
            )

            return {
                "interviewer_question": follow_up.choices[0].message.content,
                "technical_critique_hidden": raw_critique
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LM Studio Error: {str(e)}")


@app.post("/generate-final-report")
async def generate_final_report(request: ReportRequest):

    transcript_text = "\n".join([f"{m.role}: {m.content}" for m in request.transcript[-15:]])
    critiques_text = "\n".join(request.technical_critiques)

    results_summary = ""
    if request.question_results:
        passed = sum(1 for r in request.question_results if r.get("verdict") == "PASS")
        partial = sum(1 for r in request.question_results if r.get("verdict") == "PARTIAL")
        failed = sum(1 for r in request.question_results if r.get("verdict") == "FAIL")
        total = len(request.question_results)
        avg_score = sum(r.get("score", 0) for r in request.question_results) / max(total, 1)

        results_summary = f"""
CODING CHALLENGE RESULTS:
Total Questions: {total}
PASS: {passed}
PARTIAL: {partial}
FAIL: {failed}
Average Score: {avg_score:.0f}/100
"""

    report_prompt = f"""
You are an AI interviewer evaluating a student's interview.

TRANSCRIPT:
{transcript_text}

CODE ANALYSIS:
{critiques_text}

{results_summary}

Generate a concise evaluation report with:

1. Overall Score /100
2. Strengths
3. Weaknesses
4. 3-Step Improvement Plan
"""

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://192.168.56.1:1234/v1/chat/completions",
                json={
                    "model": "meta-llama-3.1-8b-instruct",
                    "messages": [
                        {"role": "system", "content": "You are a professional technical interviewer."},
                        {"role": "user", "content": report_prompt}
                    ],
                    "temperature": 0.4,
                    "max_tokens": 800
                },
                timeout=120
            )

        if response.status_code != 200:
            raise Exception(f"LM Studio returned {response.status_code}: {response.text}")

        result = response.json()

        if "choices" not in result or len(result["choices"]) == 0:
            raise Exception(f"Invalid LM Studio response: {result}")

        report_text = result["choices"][0]["message"]["content"]

        return {"report": report_text}

    except Exception as e:
        print("Report generation error:", e)
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)