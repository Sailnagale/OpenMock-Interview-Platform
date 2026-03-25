import json
from fastapi.responses import StreamingResponse
from services.interview_service import start_followup
from utils.voice_utils import speech_to_text, text_to_speech_chunk

# ============================================================
# 🎤 Voice Interview Service (Final Optimized Version)
# ============================================================
def voice_interview(state):
    """
    Handles the end-to-end voice loop:
    1. Transcribes incoming Base64 audio.
    2. Filters out common Whisper hallucinations (like 'you', 'the').
    3. Streams back JSON containing user transcription and AI audio/text.
    """

    # -------------------------------
    # 1. Speech → Text (Transcribe)
    # -------------------------------
    user_text = ""
    if hasattr(state, "audio_input") and state.audio_input:
        raw_transcription = speech_to_text(state.audio_input)
        
        # ✅ HALLUCINATION FILTER
        # Whisper often returns "you", "thanks", or "." when recording silence.
        cleaned = raw_transcription.strip().lower().replace(".", "")
        hallucinations = ["you", "the", "thanks", "thank you", "bye", "a", "i"]
        
        if not cleaned or cleaned in hallucinations:
            # If it's just noise, we treat it as no input to prevent overlapping
            user_text = "" 
            state.user_input = "I'm listening, please continue." 
        else:
            user_text = raw_transcription
            state.user_input = user_text

    # -------------------------------
    # 2. Get AI Response Logic
    # -------------------------------
    # Calls the interview_service (which uses Groq/Llama-3)
    response = start_followup(state)

    # -------------------------------
    # 3. Dual-Stream Generator
    # -------------------------------
    async def generate_dual_stream():
        # ✅ PACKET 1: Send the user's transcribed text to the chatbox immediately
        if user_text:
            yield f"data: {json.dumps({'user_transcription': user_text})}\n\n"

        buffer = ""
        
        # Iterate through the text stream from the LLM
        async for chunk in response.body_iterator:
            # Handle bytes vs string from the stream
            text_chunk = chunk.decode("utf-8") if isinstance(chunk, bytes) else chunk
            buffer += text_chunk

            # ✅ PACKET 2+: Send AI text + Base64 audio chunks
            # We chunk at ~45 chars to keep gTTS fast and natural
            if len(buffer) > 45:
                audio_b64 = text_to_speech_chunk(buffer)
                if audio_b64:
                    payload = {
                        "text": buffer,
                        "audio": audio_b64
                    }
                    yield f"data: {json.dumps(payload)}\n\n"
                buffer = ""

        # Final remaining text in buffer
        if buffer.strip():
            audio_b64 = text_to_speech_chunk(buffer)
            if audio_b64:
                yield f"data: {json.dumps({'text': buffer, 'audio': audio_b64})}\n\n"

    return StreamingResponse(generate_dual_stream(), media_type="text/event-stream")