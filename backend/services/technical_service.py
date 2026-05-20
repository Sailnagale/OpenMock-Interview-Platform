import re
import json
import logging
from fastapi import HTTPException
import httpx
from core.config import groq_client

logger = logging.getLogger("uvicorn.error")

def parse_json_safely(raw_text: str):
    """Safely extracts and parses JSON content from LLM response text."""
    if not raw_text:
        return None
    try:
        # Extract markdown json block if present
        if "```" in raw_text:
            match = re.search(r'\{[\s\S]*\}', raw_text)
            if match:
                raw_text = match.group()
        return json.loads(raw_text.strip())
    except Exception as e:
        logger.warning(f"Failed to parse JSON response: {e}. Raw: {raw_text[:200]}")
        return None

async def check_local_llm_healthy(lm_studio_url: str) -> bool:
    """Checks if LM Studio local inference server is healthy and reachable."""
    if not lm_studio_url:
        return False
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(f"{lm_studio_url}/v1/models", timeout=2.0)
            if res.status_code == 200:
                logger.info(f"✅ Local LLM server detected and healthy at {lm_studio_url}")
                return True
        except Exception as e:
            logger.info(f"ℹ️ Local LLM server check failed at {lm_studio_url}: {e}")
    return False

async def query_local_llm(lm_studio_url: str, system_prompt: str, user_prompt: str):
    """Queries Phi-3 via Local LM Studio with a tight timeout for graceful fallback."""
    async with httpx.AsyncClient() as client:
        try:
            res = await client.post(
                f"{lm_studio_url}/v1/chat/completions",
                json={
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 800
                },
                timeout=12.0  # Safe timeout for local server responses
            )
            if res.status_code == 200:
                data = res.json()
                return data['choices'][0]['message']['content'].strip()
        except Exception as e:
            logger.warning(f"LM Studio local inference offline or timeout: {e}")
        return None

def query_groq(system_prompt: str, user_prompt: str):
    """Queries Groq Cloud model (Llama-3.3-70b-versatile)."""
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.3,
            max_tokens=800
        )
        return completion.choices[0].message.content.strip()
    except Exception as e:
        logger.error(f"Groq Cloud call failed: {e}")
        return None

# ============================================================
# Generate Questions
# ============================================================
async def generate_questions_service(request):
    """
    Generates coding questions tailored to the requested difficulty level.
    """
    job_role_lower = getattr(request, "job_role", "").lower()
    if "data sci" in job_role_lower:
        ds_questions = [
            """Find Missing Values Percentage
Given a dataset column as a list, write a function to calculate the percentage of missing values (None or NaN) in the list.

Example:
Input: [1, 2, None, 4, float('nan')]
Output: 40.0""",
            """Find the Average of Each Column
Given a 2D list representing rows of numerical data, calculate the average of each column.

Example:
Input:
[
 [1, 2, 3],
 [4, 5, 6],
 [7, 8, 9]
]
Output:
[4.0, 5.0, 6.0]""",
            """Find the Most Frequent Element
Given a list of labels/classes, write a function to find the most frequent element.

Example:
Input: ['cat', 'dog', 'cat', 'bird', 'dog', 'cat']
Output: 'cat'"""
        ]
        return {"questions": ds_questions[:request.count]}

    difficulty = getattr(request, "difficulty", "easy")
    prompt = f"""You are a senior technical interviewer. Generate exactly {request.count} real coding interview questions of '{difficulty}' difficulty level for a "{request.job_role}" position.

    Rules:
    - Each question must be a short, direct, LeetCode-style coding problem statement.
    - Keep it very concise: a brief description (1-2 sentences), input/output rules, constraints, and one simple example.
    - Do NOT include long paragraphs or unnecessary explanations.
    - Do NOT ask general theoretical or behavioral interview questions.
    - Number them 1 through {request.count}.
    """

    try:
        lm_url = getattr(request, "lm_studio_url", "http://localhost:1234")
        raw = None
        if await check_local_llm_healthy(lm_url):
            logger.info("🤖 Model Selection Decision: Prioritizing Local LLM (Phi-3) for question generation.")
            raw = await query_local_llm(lm_url, "Return only a numbered list of questions, no other explanations.", prompt)
        
        if not raw:
            logger.info("🤖 Model Selection Decision: Using Groq Cloud (Llama-3.3) for question generation.")
            raw = query_groq("Return only a numbered list of questions, no other explanations.", prompt)

        questions = []
        if raw:
            lines = raw.split('\n')
            current = ""
            started = False

            for line in lines:
                line = line.strip()
                if not line:
                    continue

                if re.match(r'^\d+[\.\)]\s', line):
                    if started and current:
                        questions.append(current.strip())
                    current = re.sub(r'^\d+[\.\)]\s*', '', line)
                    started = True
                else:
                    if started:
                        current += "\n" + line

            if started and current:
                questions.append(current.strip())

        if len(questions) < 1:
            # Fallback mock question
            questions = [f"Design a function to find the maximum subarray sum in an array of integers (Easy level coding task for {request.job_role})."]

        return {"questions": questions[:request.count]}

    except Exception as e:
        logger.error(f"Error in generate_questions_service: {e}")
        # Return fallback questions on exception rather than raising 500, to keep the UI running
        fallback = [f"Given an array of integers, return indices of the two numbers such that they add up to a specific target."]
        return {"questions": fallback[:request.count]}

