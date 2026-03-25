from fastapi.responses import StreamingResponse
from core.config import groq_client
from utils.helpers import get_question_by_id

def start_followup(state):
    # 1. Handle Initial Question (No history yet)
    if not state.history and state.current_question_id:
        question_text = get_question_by_id(state.interview_type, state.current_question_id)
        return {"role": "assistant", "content": question_text}

    # 2. Optimized Prompt for Brevity and Speed
    # Strict constraints prevent the agent from being too lengthy.
    prompt = (
        f"You are a professional {state.interview_type.upper()} interviewer. "
        "Rules: Be extremely concise (1-2 sentences). Ask only one follow-up question. "
        "Do not provide long feedback or code until the very end of the interview. "
        "Maintain a professional and steady pace."
    )

    # 3. Guardrail: Ensure user_input isn't empty to prevent AI from talking to itself
    user_content = state.user_input if state.user_input else "I am ready for the next question."

    def generate():
        messages = [{"role": "system", "content": prompt}] + \
                   [m.model_dump() for m in state.history] + \
                   [{"role": "user", "content": user_content}]

        # 4. Groq Streaming with reduced max_tokens for speed
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
            max_tokens=150,  # Limits response length to ensure speed
            temperature=0.7
        )

        for chunk in completion:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield content

    return StreamingResponse(generate(), media_type="text/event-stream")