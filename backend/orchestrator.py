import os
from groq import Groq
import google.generativeai as genai
import httpx  # For calling LM Studio

class InterviewOrchestrator:
    def __init__(self):
        self.groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
        self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')

    async def get_hr_response(self, user_input, history):
        # Use Groq for speed in HR rounds
        completion = self.groq_client.chat.completions.create(
            model="llama3-8b-8192",
            messages=[{"role": "system", "content": "You are a professional HR manager."}] + history + [{"role": "user", "content": user_input}],
            stream=True
        )
        for chunk in completion:
            yield chunk.choices[0].delta.content or ""

    async def get_coding_analysis(self, code, lm_studio_url):
        # Call the user's LOCAL LM Studio API
        # Ensure user has enabled CORS in LM Studio settings!
        payload = {
            "model": "local-model", # LM Studio usually ignores this and uses the loaded model
            "messages": [
                {"role": "system", "content": "Analyze this code for complexity and better approaches."},
                {"role": "user", "content": code}
            ],
            "temperature": 0.7
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(f"{lm_studio_url}/v1/chat/completions", json=payload, timeout=60.0)
            return response.json()['choices'][0]['message']['content']