# ============================================================
# Submit Code & Dual AI Evaluation
# ============================================================
async def submit_code_service(request):
    """
    Evaluates candidate code by sending requests in parallel to:
    1. Groq (Llama-3.3)
    2. Local LM Studio (Phi-3)
    Performs dual-LLM grading, correctness logic, complexity, and consensus checks.
    Also generates 1-2 follow-up conceptual questions.
    """
    system_prompt = "You are a world-class code grader and technical interviewer. Return ONLY a valid JSON object. No other text."
    user_prompt = f"""
    Evaluate the following candidate code submission:

    QUESTION: {request.question}
    LANGUAGE: {request.language}
    CODE:
    {request.code}

    Evaluate the solution thoroughly based on:
    1. Correctness: Does the code solve the problem correctly?
    2. Code Quality: Cleanliness, modularity, readability, naming conventions.
    3. Logic: Is the logical flow robust and bug-free?
    4. Edge Cases: Does the code handle null/empty, boundary values, or negative inputs?
    5. Time Complexity: What is the asymptotic time complexity?
    6. Space Complexity: What is the asymptotic space complexity?
    7. Optimization Quality: Is this optimal, or can it be improved?

    You must output a single JSON block matching this EXACT schema:
    {{
      "verdict": "PASS" | "PARTIAL" | "FAIL",
      "score": 0 to 100,
      "feedback": "A concise summary of strengths, weaknesses, complexities, and edge cases.",
      "follow_ups": [
        "A short conceptual question testing their understanding of their solution's time/space complexity or logical trade-offs.",
        "Another short conceptual question testing how they would handle critical edge cases or scaling."
      ]
    }}
    """

    lm_url = request.lm_studio_url or "http://localhost:1234"
    use_local = await check_local_llm_healthy(lm_url)
    evaluation_res = None

    if use_local:
        logger.info(f"🤖 Model Selection Decision: Prioritizing Local LLM (Phi-3) at {lm_url} for code evaluation.")
        local_raw = await query_local_llm(lm_url, system_prompt, user_prompt)
        evaluation_res = parse_json_safely(local_raw)
        if evaluation_res:
            logger.info("✅ Code evaluation completed successfully using Local LLM (Phi-3).")
        else:
            logger.warning("⚠️ Local LLM returned invalid or empty JSON. Falling back to Groq Cloud.")

    if not evaluation_res:
        logger.info("🤖 Model Selection Decision: Using/Falling back to Groq Cloud (Llama-3.3) for code evaluation.")
        groq_raw = query_groq(system_prompt, user_prompt)
        evaluation_res = parse_json_safely(groq_raw)
        
        if not evaluation_res:
            logger.warning("⚠️ Groq JSON parsing failed. Using static default evaluation fallback.")
            evaluation_res = {
                "verdict": "PARTIAL",
                "score": 50,
                "feedback": "Evaluation parsing error. Code submitted successfully.",
                "follow_ups": ["Can you explain the time and space complexity of your code?"]
            }

    combined_score = evaluation_res.get("score", 50)
    combined_verdict = evaluation_res.get("verdict", "FAIL")
    model_name = "Local LLM (Phi-3)" if (use_local and evaluation_res.get("feedback") and "parsing error" not in evaluation_res.get("feedback")) else "Groq Cloud (Llama-3.3)"
    combined_feedback = f"**{model_name} Evaluation:**\n{evaluation_res.get('feedback')}"
    combined_follow_ups = evaluation_res.get("follow_ups", ["Can you explain the complexity of your approach?"])

    return {
        "verdict": combined_verdict,
        "score": combined_score,
        "feedback": combined_feedback,
        "follow_up": combined_follow_ups[0] if combined_follow_ups else "Explain your code logic.",
        "all_follow_ups": combined_follow_ups
    }

