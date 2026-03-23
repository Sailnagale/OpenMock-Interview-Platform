import json

def get_question_by_id(category: str, q_id: str):
    try:
        with open("questions.json", "r") as f:
            data = json.load(f)
            for q in data.get(category, []):
                if q['id'] == q_id:
                    return q['question']
    except Exception:
        return "Please introduce yourself and tell me about your background."
    return "Question not found."