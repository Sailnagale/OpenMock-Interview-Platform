import json
import logging
import os
from fastapi.responses import StreamingResponse
from core.config import groq_client
from routes.auth import get_collection_name, get_user_dir

# Set up logging for visibility in your terminal
logger = logging.getLogger("uvicorn.error")

# ✅ Initialize modules with absolute safety
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

def evaluate_followup_answer(question: str, code: str, followup: str, answer: str) -> dict:
    """Uses Groq to grade the candidate's response to a coding follow-up question (score 0-10)."""
    system_prompt = "You are a senior technical interviewer. Return ONLY a valid JSON object. No other text."
    user_prompt = f"""
    Evaluate the candidate's verbal response to this conceptual follow-up coding question.

    CODING PROBLEM: {question}
    CANDIDATE CODE:
    {code}

    FOLLOW-UP QUESTION: {followup}
    CANDIDATE ANSWER: {answer}

    Grade their answer on a scale of 0 to 10 (where 10 is flawless and 0 is completely wrong or empty).
    Return ONLY a JSON response in this format:
    {{
      "score": 0 to 10,
      "critique": "A brief explanation of why this grade was awarded (1-2 sentences)."
    }}
    """
    try:
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.2,
            max_tokens=200
        )
        raw = completion.choices[0].message.content.strip()
        import re
        if "```" in raw:
            match = re.search(r'\{[\s\S]*\}', raw)
            if match:
                raw = match.group()
        return json.loads(raw)
    except Exception as e:
        logger.warning(f"Failed to evaluate follow-up answer: {e}")
        return {"score": 5, "critique": "Fallback evaluation applied."}