# ============================================================
# Progressive Next Question Generation
# ============================================================
async def next_question_service(request):
    """
    Decides the next coding problem difficulty progressively based on candidate performance,
    and returns a single freshly generated coding question.
    """
    idx = request.current_question_idx  # 1 for second question, 2 for third question
    prev_score = request.previous_score
    prev_difficulty = request.previous_difficulty.lower()

    job_role_lower = getattr(request, "job_role", "").lower()
    if "data sci" in job_role_lower:
        ds_questions = [
            """Find Missing Values Percentage
Given a dataset column as a list, write a function to calculate the percentage of missing values (None or NaN) in the list.

Example:
Input: [1, 2, None, 4, float('nan')]
Output: 40.0""",
            """Find the Average of Each Column
Given a 2D list representing rows of numerical data, calculate the average of each column.

Example:
Input:
[
 [1, 2, 3],
 [4, 5, 6],
 [7, 8, 9]
]
Output:
[4.0, 5.0, 6.0]""",
            """Find the Most Frequent Element
Given a list of labels/classes, write a function to find the most frequent element.

Example:
Input: ['cat', 'dog', 'cat', 'bird', 'dog', 'cat']
Output: 'cat'"""
        ]
        safe_idx = min(max(idx, 0), len(ds_questions) - 1)
        if idx == 1:
            target_difficulty = "medium" if prev_score >= 70 else "easy"
        elif idx == 2:
            target_difficulty = "hard" if prev_score >= 70 and prev_difficulty == "medium" else "medium"
        else:
            target_difficulty = "medium"
            
        return {
            "difficulty": target_difficulty,
            "question": ds_questions[safe_idx]
        }

    # Determine progressive difficulty
    if idx == 1:
        # Question 2 difficulty
        if prev_score >= 70:
            target_difficulty = "medium"
        else:
            target_difficulty = "easy"
    elif idx == 2:
        # Question 3 difficulty
        if prev_score >= 70:
            if prev_difficulty == "medium":
                target_difficulty = "hard"
            else:
                target_difficulty = "medium"
        else:
            if prev_difficulty == "medium":
                target_difficulty = "medium"
            else:
                target_difficulty = "easy"
    else:
        target_difficulty = "medium"

    system_prompt = "You are a senior technical interviewer. Return ONLY a valid JSON object. No other text."
    user_prompt = f"""
    Generate exactly ONE coding interview question of '{target_difficulty}' difficulty level for a '{request.job_role}' position.

    Rules:
    - The question must be a short, direct, LeetCode-style coding problem statement.
    - Keep it very concise: a brief description (1-2 sentences), input/output rules, constraints, and one simple example.
    - Do NOT include long paragraphs or unnecessary explanations.
    - Do NOT ask general theoretical or behavioral interview questions.
    - Output a single JSON block matching this EXACT schema:
      {{
        "difficulty": "{target_difficulty}",
        "question": "Concise LeetCode-style coding challenge description, constraints, and example."
      }}
    """

    lm_url = getattr(request, "lm_studio_url", "http://localhost:1234")
    raw_response = None
    if await check_local_llm_healthy(lm_url):
        logger.info(f"🤖 Model Selection Decision: Prioritizing Local LLM (Phi-3) at {lm_url} for next progressive question generation.")
        raw_response = await query_local_llm(lm_url, system_prompt, user_prompt)

    if not raw_response:
        logger.info("🤖 Model Selection Decision: Using/Falling back to Groq Cloud (Llama-3.3) for next progressive question generation.")
        raw_response = query_groq(system_prompt, user_prompt)

    result = parse_json_safely(raw_response)

    if not result:
        # Fallback static questions if generation fails
        fallback_questions = {
            "easy": "Given an array of integers, return indices of the two numbers such that they add up to a specific target.",
            "medium": "Given a string containing just the characters '(', ')', '{{', '}}', '[' and ']', determine if the input string is valid.",
            "hard": "Given an unsorted integer array, find the smallest missing positive integer."
        }
        result = {
            "difficulty": target_difficulty,
            "question": fallback_questions.get(target_difficulty, fallback_questions["medium"])
        }

    return result

# ============================================================
# Analyze Code (Legacy fallback)
# ============================================================
async def analyze_code_service(request):
    """Legacy code analysis for compatibility."""
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
                timeout=20.0
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
            logger.warning(f"Analyze code service error: {e}")
            # Fallback
            return {
                "interviewer_question": "Explain the time complexity of your submission.",
                "technical_critique_hidden": "Failed to analyze code with local model."
            }