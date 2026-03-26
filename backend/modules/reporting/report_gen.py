import re

class ReportGenerator:
    def __init__(self, nlp_engine, retriever):
        self.nlp = nlp_engine
        self.retriever = retriever

    def generate_comprehensive_report(self, candidate_data):
        # Extract inputs
        history = candidate_data.get("history", [])
        code_snippets = candidate_data.get("code", [])
        
        # 1. Executive Summary Logic (Simplified for example)
        avg_score = sum([m.get("score", 70) for m in history if "score" in m]) / max(len(history), 1)
        decision = "Hire" if avg_score > 80 else "Borderline" if avg_score > 60 else "Reject"

        # 2. RAG Knowledge Gap Analysis
        # Compares user answers against retrieved ideal docs
        knowledge_eval = self._evaluate_knowledge_gaps(history, candidate_data.get("role"))

        return {
            "executive_summary": {
                "performance": f"Candidate demonstrated {decision.lower()} level proficiency.",
                "strengths": "Strong technical foundation and clear communication.",
                "weaknesses": "Lacks depth in system design scaling patterns.",
                "final_recommendation": decision
            },
            "scores": {
                "technical": 85,
                "problem_solving": 78,
                "communication": 92,
                "confidence": 80,
                "code_quality": 70
            },
            "rag_evaluation": knowledge_eval,
            "behavioral": {
                "star_method": "Good",
                "tone": "Professional/Confident",
                "filler_words": "Low"
            },
            "improvement_plan": {
                "technical": ["Deepen knowledge in O(1) space optimization", "Review React Concurrent Mode"],
                "communication": ["Quantify results in STAR answers", "Slow down during complex logic"],
                "steps": ["Complete 2 more System Design mocks", "Review RAG-retrieved optimal patterns"]
            }
        }

    def _evaluate_knowledge_gaps(self, history, role):
        # Mock logic: in real app, this queries Retriever
        return {
            "covered": ["REST APIs", "SQL Joins"],
            "missing": ["Redis Caching", "Load Balancing"],
            "partial": ["Database Indexing"]
        }