def start_followup(state):
    """
    Orchestrates the interview flow by combining RAG (Resume Context), 
    NLP (Answer Analysis), and LLM (Conversation Generation).
    Supports progressive coding rounds and user memory tracking.
    """
    # 1. Determine labels and roles
    round_label = "Technical Coding" if state.interview_type == "technical" else "HR Behavioral"
    display_role = state.job_role if state.job_role else "Software Engineer"

    # 2. Retrieve user-specific resume context
    coll_name = get_collection_name(state.user_email) if state.user_email else "interview_data"
    rag_context = ""
    if rag_retriever:
        try:
            rag_context = rag_retriever.get_relevant_context(query=display_role, n_results=3, collection_name=coll_name)
        except Exception as e:
            logger.warning(f"⚠️ RAG Retrieval skipped: {e}")
    
    if not rag_context:
        rag_context = "Focus on standard industry requirements and best practices for this role."

    # 3. Pull long-term user history for personalized questions & improvement tracking
    long_term_memory = ""
    if state.user_email:
        user_dir = get_user_dir(state.user_email)
        sessions_path = os.path.join(user_dir, "sessions.json")
        if os.path.exists(sessions_path):
            try:
                with open(sessions_path, "r") as f:
                    sessions = json.load(f)
                    summaries = []
                    for s in sessions[-3:]:  # Last 3 sessions
                        score_info = f"Score: {s.get('results')[0].get('score')}/100" if s.get('results') else "N/A"
                        summaries.append(
                            f"- Session Type: {s.get('session_type')} | {score_info}\n"
                            f"  Report Summary: {s.get('report', '')[:180]}..."
                        )
                    if summaries:
                        long_term_memory = "\n".join(summaries)
            except Exception as e:
                logger.warning(f"Failed to load user session memory: {e}")

    # 4. 🔥 NLP Analysis (Real-time feedback on user's soft/hard skills)
    last_analysis_summary = ""
    if nlp_analyzer and state.user_input and len(state.history) > 0 and state.interview_type != "technical":
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

    # ============================================================
    # TECHNICAL ROUND CONCEPTUAL INTRO FLOW
    # ============================================================
    if state.interview_type == "technical" and state.technical_phase == "intro":
        intro_stage = getattr(state, "technical_intro_stage", 0)

        if intro_stage == 0:
            prompt_stage_instruction = (
                "Greet the candidate warmly, explain that the interview begins with a brief conceptual discussion "
                "consisting of 3 short questions before we move on to live coding. Ask your first short, general "
                "conceptual question related to their role/tech stack. Do NOT mention coding rounds or the editor yet."
            )
        elif intro_stage == 1:
            prompt_stage_instruction = (
                "Briefly evaluate their previous response in 1 sentence. Then ask a second short general conceptual question "
                "related to their role/tech stack. Do NOT mention coding rounds or the editor yet."
            )
        elif intro_stage == 2:
            prompt_stage_instruction = (
                "Briefly evaluate their previous response in 1 sentence. Then ask a third short general conceptual question "
                "related to their role/tech stack. Do NOT mention coding rounds or the editor yet."
            )
        else:
            prompt_stage_instruction = (
                "Briefly evaluate their previous response in 1 sentence. "
                "Then, state that we will now transition to the practical coding round, and that their first coding problem "
                "is loading in the editor panel on the right. Keep it brief and positive."
            )

        system_prompt = (
            f"You are a professional technical interviewer conducting the introductory conceptual phase for a {display_role} position. "
            f"CANDIDATE RESUME CONTEXT: {rag_context} "
            f"LONG-TERM USER PERFORMANCE HISTORY: {long_term_memory if long_term_memory else 'No past sessions.'} "
            f"\n\nSTAGE DETAILS: Current conceptual question stage is {intro_stage}/3. "
            "\n\nINSTRUCTIONS:"
            "- Be professional, polite, and extremely concise (1-2 sentences per response)."
            f"- {prompt_stage_instruction}"
            "- Stay strictly in character. Do not say 'As an AI' or 'Great answer'."
        )

        messages = [{"role": "system", "content": system_prompt}]
        for m in state.history:
            if isinstance(m, dict):
                messages.append(m)
            elif hasattr(m, "role") and hasattr(m, "content"):
                messages.append({"role": m.role, "content": m.content})
            elif hasattr(m, "model_dump"):
                messages.append(m.model_dump())

        user_input = state.user_input if state.user_input else "I am ready to start the interview."
        messages.append({"role": "user", "content": user_input})

        def generate_intro_stream():
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

                # Trigger transition if intro_stage >= 3 OR if the generated response text contains strong transition keywords
                lower_response = full_response_text.lower()
                transition_triggers = [
                    "transition to the coding",
                    "transition to the practical coding",
                    "move on to the coding",
                    "move to the coding",
                    "coding part of the interview",
                    "coding round",
                    "editor on the right",
                    "coding question in the editor",
                    "first coding question",
                    "coding challenge"
                ]
                if intro_stage >= 3 or any(trigger in lower_response for trigger in transition_triggers):
                    metadata = {"transition_to_coding": True}
                    yield f"\n[METADATA: {json.dumps(metadata)}]"
            except Exception as e:
                logger.error(f"💥 Intro Stream Error: {e}")
                yield f"Interviewer Error: I am having trouble connecting. Details: {str(e)}"

        return StreamingResponse(generate_intro_stream(), media_type="text/event-stream")

    # ============================================================
    # TECHNICAL CODING FOLLOW-UP EVALUATION PIPELINE
    # ============================================================
    if state.interview_type == "technical" and state.technical_phase in ["followup1", "followup2"]:
        followup_index = 0 if state.technical_phase == "followup1" else 1
        current_followup_question = "Explain your solution's complexity."
        if state.follow_ups and len(state.follow_ups) > followup_index:
            current_followup_question = state.follow_ups[followup_index]

        # Grade the user's answer to this follow-up
        eval_res = evaluate_followup_answer(
            question=state.current_question_text,
            code=state.submitted_code,
            followup=current_followup_question,
            answer=state.user_input
        )
        score_val = eval_res.get("score", 5)
        critique_text = eval_res.get("critique", "Response graded.")

        # Determine next steps
        next_phase = "followup2" if (state.technical_phase == "followup1" and len(state.follow_ups) > 1) else "done"
        
        def generate_technical_stream():
            yield f"**Evaluation:** {critique_text}\n\n"
            if next_phase == "followup2":
                next_q = state.follow_ups[1]
                yield f"**Follow-up Question 2:** {next_q}"
            else:
                yield "Perfect! I have completed the follow-up evaluation for this question. You can now proceed to the next problem by clicking the **'Next Question'** button above the editor."
            
            # Send metadata invisibly at the end of the text stream
            metadata = {
                "score_adjustment": score_val,
                "next_phase": next_phase
            }
            yield f"\n[METADATA: {json.dumps(metadata)}]"

        return StreamingResponse(generate_technical_stream(), media_type="text/event-stream")

    # ============================================================
    # SYSTEM PROMPT INJECTION (HR / INTRO ROUND)
    # ============================================================
    if state.interview_type == "technical":
        system_prompt = (
            f"You are a professional technical interviewer for a {display_role} position. "
            f"CANDIDATE RESUME CONTEXT: {rag_context} "
            f"LONG-TERM USER PERFORMANCE HISTORY: {long_term_memory if long_term_memory else 'No past sessions.'} "
            "\n\nINSTRUCTIONS:"
            "- Be professional, concise, and focused on coding interview standards (1-2 sentences)."
            "- Explain to the user that they will write and submit code inside the editor on the right."
            "- Do not ask coding questions in the chat directly. Guide them to check the editor panel."
            "- If they just started, greet them and tell them to begin on the first coding question in the editor."
        )
    else:
        # HR Behavioral Interview
        system_prompt = (
            f"You are a professional HR Behavioral interviewer conducting a non-technical round for a {display_role} position. "
            f"CANDIDATE RESUME CONTEXT: {rag_context} "
            f"LONG-TERM USER PERFORMANCE HISTORY: {long_term_memory if long_term_memory else 'No past sessions.'} "
            "\n\nINSTRUCTIONS:"
            "- Analyze the candidate's resume context and target specific skills, projects, or job experiences listed."
            "- Avoid generic boilerplate behavioral questions like 'Tell me about yourself' (unless it's the very start of the interview)."
            "- Reference their long-term history/weaknesses (e.g. if they struggled with STAR layout previously, check if they use it now)."
            "- Be professional, slightly tough, and very concise (1-2 sentences per response)."
            "- Ask only ONE behavioral question at a time."
            "- Stay strictly in character. Do not say 'As an AI' or 'Great answer'."
            f"\n\nINTERNAL ANALYSIS OF PREVIOUS ANSWER: {last_analysis_summary}"
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
                yield "Could you please elaborate or share more details on that?"

        except Exception as e:
            logger.error(f"💥 Groq Stream Error: {e}")
            yield f"Interviewer Error: I am having trouble connecting. Details: {str(e)}"

    return StreamingResponse(generate(), media_type="text/event-stream")