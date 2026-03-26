class ReportGenerator:
    @staticmethod
    def generate_final_summary(history, nlp_stats):
        """Uses NLP to create a personalized improvement plan."""
        # Logic to aggregate scores and generate a summary text.
        total_score = sum([s.get('score', 0) for s in nlp_stats]) / len(nlp_stats) if nlp_stats else 0
        return {
            "overall_score": total_score,
            "strengths": "Calculated based on technical accuracy",
            "improvement_plan": "Specific advice based on missing STAR components"
        }