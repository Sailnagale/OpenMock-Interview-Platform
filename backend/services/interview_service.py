import json
import logging
from fastapi.responses import StreamingResponse
from core.config import groq_client

# Set up logging for visibility in your terminal
logger = logging.getLogger("uvicorn.error")

# ✅ Initialize modules with absolute safety
# This prevents the server from crashing if ChromaDB or NLP modules have issues
try:
    from modules.nlp.nlp_engine import NLPEngine
    from modules.rag.retriever import Retriever
    nlp_analyzer = NLPEngine()
    rag_retriever = Retriever()
    logger.info("✅ NLP and RAG modules initialized successfully.")
except Exception as e:
    logger.error(f"❌ Module Initialization Failed: {e}")
    nlp_analyzer = None
    rag_retriever = None

def start_followup(state):
    """
    Orchestrates the interview flow by combining RAG (Resume Context), 
    NLP (Answer Analysis), and LLM (Conversation Generation).
    """
    
    # 1. Determine labels and roles
    round_label = "Technical Coding" if state.interview_type == "technical" else "HR Behavioral"
    display_role = state.job_role if state.job_role else "Software Engineer"

    # 2. 🔥 RAG Retrieval (Uses the new get_relevant_context method)
    rag_context = ""
    if rag_retriever:
        try:
            # We query the vector store using the job role to find resume-specific projects
            # Now specifically calling the new method name 'get_relevant_context'
            rag_context = rag_retriever.get_relevant_context(query=display_role, n_results=3)
        except Exception as e:
            logger.warning(f"⚠️ RAG Retrieval skipped: {e}")
    
    # Fallback if RAG is empty or failed
    if not rag_context:
        rag_context = "Focus on standard industry requirements and best practices for this role."

    # 3. 🔥 NLP Analysis (Real-time feedback on user's soft/hard skills)
    last_analysis_summary = ""
    if nlp_analyzer and state.user_input and len(state.history) > 0:
        try:
            analysis = nlp_analyzer.analyze_behavioral_response(state.user_input, display_role)
            if analysis:
                last_analysis_summary = (
                    f"Last Answer Score: {analysis.get('score', 0)}/100. "
                    f"Tone: {analysis.get('tone', 'Neutral')}. "
                    f"Critique: {analysis.get('critique', 'N/A')}."
                )
        except Exception as e:
            logger.warning(f"⚠️ NLP Analysis skipped: {e}")

    # 4. Construct System Prompt
    # This prompt tells the LLM how to act and what context to use
    system_prompt = (
        f"You are a professional {round_label} interviewer for a {display_role} position. "
        f"CANDIDATE RESUME CONTEXT: {rag_context} "
        "\n\nINSTRUCTIONS:"
        "- Be professional, slightly tough, and very concise (1-2 sentences)."
        "- If the interview just started, greet the user and ask a specific question based on their resume context."
        "- Ask only ONE follow-up question at a time."
        "- Stay strictly in character. Do not say 'As an AI' or 'Great answer'."
        f"\n\nINTERNAL OBSERVATION: {last_analysis_summary}"
    )

    # 5. Prepare Message Chain for LLM
    messages = [{"role": "system", "content": system_prompt}]
    
    # Safely convert history objects into dictionaries
    for m in state.history:
        if isinstance(m, dict):
            messages.append(m)
        elif hasattr(m, "role") and hasattr(m, "content"):
            messages.append({"role": m.role, "content": m.content})
        elif hasattr(m, "model_dump"):
            messages.append(m.model_dump())

    # Handle current input logic
    user_input = state.user_input if state.user_input else "I am ready to start the interview."
    messages.append({"role": "user", "content": user_input})

    # 6. Generator for Streaming Response
    def generate():
        full_response_text = ""
        try:
            completion = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=messages,
                stream=True,
                max_tokens=250,
                temperature=0.7
            )

            for chunk in completion:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    if hasattr(delta, "content") and delta.content:
                        text = delta.content
                        full_response_text += text
                        yield text
            
            # Final check to ensure we didn't send an empty string
            if not full_response_text:
                yield "I'm sorry, could you please repeat that?"

        except Exception as e:
            logger.error(f"💥 Groq Stream Error: {e}")
            yield f"Interviewer Error: I am having trouble connecting. Details: {str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")