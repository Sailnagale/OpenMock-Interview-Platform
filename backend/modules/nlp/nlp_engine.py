from core.config import groq_client

class NLPEngine:
    def __init__(self, model="llama-3.3-70b-versatile"):
        self.model = model

    def analyze_behavioral_response(self, user_input, job_role):
        """Checks for STAR method, tone, and confidence."""
        prompt = f"""
        Analyze this interview response for a {job_role} position.
        
        User Response: "{user_input}"
        
        Evaluate based on:
        1. STAR Method: (Situation, Task, Action, Result) - Which parts are present?
        2. Tone: Is the user confident, nervous, or hesitant?
        3. Communication: Is it clear or rambling?
        
        Return ONLY a JSON object with:
        {{
          "star_evaluation": {{"S": bool, "T": bool, "A": bool, "R": bool}},
          "tone": "string",
          "critique": "short summary of missing parts",
          "score": 1-100
        }}
        """
        completion = groq_client.chat.completions.create(
            model=self.model,
            messages=[{"role": "system", "content": prompt}],
            response_format={"type": "json_object"}
        )
        import json
        return json.loads(completion.choices[0].message.content)