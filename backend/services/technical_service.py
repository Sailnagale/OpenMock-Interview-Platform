import re
import json
from fastapi import HTTPException
import httpx
from core.config import groq_client

# ============================================================
# Generate Questions
# ============================================================
async def generate_questions_service(request):
    prompt = f"""You are a senior technical interviewer. Generate exactly {request.count} coding interview questions for a "{request.job_role}" position.

Rules:
- Mix difficulty: 40% easy, 40% medium, 20% hard
- Questions must be solvable with code
- Be concise
- Number them 1 through {request.count}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return only numbered list"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )

        raw = completion.choices[0].message.content.strip()

        lines = raw.split('\n')
        questions = []
        current = ""

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if re.match(r'^\d+[\.\)]\s', line):
                if current:
                    questions.append(current)
                current = re.sub(r'^\d+[\.\)]\s*', '', line)
            else:
                current += " " + line

        if current:
            questions.append(current)

        if len(questions) < 1:
            raise HTTPException(status_code=500, detail="Too few questions")

        return {"questions": questions[:request.count]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Submit Code
# ============================================================
async def submit_code_service(request):
    prompt = f"""Evaluate code:

QUESTION: {request.question}
LANGUAGE: {request.language}
CODE:
{request.code}

Return JSON:
{{
  "verdict": "...",
  "score": 0-100,
  "feedback": "...",
  "follow_up": "..."
}}
"""

    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Return ONLY JSON"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=500
        )

        raw = completion.choices[0].message.content.strip()

        if "```" in raw:
            match = re.search(r'\{[\s\S]*\}', raw)
            if match:
                raw = match.group()

        result = json.loads(raw)

        verdict = result.get("verdict", "FAIL").upper()

        return {
            "verdict": verdict,
            "score": int(result.get("score", 0)),
            "feedback": result.get("feedback", ""),
            "follow_up": result.get("follow_up", "")
        }

    except json.JSONDecodeError:
        return {
            "verdict": "PARTIAL",
            "score": 40,
            "feedback": "AI parsing failed",
            "follow_up": "Explain your logic"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Analyze Code
# ============================================================
async def analyze_code_service(request):
    async with httpx.AsyncClient() as client:
        try:
            lm_res = await client.post(
                f"{request.lm_studio_url}/v1/chat/completions",
                json={
                    "messages": [
                        {"role": "system", "content": "Analyze code"},
                        {"role": "user", "content": request.code}
                    ],
                    "temperature": 0.2
                },
                timeout=180
            )

            critique = lm_res.json()['choices'][0]['message']['content']

            follow_up = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "Ask follow-up"},
                    {"role": "user", "content": critique}
                ]
            )

            return {
                "interviewer_question": follow_up.choices[0].message.content,
                "technical_critique_hidden": critique
            }

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))