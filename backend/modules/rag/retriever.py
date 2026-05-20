from .vector_store import VectorStore
import logging

# Set up logger to see retrieval status in the console
logger = logging.getLogger("uvicorn.error")

class Retriever:
    def __init__(self):
        """
        Initializes the Retriever with a connection to the VectorStore (ChromaDB).
        """
        try:
            self.store = VectorStore()
            logger.info("✅ Retriever: VectorStore connection established.")
        except Exception as e:
            logger.error(f"❌ Retriever: Failed to initialize VectorStore: {e}")
            self.store = None

    def get_relevant_context(self, query: str, n_results: int = 3, collection_name: str = "interview_data"):
        """
        Primary method used by interview_service.py.
        Retrieves the most relevant chunks from the resume based on the query.
        """
        # Dynamically switch/load user-specific store if specified
        store = self.store
        if collection_name != "interview_data":
            try:
                store = VectorStore(collection_name=collection_name)
            except Exception as e:
                logger.error(f"❌ RAG: Failed to load user collection {collection_name}: {e}")
                store = self.store

        if not store:
            logger.warning("⚠️ Retriever: Store not initialized. Returning empty context.")
            return ""

        try:
            # Clean the query to focus on technical/role keywords
            search_query = f"Experience, projects, and skills related to {query}"
            
            results = store.query(search_query, n_results=n_results)
            
            # ChromaDB returns results in a nested list format: {'documents': [['chunk1', 'chunk2']]}
            if results and 'documents' in results and results['documents'] and len(results['documents'][0]) > 0:
                documents = results['documents'][0]
                context_str = "\n\n".join(documents)
                logger.info(f"🧠 RAG: Successfully retrieved {len(documents)} context chunks from collection '{collection_name}'.")
                return context_str
            
            logger.info(f"ℹ️ RAG: No matching context found in collection '{collection_name}'.")
            return ""
            
        except Exception as e:
            logger.error(f"❌ RAG Retrieval Error: {e}")
            return ""

    def get_context_for_interview(self, job_role: str, user_id: str = "current_user"):
        """
        Legacy/Alternative method name. 
        Calls the primary get_relevant_context method for consistency.
        """
        return self.get_relevant_context(query=job_role)

    def clear_cache(self):
        """
        Utility to clear local state if needed between sessions.
        """
        pass