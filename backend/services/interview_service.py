from fastapi.responses import StreamingResponse
from core.config import groq_client
from utils.helpers import get_question_by_id

def start_followup(state):
    if not state.history and state.current_question_id:
        question_text = get_question_by_id(state.interview_type, state.current_question_id)
        return {"role": "assistant", "content": question_text}

    prompt = f"You are a professional {state.interview_type.upper()} interviewer..."

    def generate():
        messages = [{"role": "system", "content": prompt}] + \
                   [m.model_dump() for m in state.history] + \
                   [{"role": "user", "content": state.user_input}]

        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=messages,
            stream=True
        )

        for chunk in completion:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    return StreamingResponse(generate(), media_type="text/event-stream")