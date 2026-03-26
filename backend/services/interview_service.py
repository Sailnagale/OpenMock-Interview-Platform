from fastapi.responses import StreamingResponse
from core.config import groq_client
from utils.helpers import get_question_by_id

def start_followup(state):
    # 1. Determine the Round Label for the AI
    round_label = "Technical Coding" if state.interview_type == "technical" else "HR Behavioral"
    display_role = state.job_role if state.job_role else "Software Engineer"

    # 2. Handle Initial Greeting (No history yet)
    if not state.history:
        # If we have a specific starting question ID from a bank
        if state.current_question_id:
            question_text = get_question_by_id(state.interview_type, state.current_question_id)
            return {
                "role": "assistant", 
                "content": f"Welcome! Let's start the {round_label} interview for the {display_role} position. {question_text}"
            }

    # 3. Optimized Prompt with strict Round Context
    prompt = (
        f"You are a professional {round_label} interviewer for the {display_role} position. "
        f"Rules: This is a {state.interview_type.upper()} round. "
        "Be extremely concise (1-2 sentences). Ask only one follow-up question. "
        "Do not provide long feedback or code until the very end of the interview. "
        "Maintain a professional and steady pace."
    )

    # 4. Guardrail: First Message Logic
    if not state.history and not state.user_input:
        user_content = (
            f"I am ready to start my {state.interview_type} interview for {display_role}. "
            f"Please introduce yourself as a {round_label} interviewer and ask the first question."
        )
    else:
        user_content = state.user_input if state.user_input else "I am ready for the next question."

    def generate():
        messages = [{"role": "system", "content": prompt}] + \
                   [m.model_dump() for m in state.history] + \
                   [{"role": "user", "content": user_content}]

        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True,
            max_tokens=150,
            temperature=0.7
        )

        for chunk in completion:
            if chunk.choices[0].delta.content:
                content = chunk.choices[0].delta.content
                yield content

    return StreamingResponse(generate(), media_type="text/event-stream")