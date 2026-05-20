import re

def clean_text(text):
    """Basic text normalization for better embedding/analysis."""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s]', '', text)
    return text

def extract_keywords(text):
    """Quick mock for keyword extraction (can be expanded with NLTK/SpaCy)."""
    common_skills = ["python", "react", "javascript", "aws", "docker", "sql"]
    found = [skill for skill in common_skills if skill in text.lower()]
    return found