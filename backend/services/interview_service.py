import json
from fastapi.responses import StreamingResponse
from core.config import groq_client
from utils.helpers import get_question_by_id

# ✅ Import your new modules
from modules.nlp.nlp_engine import NLPEngine
from modules.rag.retriever import Retriever

# Initialize modules
nlp_analyzer = NLPEngine()
rag_retriever = Retriever()

def start_followup(state):
    # 1. Determine the Round Label and Role
    round_label = "Technical Coding" if state.interview_type == "technical" else "HR Behavioral"
    display_role = state.job_role if state.job_role else "Software Engineer"

    # 2. Handle Initial Greeting (No history yet)
    if not state.history:
        if state.current_question_id:
            question_text = get_question_by_id(state.interview_type, state.current_question_id)
            return {
                "role": "assistant", 
                "content": f"Welcome! Let's start the {round_label} interview for the {display_role} position. {question_text}"
            }

    # 3. 🔥 NEW: RAG Context Retrieval
    # Pulls relevant info from your Resume or Company DB based on the job role
    rag_context = rag_retriever.get_context_for_interview(display_role)

    # 4. 🔥 NEW: NLP Answer Analysis
    # If the user just answered, analyze it for STAR method and Tone
    last_analysis_summary = ""
    if state.user_input and len(state.history) > 0:
        try:
            analysis = nlp_analyzer.analyze_behavioral_response(state.user_input, display_role)
            # We create a hidden instruction for the AI to keep track of performance
            last_analysis_summary = f"User's last answer score: {analysis.get('score')}/100. Critique: {analysis.get('critique')}. Tone: {analysis.get('tone')}."
        except Exception as e:
            print(f"NLP Analysis Error: {e}")

    # 5. Optimized Prompt with strict Round Context + RAG + NLP
    prompt = (
        f"You are a professional {round_label} interviewer for the {display_role} position. "
        f"Rules: This is a {state.interview_type.upper()} round. "
        f"Context from candidate's background/company: {rag_context if rag_context else 'Standard industry requirements.'} "
        "Rules: Be extremely concise (1-2 sentences). Ask only one follow-up question. "
        "Do not provide long feedback or code until the very end of the interview. "
        "Maintain a professional and steady pace."
        f"Internal Observation: {last_analysis_summary}"
    )

    # 6. Guardrail: First Message Logic
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