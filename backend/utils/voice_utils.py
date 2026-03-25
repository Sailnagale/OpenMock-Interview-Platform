import base64
import tempfile
import os
from gtts import gTTS
from core.config import groq_client

# ============================================================
# 🎤 Speech to Text (Base64 → Text)
# ============================================================
def speech_to_text(audio_base64: str) -> str:
    """
    Converts Base64 audio to text using Whisper-large-v3.
    Includes filters to prevent 'prompt-echo' and hallucinations.
    """
    temp_audio_path = None
    try:
        audio_bytes = base64.b64decode(audio_base64)

        # Save incoming audio to a temporary webm file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as temp_audio:
            temp_audio.write(audio_bytes)
            temp_audio_path = temp_audio.name

        # Whisper Call with a generic prompt to guide context without being 'chatty'
        with open(temp_audio_path, "rb") as audio_file:
            transcription = groq_client.audio.transcriptions.create(
                file=audio_file,
                model="whisper-large-v3",
                prompt="A technical job interview conversation.",
                language="en"
            )

        raw_text = transcription.text.strip()
        
        # ✅ HALLUCINATION & PROMPT FILTER
        # If Whisper repeats our instructions or is too short, we ignore it.
        forbidden_phrases = [
            "technical interview", 
            "background noise", 
            "silence", 
            "ignore", 
            "conversation"
        ]
        
        lower_text = raw_text.lower()
        
        # 1. Check if the text is basically just our prompt
        if any(phrase in lower_text for phrase in forbidden_phrases):
            return ""
            
        # 2. Check for common single-word hallucinations
        if lower_text in ["you", "the", "thanks", "bye", "."]:
            return ""

        return raw_text

    except Exception as e:
        print("❌ STT Error:", e)
        return ""
    finally:
        # Cleanup: Delete the temp audio file
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)


# ============================================================
# 🔊 Text to Speech (Text → Base64 Audio)
# ============================================================
def text_to_speech_chunk(text: str) -> str:
    """
    Converts a chunk of text to a Base64 encoded MP3 string using gTTS.
    """
    temp_audio_path = None
    if not text.strip():
        return ""
        
    try:
        # Initialize Google Text-to-Speech
        tts = gTTS(text=text, lang="en")

        # Create a temp file for the MP3
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as temp_audio:
            temp_audio_path = temp_audio.name

        # Save and then read as bytes
        tts.save(temp_audio_path)

        with open(temp_audio_path, "rb") as f:
            audio_bytes = f.read()

        # Convert to Base64 string for streaming to frontend
        return base64.b64encode(audio_bytes).decode("utf-8")

    except Exception as e:
        print("❌ TTS Error:", e)
        return ""
    finally:
        # Cleanup: Delete the temp MP3 file
        if temp_audio_path and os.path.exists(temp_audio_path):
            os.remove(temp_audio_path)