from .vector_store import VectorStore

class Retriever:
    def __init__(self):
        self.store = VectorStore()

    def get_context_for_interview(self, job_role, user_id="current_user"):
        """Retrieves relevant resume projects or company patterns."""
        # Query for the specific job role or user's past projects
        results = self.store.query(f"Projects and skills related to {job_role}")
        
        context_str = "\n".join(results['documents'][0]) if results['documents'] else ""
        return context_str