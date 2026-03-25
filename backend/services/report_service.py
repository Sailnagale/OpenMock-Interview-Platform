from fastapi import HTTPException
import httpx

async def generate_report(request):

    # -------------------------------
    # 1. Prepare transcript
    # -------------------------------
    transcript_text = "\n".join(
        [f"{m.role}: {m.content}" for m in request.transcript[-15:]]
    )

    critiques_text = "\n".join(request.technical_critiques)

    # -------------------------------
    # 2. Coding results summary
    # -------------------------------
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

    # -------------------------------
    # 3. Optimized prompt (IMPORTANT)
    # -------------------------------
    report_prompt = f"""
You are a professional technical interviewer.

Analyze the candidate interview and generate a structured evaluation.

TRANSCRIPT:
{transcript_text}

CODE ANALYSIS:
{critiques_text}

{results_summary}

STRICT FORMAT:

Overall Score: <number>/100

Strengths:
- point 1
- point 2

Weaknesses:
- point 1
- point 2

Improvement Plan:
1. step 1
2. step 2
3. step 3

Keep answers concise and structured.
"""

    # -------------------------------
    # 4. Call LM Studio (Phi-3)
    # -------------------------------
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                "http://localhost:1234/v1/chat/completions",
                json={
                    # Model name may be ignored by LM Studio,
                    # but keeping it clean is good practice
                    "model": "phi-3.1-mini-4k-instruct",
                    "messages": [
                        {"role": "system", "content": "You are a professional technical interviewer."},
                        {"role": "user", "content": report_prompt}
                    ],
                    "temperature": 0.2,   # lower = more consistent output
                    "max_tokens": 800
                },
                timeout=120
            )

        # -------------------------------
        # 5. Response validation
        # -------------------------------
        if response.status_code != 200:
            raise Exception(f"LM Studio returned {response.status_code}: {response.text}")

        result = response.json()

        if "choices" not in result or len(result["choices"]) == 0:
            raise Exception(f"Invalid LM Studio response: {result}")

        report_text = result["choices"][0]["message"]["content"]

        return {"report": report_text}

    # -------------------------------
    # 6. Error handling
    # -------------------------------
    except Exception as e:
        print("Report generation error:", e)
        raise HTTPException(status_code=500, detail=str(e))